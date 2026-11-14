// Распознавание русской речи без платных сервисов.
// В Android-приложении — встроенный распознаватель телефона (плагин @capacitor-community/speech-recognition),
// в браузере — Web Speech API (Chrome, Safari). Интерфейс один: Speech.create().start(onText) / stop().
(function () {
  const cap = window.Capacitor;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const hasNativePlugin = isNative && !!(cap.PluginHeaders || []).some((p) => p.name === 'SpeechRecognition');
  const nativeSR = hasNativePlugin ? cap.registerPlugin('SpeechRecognition') : null;
  const WebSR = window.SpeechRecognition || window.webkitSpeechRecognition;

  let nativeAvailable = null; // выясняется асинхронно

  async function checkAvailable() {
    if (nativeSR) {
      if (nativeAvailable === null) {
        try { nativeAvailable = !!(await nativeSR.available()).available; } catch (e) { nativeAvailable = false; }
      }
      return nativeAvailable;
    }
    return !!WebSR;
  }

  async function ensurePermission() {
    if (!nativeSR) return true; // браузер спросит сам
    try {
      let st = await nativeSR.checkPermissions();
      if (st.speechRecognition !== 'granted') st = await nativeSR.requestPermissions();
      return st.speechRecognition === 'granted';
    } catch (e) {
      return false;
    }
  }

  // ---- Android: распознаватель телефона. Он сам останавливается после паузы, поэтому перезапускаем его,
  // пока пользователь не нажал «стоп», а распознанное накапливаем.
  function nativeListener() {
    let active = false;
    let committed = '';
    let current = '';
    let onText = null;
    let onError = null;
    let handles = [];
    let restartTimer = null;

    const emit = () => onText && onText((committed + ' ' + current).trim());

    async function begin() {
      if (!active) return;
      try {
        await nativeSR.start({ language: 'ru-RU', maxResults: 1, partialResults: true, popup: false });
      } catch (e) {
        // «No match» и подобные ошибки после тишины — просто пробуем снова.
        scheduleRestart(400);
      }
    }

    function scheduleRestart(ms) {
      clearTimeout(restartTimer);
      if (active) restartTimer = setTimeout(begin, ms);
    }

    return {
      async start(textCb, errCb) {
        onText = textCb;
        onError = errCb;
        committed = '';
        current = '';
        const ok = await ensurePermission();
        if (!ok) { errCb && errCb('not-allowed'); return false; }
        active = true;
        handles.push(await nativeSR.addListener('partialResults', (d) => {
          current = (d.matches && d.matches[0]) || '';
          emit();
        }));
        handles.push(await nativeSR.addListener('listeningState', (d) => {
          if (d.status === 'stopped') {
            if (current) { committed = (committed + ' ' + current).trim(); current = ''; }
            emit();
            scheduleRestart(250);
          }
        }));
        begin();
        return true;
      },
      async stop() {
        active = false;
        clearTimeout(restartTimer);
        try { await nativeSR.stop(); } catch (e) { /* уже остановлен */ }
        if (current) { committed = (committed + ' ' + current).trim(); current = ''; }
        handles.forEach((h) => { try { h.remove(); } catch (e) { /* ок */ } });
        handles = [];
        return committed;
      },
    };
  }

  // ---- Браузер: Web Speech API.
  function webListener() {
    let rec = null;
    let active = false;
    let committed = '';
    let sessionFinal = '';
    let sessionInterim = '';
    let onText = null;
    // На Android-Chrome непрерывный режим дублирует фразы — там слушаем короткими сессиями.
    const continuous = !/Android/i.test(navigator.userAgent);

    const emit = () => onText && onText([committed, sessionFinal, sessionInterim].join(' ').replace(/\s+/g, ' ').trim());

    function commitSession() {
      const t = (sessionFinal + ' ' + sessionInterim).trim();
      if (t) committed = (committed + ' ' + t).trim();
      sessionFinal = '';
      sessionInterim = '';
    }

    function makeRec(errCb) {
      const r = new WebSR();
      r.lang = 'ru-RU';
      r.interimResults = true;
      r.continuous = continuous;
      r.maxAlternatives = 1;
      r.onresult = (ev) => {
        let fin = '';
        let int = '';
        for (let i = 0; i < ev.results.length; i++) {
          const txt = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) fin += ' ' + txt; else int += ' ' + txt;
        }
        sessionFinal = fin.trim();
        sessionInterim = int.trim();
        emit();
      };
      r.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed' || ev.error === 'audio-capture') {
          active = false;
          errCb && errCb(ev.error === 'audio-capture' ? 'no-mic' : 'not-allowed');
        }
      };
      r.onend = () => {
        commitSession();
        emit();
        if (active) {
          setTimeout(() => { if (active) { try { rec = makeRec(errCb); rec.start(); } catch (e) { /* ок */ } } }, 150);
        }
      };
      return r;
    }

    return {
      async start(textCb, errCb) {
        onText = textCb;
        committed = '';
        sessionFinal = '';
        sessionInterim = '';
        active = true;
        try {
          rec = makeRec(errCb);
          rec.start();
          return true;
        } catch (e) {
          active = false;
          errCb && errCb('failed');
          return false;
        }
      },
      async stop() {
        active = false;
        try { rec && rec.stop(); } catch (e) { /* ок */ }
        commitSession();
        return committed;
      },
    };
  }

  window.Speech = {
    isNative,
    // Есть ли вообще способ распознавать речь (синхронная оценка; точный ответ — checkAvailable()).
    supported: !!nativeSR || !!WebSR,
    checkAvailable,
    create() { return nativeSR ? nativeListener() : webListener(); },
  };

  // Вибрация в Android-приложении — через плагин Haptics (в браузере — navigator.vibrate в fx.js).
  if (isNative && (cap.PluginHeaders || []).some((p) => p.name === 'Haptics')) {
    const haptics = cap.registerPlugin('Haptics');
    window.NativeHaptics = {
      light() { haptics.impact({ style: 'LIGHT' }).catch(() => {}); },
      heavy() { haptics.notification({ type: 'ERROR' }).catch(() => {}); },
      success() { haptics.notification({ type: 'SUCCESS' }).catch(() => {}); },
    };
  }
})();

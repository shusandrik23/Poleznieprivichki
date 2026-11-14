// «Говорун» — тренажёр ораторского искусства. Вкладки: Истории, Тренажёр, Конструктор.
(function () {
  'use strict';

  const MODULES = window.GOVORUN_MODULES;
  const LESSONS = MODULES.flatMap((m) => m.lessons);
  const CFG = window.GOVORUN_CONFIG || {};
  const cap = window.Capacitor;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const hasPlugin = (n) => isNative && !!(cap.PluginHeaders || []).some((p) => p.name === n);
  const plugin = (n) => (hasPlugin(n) ? cap.registerPlugin(n) : null);
  const NativeClipboard = plugin('Clipboard');
  const NativeShare = plugin('Share');
  const NativeApp = plugin('App');

  const MAX_HEARTS = 5;
  const HEART_MS = 30 * 60 * 1000; // одно сердечко восстанавливается за 30 минут
  const REFILL_COST = 50;
  const VOICE_SECONDS = 20;
  const PITCH_SECONDS = 45;
  const IMPROV_SECONDS = 60;
  const RANKS = [
    [0, 'Новичок', '🐣'], [60, 'Рассказчик', '🗣️'], [150, 'Оратор', '🎙️'], [300, 'Трибун', '🏛️'], [600, 'Златоуст', '👑'],
  ];

  // ------------------------------------------------------------------ утилиты
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const dayKey = (d) => { d = d || new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many; };
  const fmtTime = (s) => `0:${String(Math.max(0, Math.ceil(s))).padStart(2, '0')}`;

  function hap(kind) {
    const H = window.NativeHaptics;
    if (S.sound === false) return;
    if (H) { kind === 'error' ? H.heavy() : kind === 'success' ? H.success() : H.light(); return; }
    FX.vibrate(kind === 'error' ? [40, 60, 40] : kind === 'success' ? [20, 40, 30] : 12);
  }
  function sfx(name) { FX.play(name); }

  // ------------------------------------------------------------------ хранение
  const KEY = 'govorun.v1';
  const DEFAULT = () => ({
    name: 'Оратор', avatar: '🦜',
    completed: {}, // id урока → { times, perfect }
    gems: 0, hearts: MAX_HEARTS, heartsTs: Date.now(),
    streak: 0, bestStreak: 0, lastDay: null, days: [],
    stats: { lessons: 0, perfect: 0, voice: 0, pitches: 0, improv: 0, bestWpm: 0, speeches: 0 },
    builder: { step: 0, answers: {} },
    sound: true,
    created: Date.now(),
  });
  let S = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const def = DEFAULT();
        return Object.assign(def, d, { stats: Object.assign(def.stats, d.stats || {}), builder: Object.assign(def.builder, d.builder || {}) });
      }
    } catch (e) { /* повреждённые данные — начинаем заново */ }
    return DEFAULT();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* хранилище недоступно */ } }

  function refreshHearts() {
    if (S.hearts >= MAX_HEARTS) { S.hearts = MAX_HEARTS; S.heartsTs = Date.now(); return; }
    const n = Math.floor((Date.now() - S.heartsTs) / HEART_MS);
    if (n > 0) {
      S.hearts = Math.min(MAX_HEARTS, S.hearts + n);
      S.heartsTs = S.hearts >= MAX_HEARTS ? Date.now() : S.heartsTs + n * HEART_MS;
      save();
    }
  }
  function loseHeart() {
    refreshHearts();
    if (S.hearts >= MAX_HEARTS) S.heartsTs = Date.now();
    S.hearts = Math.max(0, S.hearts - 1);
    save();
    renderHeader('hearts');
  }
  function addHeart() { refreshHearts(); if (S.hearts < MAX_HEARTS) { S.hearts++; save(); renderHeader('hearts'); return true; } return false; }

  function streakNow() {
    if (!S.lastDay) return 0;
    const d = daysBetween(S.lastDay, dayKey());
    return d <= 1 ? S.streak : 0;
  }
  // Засчитать сегодняшний день в ударный режим. Возвращает true, если огонёк вырос.
  function markActiveDay() {
    const today = dayKey();
    if (S.lastDay === today) return false;
    const gap = S.lastDay ? daysBetween(S.lastDay, today) : 99;
    S.streak = gap === 1 ? S.streak + 1 : 1;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
    S.lastDay = today;
    if (!S.days.includes(today)) S.days.push(today);
    if (S.days.length > 60) S.days = S.days.slice(-60);
    save();
    return true;
  }
  function addGems(n) { S.gems += n; save(); renderHeader('gems'); }
  function rank() { let r = RANKS[0]; for (const x of RANKS) if (S.gems >= x[0]) r = x; return r; }
  function nextRank() { return RANKS.find((x) => x[0] > S.gems) || null; }
  const isDone = (id) => !!S.completed[id];
  const currentIndex = () => { const i = LESSONS.findIndex((l) => !isDone(l.id)); return i === -1 ? LESSONS.length : i; };

  // ------------------------------------------------------------------ анализ речи (на телефоне)
  const FILLERS = (window.GOVORUN_FILLERS || []).map((f) => f.split(' '));
  const norm = (w) => w.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9-]/g, '');

  function analyzeSpeech(text, seconds) {
    const parts = String(text || '').split(/\s+/).filter(Boolean);
    const tokens = parts.map(norm);
    const words = tokens.filter(Boolean).length;
    const marked = new Set();
    const fillers = {};
    for (let i = 0; i < tokens.length; i++) {
      for (const f of FILLERS) {
        const ok = f.every((w, k) => tokens[i + k] === norm(w));
        if (ok) {
          const name = f.join(' ');
          fillers[name] = (fillers[name] || 0) + 1;
          for (let k = 0; k < f.length; k++) marked.add(i + k);
          break;
        }
      }
    }
    const fillerTotal = Object.values(fillers).reduce((a, b) => a + b, 0);
    const wpm = seconds >= 3 && words ? Math.round(words / (seconds / 60)) : 0;
    const html = parts.map((p, i) => (marked.has(i) ? `<mark>${esc(p)}</mark>` : esc(p))).join(' ');
    return { words, wpm, fillers, fillerTotal, html, tokens };
  }

  function checkBonus(bonus, a) {
    if (!bonus) return false;
    if (bonus.type === 'keywords') return bonus.words.some((w) => a.tokens.includes(norm(w)));
    if (bonus.type === 'repeat') {
      const c = {};
      a.tokens.forEach((t) => { if (t.length > 1) c[t] = (c[t] || 0) + 1; });
      return Object.values(c).some((n) => n >= 3);
    }
    return false;
  }

  function tempoVerdict(wpm) {
    if (!wpm) return '';
    if (wpm < 90) return 'медленно';
    if (wpm <= 155) return 'отличный темп';
    return 'быстро';
  }

  // Отзыв Попугая без интернета — из подсчитанной статистики.
  function localParrot(a, ctx) {
    const lines = [];
    if (a.words < 4) return 'Кр-р-р… я почти ничего не расслышал! Поднеси телефон ближе и скажи хотя бы пару предложений.';
    if (ctx.bonusHit && ctx.technique) lines.push(pick([`Приём «${ctx.technique}» я услышал — кр-р-расота!`, `«${ctx.technique}» сработал, мне прямо захотелось аплодировать крыльями!`]));
    else if (ctx.technique) lines.push(pick([`Мысль понятна, но приём «${ctx.technique}» прозвучал неярко — попробуй выделить его голосом.`, `Хорошее начало! Добавь в следующий раз приём «${ctx.technique}» поярче.`]));
    else lines.push(pick(['Ты говоришь уверенно — это половина успеха!', 'Кр-р-руто, мысль звучит живо!']));
    if (a.wpm) {
      if (a.wpm < 90) lines.push(`Темп ${a.wpm} слов в минуту — медленновато, добавь энергии.`);
      else if (a.wpm > 155) lines.push(`Темп ${a.wpm} слов в минуту — быстро, делай паузы после важных мыслей.`);
      else lines.push(`Темп ${a.wpm} слов в минуту — комфортно для слушателей.`);
    }
    if (a.fillerTotal) {
      const top = Object.entries(a.fillers).sort((x, y) => y[1] - x[1])[0];
      lines.push(`Слово «${top[0]}» проскочило ${top[1]} ${plural(top[1], 'раз', 'раза', 'раз')} — замени его паузой.`);
    } else {
      lines.push('Ни одного слова-паразита — чистая речь!');
    }
    return lines.slice(0, 3).join(' ');
  }

  // Живой отзыв: встроенный Claude (если приложение открыто как артефакт Claude) → наш Worker → локальный отзыв.
  async function askParrot(payload) {
    const timeout = CFG.PARROT_TIMEOUT || 12000;
    const withTimeout = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeout))]);
    try {
      if (window.claude && typeof window.claude.complete === 'function') {
        const prompt = [
          'Ты — Попугай-ритор, весёлый тренер по ораторскому искусству. Ответь по-русски в 2–3 предложениях на «ты», без списков:',
          'оцени, насколько убедительно звучит мысль и сработал ли приём, похвали конкретное и дай один совет.',
          payload.technique ? `Приём: ${payload.technique}.` : '',
          payload.task ? `Задание: ${payload.task}` : '',
          payload.topic ? `Тема: ${payload.topic}` : '',
          `Темп: ${payload.wpm} слов/мин. Паразиты: ${JSON.stringify(payload.fillers)}.`,
          `Расшифровка: ${payload.transcript}`,
        ].join('\n');
        const t = await withTimeout(window.claude.complete(prompt));
        if (t && String(t).trim()) return { text: String(t).trim(), source: 'ai' };
      }
    } catch (e) { /* пробуем следующий способ */ }
    if (CFG.PARROT_URL && navigator.onLine !== false) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        const res = await fetch(CFG.PARROT_URL.replace(/\/$/, '') + '/feedback', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const d = await res.json();
          if (d && d.text) return { text: d.text, source: 'ai' };
        }
      } catch (e) { /* нет сети или Worker недоступен */ }
    }
    return null;
  }

  // Карточка с результатами речи + отзыв Попугая. Возвращает HTML; отзыв догружается в элемент #parrot-<id>.
  function speechReportHTML(a, id, opts) {
    opts = opts || {};
    const fl = Object.entries(a.fillers);
    return `
      <div class="report">
        <div class="result-grid">
          <div class="card"><b style="color:var(--blue)">${a.wpm || '—'}</b><small>слов в минуту${a.wpm ? ' · ' + tempoVerdict(a.wpm) : ''}</small></div>
          <div class="card"><b style="color:${a.fillerTotal ? 'var(--red)' : 'var(--green)'}">${a.fillerTotal}</b><small>${plural(a.fillerTotal, 'слово-паразит', 'слова-паразита', 'слов-паразитов')}</small></div>
          ${opts.extra || ''}
        </div>
        ${fl.length ? `<div class="fillers">${fl.map(([w, n]) => `<span class="ftag">«${esc(w)}» ×${n}</span>`).join('')}</div>` : ''}
        <div class="transcript ${a.words ? '' : 'empty'}">${a.words ? a.html : 'Речь не распознана'}</div>
        <div class="parrot-box" id="parrot-${id}">
          <span class="p-ava">🦜</span>
          <div class="p-text"><span class="typing"><i></i><i></i><i></i></span> Попугай слушает запись…</div>
        </div>
      </div>`;
  }

  async function fillParrot(id, a, ctx, payload) {
    const box = document.getElementById('parrot-' + id);
    let res = null;
    if (a.words >= 4) res = await askParrot(payload);
    const el = document.getElementById('parrot-' + id);
    if (!el || el !== box) return; // экран уже сменился
    const text = res ? res.text : localParrot(a, ctx);
    el.querySelector('.p-text').innerHTML = `${esc(text)}<small>${res ? 'Отзыв нейросети' : 'Отзыв по статистике речи'}</small>`;
    el.classList.add('ready');
  }

  // ------------------------------------------------------------------ шапка
  function renderHeader(bump) {
    refreshHearts();
    const st = streakNow();
    $('#streak-val').textContent = st;
    $('#stat-streak').classList.toggle('cold', S.lastDay !== dayKey());
    $('#gems-val').textContent = S.gems;
    $('#hearts-val').textContent = S.hearts;
    $('#me-btn').textContent = S.avatar;
    if (bump) {
      const el = { gems: '#stat-gems', hearts: '#stat-hearts', streak: '#stat-streak' }[bump];
      if (el) { const n = $(el); n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); }
    }
  }

  // ------------------------------------------------------------------ навигация
  let tab = 'stories';
  function go(t) {
    if (t !== tab) { stopAllRecording(); }
    tab = t;
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    render();
  }
  function render() {
    const v = $('#view');
    v.scrollTop = 0;
    if (tab === 'stories') renderStories(v);
    else if (tab === 'trainer') renderTrainer(v);
    else renderBuilder(v);
    renderHeader();
  }

  // ------------------------------------------------------------------ нижние листы, тосты
  let sheetClose = null;
  function sheet(html, onMount) {
    closeSheet();
    const root = $('#sheet-root');
    root.innerHTML = `<div class="sheet-back"><div class="sheet" role="dialog"><div class="grab"></div>${html}</div></div>`;
    const back = $('.sheet-back', root);
    back.addEventListener('click', (e) => { if (e.target === back) closeSheet(); });
    sheetClose = () => { root.innerHTML = ''; sheetClose = null; };
    if (onMount) onMount($('.sheet', root));
  }
  function closeSheet() { if (sheetClose) sheetClose(); }
  let toastT = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function streakSheet() {
    const st = streakNow();
    const today = dayKey();
    const now = new Date();
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const week = names.map((n, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const k = dayKey(d);
      return `<div class="day ${S.days.includes(k) ? 'on' : ''} ${k === today ? 'today' : ''}">${n}<i>${S.days.includes(k) ? '🔥' : ''}</i></div>`;
    }).join('');
    sheet(`<div class="s-ico">🔥</div><h3>${st} ${plural(st, 'день', 'дня', 'дней')} подряд</h3>
      <p>${S.lastDay === today ? 'Сегодня огонёк уже горит. Возвращайтесь завтра, чтобы не прервать серию!' : 'Пройдите урок или тренировку сегодня, чтобы огонёк не погас.'}</p>
      <div class="week" style="margin-bottom:20px">${week}</div>
      <p style="margin-bottom:14px">Рекорд: ${S.bestStreak} ${plural(S.bestStreak, 'день', 'дня', 'дней')}</p>
      <button class="btn" data-close>Понятно</button>`, (s) => $('[data-close]', s).onclick = closeSheet);
  }
  function gemsSheet() {
    const r = rank(); const nr = nextRank();
    const pct = nr ? Math.round(((S.gems - r[0]) / (nr[0] - r[0])) * 100) : 100;
    sheet(`<div class="s-ico">💎</div><h3>${S.gems} очков харизмы</h3>
      <p>Звание: <b style="color:var(--text)">${r[2]} ${r[1]}</b>${nr ? `<br>До звания «${nr[1]}» — ${nr[0] - S.gems} 💎` : '<br>Высшее звание!'}</p>
      <div class="lvl-bar" style="margin:-6px 0 18px"><i style="width:${pct}%"></i></div>
      <p>Очки дают за уроки (+20, без ошибок +5, за голосовое задание +10), лифтовые презентации и импровизацию.</p>
      <button class="btn blue" data-close>Отлично</button>`, (s) => $('[data-close]', s).onclick = closeSheet);
  }
  function heartsSheet(opts) {
    refreshHearts();
    opts = opts || {};
    const left = S.hearts < MAX_HEARTS ? Math.ceil((HEART_MS - (Date.now() - S.heartsTs)) / 60000) : 0;
    const row = Array.from({ length: MAX_HEARTS }, (_, i) => (i < S.hearts ? '❤️' : '🤍')).join('');
    sheet(`<div class="hearts-row">${row}</div>
      <h3>${S.hearts === 0 ? 'Сердечки закончились!' : S.hearts === MAX_HEARTS ? 'Все сердечки на месте' : `Осталось ${S.hearts} ${plural(S.hearts, 'сердечко', 'сердечка', 'сердечек')}`}</h3>
      <p>${S.hearts === 0 ? 'Ошибки — часть обучения. Восстановите сердечки или потренируйтесь в Тренажёре.' : 'За ошибку в тесте или сборке фразы сгорает одно сердечко.'}
      ${S.hearts < MAX_HEARTS ? `<br>Следующее восстановится через ${left} мин.` : ''}</p>
      ${S.hearts < MAX_HEARTS ? `<button class="btn blue" data-refill ${S.gems < REFILL_COST ? 'disabled' : ''}>Восстановить все за ${REFILL_COST} 💎</button>
      <button class="btn ghost" data-train>Тренажёр: +1 ❤️ за речь</button>` : ''}
      <button class="btn link" data-close>${opts.inLesson ? 'Выйти из урока' : 'Закрыть'}</button>`, (s) => {
      const r = $('[data-refill]', s);
      if (r) r.onclick = () => { S.gems -= REFILL_COST; S.hearts = MAX_HEARTS; S.heartsTs = Date.now(); save(); renderHeader('hearts'); sfx('heart'); hap('success'); closeSheet(); toast('Сердечки восстановлены ❤️'); if (opts.onRefill) opts.onRefill(); };
      const t = $('[data-train]', s);
      if (t) t.onclick = () => { closeSheet(); if (opts.inLesson) closeLesson(true); go('trainer'); };
      $('[data-close]', s).onclick = () => { closeSheet(); if (opts.inLesson) closeLesson(true); };
    });
  }

  // ------------------------------------------------------------------ вкладка «Истории»
  function renderStories(v) {
    const cur = currentIndex();
    const offsets = [0, 64, 92, 64, 0, -64, -92, -64];
    let html = '';
    MODULES.forEach((m) => {
      const done = m.lessons.filter((l) => isDone(l.id)).length;
      const r = rank(); const nr = nextRank();
      const pct = nr ? Math.round(((S.gems - r[0]) / (nr[0] - r[0])) * 100) : 100;
      html += `<div class="path">
        <div class="unit-banner">
          <div style="flex:1">
            <small>${esc(m.subtitle)} · пройдено ${done}/${m.lessons.length}</small>
            <h2>${esc(m.title)}</h2>
            <div class="unit-progress"><i style="width:${(done / m.lessons.length) * 100}%"></i></div>
          </div>
          <div class="unit-ico">🎤</div>
        </div>
        <button class="charisma-bar" id="charisma-btn">
          <span class="ch-ico">${r[2]}</span>
          <span class="ch-body"><b>Шкала харизмы · ${esc(r[1])}</b><span class="lvl-bar"><i style="width:${pct}%"></i></span></span>
          <span class="ch-val">${S.gems} 💎</span>
        </button>
        <div class="snake">`;
      m.lessons.forEach((l, i) => {
        const gi = LESSONS.indexOf(l);
        const state = isDone(l.id) ? 'done' : gi === cur ? 'current' : 'locked';
        const x = offsets[i % offsets.length];
        html += `<div class="node-wrap ${state === 'current' ? 'is-current' : ''}" style="transform:translateX(${x}px)">
          ${state === 'current' ? `<div class="start-bubble">${S.completed && Object.keys(S.completed).length ? 'Дальше' : 'Начать'}</div>` : ''}
          <button class="node ${state}" data-lesson="${gi}" aria-label="${esc(l.title)}">
            <span class="node-ico">${state === 'locked' ? '🔒' : l.icon}</span>
            ${state === 'done' ? '<span class="check">✓</span>' : ''}
          </button>
          <div class="node-label">${esc(l.title)}<small>${esc(l.technique.name)}</small></div>
        </div>`;
      });
      const all = done === m.lessons.length;
      html += `<div class="node-wrap" style="transform:translateX(${offsets[m.lessons.length % offsets.length]}px)">
          <div class="chest ${all ? 'open' : ''}">🏆</div>
          <div class="node-label">${all ? 'Модуль пройден!' : 'Финал модуля'}</div>
        </div>
        <div class="path-mascot" style="right:6%;top:150px">🦜</div>
        </div>
        <div class="next-unit"><div class="divider">Модуль 2 · Сила голоса — скоро</div></div>
      </div>`;
    });
    v.innerHTML = html;
    $$('.node', v).forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.lesson;
      const l = LESSONS[i];
      if (b.classList.contains('locked')) { hap('light'); toast('Сначала пройдите предыдущий урок 🔒'); return; }
      sfx('tap'); hap('light');
      lessonIntroSheet(l, i);
    }));
    $('#charisma-btn', v).onclick = gemsSheet;
  }

  function lessonIntroSheet(l, i) {
    const done = isDone(l.id);
    sheet(`<div class="s-ico">${l.icon}</div><h3>${esc(l.title)}</h3>
      <p>Приём: <b style="color:${l.technique.color}">${l.technique.emoji} ${esc(l.technique.name)}</b><br>История · Рентген речи · Антипример · Тест · Сборка фразы · Голосовой челлендж</p>
      <button class="btn" data-go>${done ? 'Повторить урок (+5 💎)' : 'Начать урок'}</button>
      <button class="btn link" data-close>Не сейчас</button>`, (s) => {
      $('[data-go]', s).onclick = () => { closeSheet(); openLesson(i); };
      $('[data-close]', s).onclick = closeSheet;
    });
  }

  // ------------------------------------------------------------------ урок
  const STEPS = ['story', 'xray', 'anti', 'quiz', 'builder', 'voice'];
  let L = null;

  function openLesson(i) {
    refreshHearts();
    if (S.hearts <= 0) { heartsSheet(); return; }
    FX.unlock();
    const lesson = LESSONS[i];
    L = { i, lesson, step: 0, mistakes: 0, voiceDone: false, seen: new Set(), quiz: { sel: null, wrong: new Set() }, b: null, rec: null };
    const el = $('#lesson');
    el.classList.remove('hidden');
    el.innerHTML = `<div class="lesson-inner">
      <div class="lesson-top">
        <button class="x-btn" id="l-close" aria-label="Закрыть">✕</button>
        <div class="progress"><i id="l-prog" style="width:0%"></i></div>
        <div class="l-hearts" id="l-hearts">❤️ <span>${S.hearts}</span></div>
      </div>
      <div class="lesson-body" id="l-body"></div>
      <div class="lesson-foot" id="l-foot"></div>
      <div class="feedback" id="l-fb"></div>
    </div>`;
    $('#l-close').onclick = confirmClose;
    renderStep();
  }

  function confirmClose() {
    if (!L) return;
    sheet(`<div class="s-ico">🦜</div><h3>Подожди, не уходи!</h3><p>Если выйти сейчас, прогресс этого урока пропадёт.</p>
      <button class="btn blue" data-stay>Продолжить урок</button><button class="btn link danger" data-leave>Выйти</button>`, (s) => {
      $('[data-stay]', s).onclick = closeSheet;
      $('[data-leave]', s).onclick = () => { closeSheet(); closeLesson(true); };
    });
  }

  function closeLesson(rerender) {
    stopAllRecording();
    L = null;
    const el = $('#lesson');
    el.classList.add('hidden');
    el.innerHTML = '';
    if (rerender) render();
  }

  function setProgress() {
    const p = $('#l-prog');
    if (p) p.style.width = `${(L.step / STEPS.length) * 100}%`;
    const h = $('#l-hearts span');
    if (h) h.textContent = S.hearts;
  }

  function foot(html) { $('#l-foot').innerHTML = html; }

  function hideFeedback() { const fb = $('#l-fb'); fb.className = 'feedback'; fb.innerHTML = ''; }

  function showFeedback(good, title, text, parrot, btnLabel, onBtn) {
    const fb = $('#l-fb');
    fb.className = `feedback ${good ? 'good' : 'bad'}`;
    fb.innerHTML = `<div class="fb-head"><div class="fb-ico">${good ? '✓' : '✕'}</div><h3>${esc(title)}</h3></div>
      ${text ? `<p class="fb-text">${esc(text)}</p>` : ''}
      ${parrot ? `<p class="fb-parrot"><span>🦜</span><span>${esc(parrot)}</span></p>` : ''}
      <button class="btn ${good ? '' : 'red'}" id="fb-btn">${esc(btnLabel)}</button>`;
    requestAnimationFrame(() => fb.classList.add('show'));
    $('#fb-btn').onclick = () => { sfx('tap'); hideFeedback(); onBtn(); };
  }

  function nextStep() {
    stopAllRecording();
    L.step++;
    if (L.step >= STEPS.length) finishLesson();
    else renderStep();
  }

  function renderStep() {
    hideFeedback();
    setProgress();
    const body = $('#l-body');
    body.scrollTop = 0;
    const s = STEPS[L.step];
    ({ story: stepStory, xray: stepXray, anti: stepAnti, quiz: stepQuiz, builder: stepBuilder, voice: stepVoice })[s](body);
  }

  const kicker = (n, t) => `<div class="step-kicker">Шаг ${n} из ${STEPS.length} · ${t}</div>`;

  // Шаг 1. История
  function stepStory(body) {
    const l = L.lesson, st = l.story, t = l.technique;
    body.innerHTML = `${kicker(1, 'История из жизни')}
      <div class="story-hero"><div class="story-emoji">${st.emoji}</div><div><b>${esc(st.hero)}</b><span>${esc(st.year)}</span></div></div>
      <h2 class="step-title">${esc(st.title)}</h2>
      <div class="story">${st.paragraphs.map((p, i) => `<p class="${i === 2 ? 'punch' : ''}">${esc(p)}</p>`).join('')}</div>
      <div class="technique-badge" style="--tc:${t.color};--tc-bg:${t.color}1A">
        <span class="tb-ico">${t.emoji}</span>
        <div><small>Риторический приём</small><b>${esc(t.name)}</b><p>${esc(t.short)}</p></div>
      </div>`;
    foot('<button class="btn" id="go">Дальше</button>');
    $('#go').onclick = () => { sfx('tap'); hap('light'); nextStep(); };
  }

  // Шаг 2. Рентген речи — фразы открывают нижнюю карточку с объяснением.
  function stepXray(body) {
    const x = L.lesson.xray;
    const total = x.segments.filter((s) => s.hint).length;
    body.innerHTML = `${kicker(2, 'Рентген речи')}
      <h2 class="step-title">Что делает речь сильной?</h2>
      <p class="xray-ctx">Нажимайте на подчёркнутые фразы — Попугай объяснит, какой приём в них спрятан.</p>
      <div class="xcard charisma"><h4>✨ ${esc(x.source)}</h4>
        <p>${x.segments.map((s, i) => (s.hint ? `<span class="hint-seg ${L.seen.has(i) ? 'seen' : ''}" data-i="${i}">${esc(s.text)}</span>` : esc(s.text))).join('')}</p>
      </div>
      <div class="xray-counter" id="xc"></div>`;
    const update = () => {
      $('#xc').innerHTML = L.seen.size >= total ? '✅ Все приёмы найдены!' : `Открыто приёмов: ${L.seen.size} из ${total}`;
      $('#go').disabled = L.seen.size < Math.min(total, 2);
    };
    foot('<button class="btn" id="go">Дальше</button>');
    $$('.hint-seg', body).forEach((el) => el.addEventListener('click', () => {
      const i = +el.dataset.i, seg = x.segments[i];
      L.seen.add(i);
      $$('.hint-seg', body).forEach((e) => e.classList.remove('active'));
      el.classList.add('active', 'seen');
      sfx('gem'); hap('light');
      update();
      sheet(`<div class="hint-tag" style="--tc:${L.lesson.technique.color}">${esc(seg.tag)}</div>
        <blockquote class="hint-quote">«${esc(seg.text.trim())}»</blockquote>
        <p class="hint-expl">${esc(seg.hint)}</p>
        <button class="btn blue" data-close>Понятно</button>`, (s) => $('[data-close]', s).onclick = () => { closeSheet(); el.classList.remove('active'); });
    }));
    update();
    $('#go').onclick = () => { sfx('tap'); nextStep(); };
  }

  // Шаг 3. Антипример
  function stepAnti(body) {
    const a = L.lesson.anti;
    body.innerHTML = `${kicker(3, 'Антипример')}
      <h2 class="step-title">А вот как это сказали бы скучно</h2>
      <div class="xcard boring"><h4>😴 Скучная версия</h4><p>${esc(a.text)}</p></div>
      <div class="anti-list">${a.problems.map((p, i) => `<div class="anti-item" style="animation-delay:${0.15 + i * 0.15}s"><span>✕</span>${esc(p)}</div>`).join('')}</div>
      <div class="technique-badge" style="--tc:${L.lesson.technique.color};--tc-bg:${L.lesson.technique.color}1A">
        <span class="tb-ico">${L.lesson.technique.emoji}</span>
        <div><small>Формула приёма</small><b>${esc(L.lesson.technique.name)}</b><p>${esc(L.lesson.technique.formula)}</p></div>
      </div>`;
    foot('<button class="btn" id="go">Понятно, дальше</button>');
    $('#go').onclick = () => { sfx('tap'); nextStep(); };
  }

  // Шаг 4. Тест
  function stepQuiz(body) {
    const q = L.lesson.quiz;
    if (!L.quiz.order) L.quiz.order = shuffle(q.options.map((_, i) => i));
    L.quiz.sel = null;
    body.innerHTML = `${kicker(4, 'Тест')}
      <h2 class="step-title">${esc(q.question)}</h2>
      <div class="situation"><div class="mascot">🦜</div><div class="bubble">${esc(q.situation)}</div></div>
      <div class="options">${L.quiz.order.map((oi, k) => `<button class="option ${L.quiz.wrong.has(oi) ? 'wrong dim' : ''}" data-oi="${oi}" ${L.quiz.wrong.has(oi) ? 'disabled' : ''}><span class="num">${k + 1}</span><span>${esc(q.options[oi].text)}</span></button>`).join('')}</div>`;
    foot('<button class="btn" id="check" disabled>Проверить</button>');
    $$('.option', body).forEach((b) => b.addEventListener('click', () => {
      $$('.option', body).forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
      L.quiz.sel = +b.dataset.oi;
      $('#check').disabled = false;
      sfx('tap'); hap('light');
    }));
    $('#check').onclick = () => {
      const opt = q.options[L.quiz.sel];
      const btn = $(`.option[data-oi="${L.quiz.sel}"]`, body);
      $$('.option', body).forEach((x) => { x.disabled = true; });
      if (opt.correct) {
        btn.classList.add('right');
        sfx('correct'); hap('success');
        showFeedback(true, pick(['Отлично!', 'В точку!', 'Превосходно!']), opt.explain, pick(['Кр-р-расота! Так говорят настоящие ораторы.', 'Вот это я понимаю — харизма!', 'Браво! Зал бы аплодировал стоя.']), 'Продолжить', nextStep);
      } else {
        btn.classList.add('wrong');
        L.mistakes++;
        L.quiz.wrong.add(L.quiz.sel);
        loseHeart(); setProgress();
        sfx('wrong'); hap('error');
        const lh = $('#l-hearts'); lh.classList.remove('shake'); void lh.offsetWidth; lh.classList.add('shake');
        showFeedback(false, 'Не совсем…', opt.explain, pick(['Кр-р-р! Даже Цицерон ошибался. Попробуй ещё раз!', 'Почти! Подумай, что почувствует зал.', 'Ошибка — лучший учитель. Давай ещё раз!']), S.hearts > 0 ? 'Попробовать снова' : 'Понятно', () => {
          if (S.hearts <= 0) heartsSheet({ inLesson: true, onRefill: renderStep });
          else renderStep();
        });
      }
    };
  }

  // Шаг 5. Сборка фразы из блоков
  function stepBuilder(body) {
    const bd = L.lesson.builder;
    if (!L.b) {
      const tiles = shuffle(bd.answer.concat(bd.distractors).map((t, id) => ({ id, t })));
      L.b = { tiles, placed: [] };
    }
    body.innerHTML = `${kicker(5, 'Сборка фразы')}
      <h2 class="step-title">${esc(bd.task)}</h2>
      <div class="builder-task"><div class="mascot">🦜</div><div class="bubble">${esc(bd.hint)}</div></div>
      <div class="answer-area" id="area"></div>
      <div class="bank" id="bank"></div>`;
    const draw = () => {
      $('#area').innerHTML = L.b.placed.map((id) => `<button class="tile" data-id="${id}">${esc(L.b.tiles.find((x) => x.id === id).t)}</button>`).join('');
      $('#bank').innerHTML = L.b.tiles.map((x) => `<button class="tile ${L.b.placed.includes(x.id) ? 'used' : ''}" data-id="${x.id}">${esc(x.t)}</button>`).join('');
      $('#check').disabled = L.b.placed.length === 0;
      $$('#bank .tile').forEach((b) => b.onclick = () => { L.b.placed.push(+b.dataset.id); sfx('tile'); hap('light'); draw(); });
      $$('#area .tile').forEach((b) => b.onclick = () => { L.b.placed = L.b.placed.filter((i) => i !== +b.dataset.id); sfx('tile'); hap('light'); draw(); });
    };
    foot('<button class="btn" id="check" disabled>Проверить</button>');
    draw();
    $('#check').onclick = () => {
      const got = L.b.placed.map((id) => L.b.tiles.find((x) => x.id === id).t).join(' ');
      const want = bd.answer.join(' ');
      const area = $('#area');
      $$('.tile', body).forEach((t) => { t.style.pointerEvents = 'none'; });
      if (got === want) {
        area.classList.add('right');
        sfx('correct'); hap('success');
        showFeedback(true, 'Сильная фраза!', want, pick(['Такую фразу хочется записать!', 'Кр-р-р, звучит как цитата великого оратора!']), 'Продолжить', nextStep);
      } else {
        area.classList.add('wrong');
        L.mistakes++;
        loseHeart(); setProgress();
        sfx('wrong'); hap('error');
        showFeedback(false, 'Правильный ответ:', want, 'Порядок слов решает! Попробуй собрать ещё раз.', S.hearts > 0 ? 'Собрать заново' : 'Понятно', () => {
          L.b.placed = [];
          if (S.hearts <= 0) heartsSheet({ inLesson: true, onRefill: renderStep });
          else renderStep();
        });
      }
    };
  }

  // Шаг 6. Голосовой челлендж
  function stepVoice(body) {
    const l = L.lesson, v = l.voice;
    body.innerHTML = `${kicker(6, 'Голосовой челлендж')}
      <h2 class="step-title">Ваша очередь говорить!</h2>
      <div class="situation"><div class="mascot">🦜</div><div class="bubble voice-task">${esc(v.task)}</div></div>
      <div class="voice-example">Например: ${esc(v.example)}</div>
      <div id="rec-zone"></div>`;
    foot(`<button class="btn" id="go" disabled>Продолжить</button><button class="btn link" id="skip">Я сейчас не могу говорить</button>`);
    $('#skip').onclick = () => {
      stopAllRecording();
      sfx('tap');
      showFeedback(true, 'Ничего страшного!', 'Повторите упражнение вслух, когда будет удобно. Приём уже в вашей колоде.', 'Я подожду, у попугаев много терпения!', 'Продолжить', nextStep);
    };
    $('#go').onclick = () => { sfx('tap'); nextStep(); };
    mountRecorder($('#rec-zone'), {
      seconds: VOICE_SECONDS,
      id: 'lesson',
      onDone: (text, secs) => {
        const a = analyzeSpeech(text, secs);
        const bonusHit = checkBonus(v.bonus, a);
        const ok = a.words >= 4;
        if (ok) { L.voiceDone = true; $('#go').disabled = false; sfx('correct'); hap('success'); } else { hap('error'); }
        const extra = `<div class="card full ${bonusHit ? 'hit' : ''}"><b>${bonusHit ? '✅' : '➖'}</b><small>${esc(v.bonus.label)}${bonusHit ? ' — приём услышан' : ' — не услышал'}</small></div>`;
        return {
          html: (ok ? '' : '<div class="notice">Слишком коротко — скажите хотя бы одно-два предложения.</div>') + speechReportHTML(a, 'lesson', { extra }),
          after: () => fillParrot('lesson', a, { technique: l.technique.name, bonusHit }, {
            mode: 'lesson', technique: l.technique.name, techniqueHint: l.technique.formula, task: v.task,
            transcript: text, wpm: a.wpm, fillers: a.fillers, seconds: secs,
          }),
        };
      },
    });
  }

  function finishLesson() {
    const l = L.lesson;
    const first = !isDone(l.id);
    const perfect = L.mistakes === 0;
    let gems = first ? 20 : 5;
    if (first && perfect) gems += 5;
    if (L.voiceDone) gems += 10;
    const prev = S.completed[l.id] || { times: 0, perfect: false };
    S.completed[l.id] = { times: prev.times + 1, perfect: prev.perfect || perfect };
    S.stats.lessons++;
    if (perfect) S.stats.perfect++;
    if (L.voiceDone) { S.stats.voice++; S.stats.speeches++; }
    const grew = markActiveDay();
    S.gems += gems;
    save();
    $('#l-prog').style.width = '100%';
    $('#l-foot').innerHTML = '';
    const acc = Math.max(0, Math.round(100 - L.mistakes * 15));
    $('#l-body').innerHTML = `<div class="victory">
      <div class="big">🏆</div>
      <h2>Урок пройден!</h2>
      <p>${esc(l.title)} · приём «${esc(l.technique.name)}»</p>
      <div class="reward-row">
        <div class="reward gems"><small>Харизма</small><div>+${gems} 💎</div></div>
        <div class="reward fire"><small>Огонёк</small><div>🔥 ${streakNow()}</div></div>
        <div class="reward acc"><small>Точность</small><div>${acc}%</div></div>
      </div>
      ${first ? `<div class="new-card"><span>${l.technique.emoji}</span><div><b>Новая карточка в колоде!</b><br>«${esc(l.technique.name)}» — смотрите в профиле 🦜</div></div>` : ''}
      ${grew ? '<div class="new-card" style="animation-delay:.8s"><span>🔥</span><div><b>Огонёк горит!</b><br>Сегодняшний день засчитан</div></div>' : ''}
    </div>`;
    foot('<button class="btn" id="fin">Урок пройден</button>');
    sfx('win'); hap('success');
    FX.confetti(160);
    setTimeout(() => renderHeader('gems'), 300);
    $('#fin').onclick = () => { sfx('tap'); closeLesson(false); go('stories'); };
  }

  // ------------------------------------------------------------------ запись речи (общий компонент)
  let activeRec = null;
  function stopAllRecording() { if (activeRec) activeRec.cancel(); }

  // Кнопка микрофона с кольцом-таймером, живой расшифровкой и запасным режимом без распознавания.
  function mountRecorder(zone, opts) {
    const R = 54, C = 2 * Math.PI * R;
    let state = 'idle', listener = null, started = 0, timer = null, text = '', noSpeech = !Speech.supported;
    zone.innerHTML = `<div class="mic-zone">
        <div class="mic-ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="${R}"/><circle class="fg" cx="60" cy="60" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
          <button class="mic-btn" aria-label="Говорить">🎤</button></div>
        <div class="mic-time">${fmtTime(opts.seconds)}</div>
        <div class="mic-hint">${noSpeech ? 'Распознавание речи недоступно — можно говорить вслух по таймеру' : 'Нажмите и говорите'}</div>
      </div>
      <div class="live"></div>
      <div class="rec-result"></div>`;
    const btn = $('.mic-btn', zone), fg = $('.fg', zone), time = $('.mic-time', zone), hint = $('.mic-hint', zone), live = $('.live', zone), out = $('.rec-result', zone);

    const self = {
      cancel() { clearInterval(timer); if (listener) listener.stop(); listener = null; state = 'idle'; if (activeRec === self) activeRec = null; },
    };

    function draw(left) {
      fg.style.strokeDashoffset = String(C * (1 - left / opts.seconds));
      time.textContent = fmtTime(left);
    }
    function showLive() {
      live.innerHTML = noSpeech
        ? '<div class="transcript empty">Говорите вслух — таймер идёт</div>'
        : `<div class="wave"><i></i><i></i><i></i><i></i><i></i></div><div class="transcript ${text ? '' : 'empty'}">${text ? esc(text) : 'Слушаю…'}</div>`;
    }

    async function start() {
      FX.unlock();
      stopAllRecording();
      activeRec = self;
      text = ''; out.innerHTML = '';
      state = 'rec';
      btn.classList.add('rec'); btn.textContent = '⏹';
      hint.textContent = 'Нажмите, чтобы закончить';
      sfx('start'); hap('light');
      if (opts.onStart) opts.onStart();
      if (!noSpeech) {
        listener = Speech.create();
        const ok = await listener.start((t) => { text = t; showLive(); if (opts.onText) opts.onText(t, (Date.now() - started) / 1000); }, (err) => {
          noSpeech = true; listener = null;
          toast(err === 'not-allowed' ? 'Нет доступа к микрофону — разрешите его в настройках' : 'Распознавание недоступно — говорите по таймеру');
          showLive();
        });
        if (!ok) { noSpeech = true; listener = null; }
      }
      started = Date.now();
      showLive();
      draw(opts.seconds);
      timer = setInterval(() => {
        const left = opts.seconds - (Date.now() - started) / 1000;
        draw(left);
        if (opts.onTick) opts.onTick((Date.now() - started) / 1000);
        if (left <= 0) stop();
      }, 200);
    }

    async function stop() {
      if (state !== 'rec') return;
      state = 'done';
      clearInterval(timer);
      const secs = Math.min(opts.seconds, (Date.now() - started) / 1000);
      if (listener) { const final = await listener.stop(); if (final && final.length >= text.length) text = final; listener = null; }
      activeRec = null;
      btn.classList.remove('rec'); btn.textContent = '🔁';
      hint.textContent = 'Нажмите, чтобы попробовать ещё раз';
      draw(0);
      live.innerHTML = '';
      if (opts.onStop) opts.onStop();
      if (noSpeech) {
        out.innerHTML = `<div class="notice">Без распознавания я не слышу слова, но таймер вы выдержали. Получилось сказать вслух?</div>
          <button class="btn" data-yes style="margin-top:12px">Да, получилось!</button>`;
        $('[data-yes]', out).onclick = () => {
          const r = opts.onDone('', secs, true);
          out.innerHTML = r.html; if (r.after) r.after();
        };
        return;
      }
      const r = opts.onDone(text, secs, false);
      out.innerHTML = r.html;
      if (r.after) r.after();
      setTimeout(() => out.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }

    btn.onclick = () => (state === 'rec' ? stop() : start());
    draw(opts.seconds);
    if (Speech.supported) Speech.checkAvailable().then((ok) => { if (!ok) { noSpeech = true; hint.textContent = 'Распознавание речи недоступно — можно говорить вслух по таймеру'; } });
    return self;
  }

  // ------------------------------------------------------------------ вкладка «Тренажёр»
  let trainerMode = 'pitch';
  let pitchTopic = null;
  let improv = null;

  function renderTrainer(v) {
    if (!pitchTopic) pitchTopic = pick(window.GOVORUN_PITCH_TOPICS);
    v.innerHTML = `<div class="arena">
      <div class="seg">
        <button class="seg-btn ${trainerMode === 'pitch' ? 'on' : ''}" data-m="pitch">🛗 Лифтовая презентация</button>
        <button class="seg-btn ${trainerMode === 'improv' ? 'on' : ''}" data-m="improv">🎲 Импровизация</button>
      </div>
      <div id="tr-body"></div>
    </div>`;
    $$('.seg-btn', v).forEach((b) => b.onclick = () => { stopAllRecording(); trainerMode = b.dataset.m; sfx('tap'); hap('light'); renderTrainer(v); });
    if (trainerMode === 'pitch') renderPitch($('#tr-body', v)); else renderImprov($('#tr-body', v));
  }

  function rewardSpeech(kind, a) {
    let gems = 5;
    if (a.words >= 30) gems += 5;
    if (a.words >= 10 && a.fillerTotal === 0) gems += 5;
    S.stats[kind]++;
    S.stats.speeches++;
    if (a.wpm && a.words >= 15) S.stats.bestWpm = Math.max(S.stats.bestWpm, a.wpm);
    const grew = markActiveDay();
    const heart = addHeart();
    addGems(gems);
    if (grew) renderHeader('streak');
    return { gems, heart };
  }

  function renderPitch(box) {
    box.innerHTML = `<div class="arena-hero"><div class="ico">🛗</div>
        <h2>Лифтовая презентация</h2>
        <p>У вас 45 секунд — как поездка в лифте с важным человеком. Убедите его!</p></div>
      <div class="topic-card"><small>Ваша тема</small><b id="topic">${esc(pitchTopic)}</b>
        <button class="topic-new" id="new-topic">🔄 Другая тема</button></div>
      <div class="rules">
        <div class="rule"><span>🪝</span>Зацепите с первой фразы</div>
        <div class="rule"><span>3️⃣</span>Три аргумента — не больше</div>
        <div class="rule"><span>🚀</span>Закончите призывом к действию</div>
      </div>
      <div id="pitch-rec"></div>`;
    $('#new-topic', box).onclick = () => { stopAllRecording(); pitchTopic = pick(window.GOVORUN_PITCH_TOPICS.filter((t) => t !== pitchTopic)); sfx('word'); hap('light'); renderPitch(box); };
    mountRecorder($('#pitch-rec', box), {
      seconds: PITCH_SECONDS,
      id: 'pitch',
      onDone: (text, secs, honor) => {
        const a = analyzeSpeech(text, secs);
        if (honor) {
          const r = rewardSpeech('pitches', { words: 0, fillerTotal: 1, wpm: 0 });
          return { html: `<div class="verdict card"><b>🎉 +${r.gems} 💎${r.heart ? ' · +1 ❤️' : ''}</b><p>Речь засчитана! Для подсчёта темпа и слов-паразитов нужен микрофон.</p></div>` };
        }
        const r = a.words >= 4 ? rewardSpeech('pitches', a) : null;
        return {
          html: (r ? `<div class="reward-strip">🎉 +${r.gems} 💎${r.heart ? ' · +1 ❤️' : ''}</div>` : '<div class="notice">Слишком коротко — попробуйте сказать хотя бы пару предложений.</div>') +
            speechReportHTML(a, 'pitch', { extra: `<div class="card"><b>${a.words}</b><small>${plural(a.words, 'слово', 'слова', 'слов')}</small></div><div class="card"><b>${Math.round(secs)} с</b><small>длительность</small></div>` }),
          after: () => fillParrot('pitch', a, { technique: null }, { mode: 'pitch', topic: pitchTopic, transcript: text, wpm: a.wpm, fillers: a.fillers, seconds: secs }),
        };
      },
    });
  }

  function renderImprov(box) {
    box.innerHTML = `<div class="arena-hero"><div class="ico">🎲</div>
        <h2>Импровизация</h2>
        <p>Начните любой рассказ. Каждые 10 секунд появится новое слово — вплетите его в историю!</p></div>
      <div class="arena-live" id="imp-live">
        <div class="word-card idle">Готовы?</div>
        <div class="word-sub">6 слов · 60 секунд</div>
        <div class="used-words" id="imp-words"></div>
      </div>
      <div id="imp-rec"></div>`;
    const wordsPool = shuffle(window.GOVORUN_ARENA_WORDS);
    improv = { words: [], hits: new Set() };
    const stem = (w) => norm(w).slice(0, Math.max(3, Math.min(5, w.length - 2)));
    const drawWord = (hit) => {
      const w = improv.words[improv.words.length - 1];
      $('#imp-live').querySelector('.word-card').outerHTML = `<div class="word-card ${hit ? 'hit' : ''}">${esc(w)}</div>`;
    };
    const drawUsed = () => {
      $('#imp-words').innerHTML = improv.words.map((w) => `<span class="wtag ${improv.hits.has(w) ? 'hit' : ''}">${improv.hits.has(w) ? '✓ ' : ''}${esc(w)}</span>`).join('');
    };
    const checkHits = (t) => {
      const toks = t.split(/\s+/).map(norm);
      improv.words.forEach((w) => {
        if (!improv.hits.has(w) && toks.some((x) => x.startsWith(stem(w)))) {
          improv.hits.add(w); sfx('correct'); hap('success');
          if (w === improv.words[improv.words.length - 1]) drawWord(true);
        }
      });
      drawUsed();
    };
    mountRecorder($('#imp-rec', box), {
      seconds: IMPROV_SECONDS,
      id: 'improv',
      onStart: () => {
        improv.words = [wordsPool[0]]; improv.hits = new Set();
        drawWord(false); drawUsed();
        $('#imp-live .word-sub').textContent = 'Вплетите это слово в рассказ';
      },
      onTick: (el) => {
        const n = Math.min(6, Math.floor(el / 10) + 1);
        if (n > improv.words.length) { improv.words.push(wordsPool[n - 1]); sfx('word'); hap('light'); drawWord(false); drawUsed(); }
      },
      onText: (t) => checkHits(t),
      onDone: (text, secs, honor) => {
        checkHits(text || '');
        const a = analyzeSpeech(text, secs);
        $('#imp-live .word-sub').textContent = 'Раунд окончен!';
        if (honor) {
          const r = rewardSpeech('improv', { words: 0, fillerTotal: 1, wpm: 0 });
          return { html: `<div class="verdict card"><b>🎉 +${r.gems} 💎${r.heart ? ' · +1 ❤️' : ''}</b><p>Раунд засчитан! Чтобы считать вплетённые слова и темп, нужен микрофон.</p></div>` };
        }
        const r = a.words >= 4 ? rewardSpeech('improv', a) : null;
        if (r && improv.hits.size) addGems(improv.hits.size * 2);
        return {
          html: (r ? `<div class="reward-strip">🎉 +${r.gems + improv.hits.size * 2} 💎${r.heart ? ' · +1 ❤️' : ''}</div>` : '<div class="notice">Слишком коротко — попробуйте рассказать историю подлиннее.</div>') +
            speechReportHTML(a, 'improv', { extra: `<div class="card"><b style="color:var(--purple)">${improv.hits.size}/${improv.words.length}</b><small>слов вплетено</small></div><div class="card"><b>${a.words}</b><small>${plural(a.words, 'слово', 'слова', 'слов')} всего</small></div>` }),
          after: () => fillParrot('improv', a, { technique: null }, { mode: 'improv', words: improv.words, transcript: text, wpm: a.wpm, fillers: a.fillers, seconds: secs }),
        };
      },
    });
  }

  // ------------------------------------------------------------------ вкладка «Конструктор»
  const BSTEPS = window.GOVORUN_BUILDER_STEPS;

  function cheatText() {
    const a = S.builder.answers;
    return ['🎤 Шпаргалка для выступления', '']
      .concat(BSTEPS.map((s, i) => `${i + 1}. ${s.emoji} ${s.title.toUpperCase()}\n${(a[s.key] || '').trim() || '—'}`))
      .concat(['', 'Собрано в приложении «Говорун»'])
      .join('\n\n').replace(/\n\n\n+/g, '\n\n');
  }

  function renderBuilder(v) {
    const b = S.builder;
    if (b.step >= BSTEPS.length) return renderCheat(v);
    const s = BSTEPS[b.step];
    v.innerHTML = `<div class="wizard">
      <div class="wz-head">
        <h2>Конструктор речи</h2>
        <p>Проблема → Интрига → Решение → Призыв</p>
      </div>
      <div class="wz-steps">${BSTEPS.map((x, i) => `<button class="wz-dot ${i < b.step ? 'done' : ''} ${i === b.step ? 'on' : ''}" data-i="${i}" style="--c:${x.color}"><span>${i < b.step ? '✓' : x.emoji}</span><small>${esc(x.title)}</small></button>`).join('')}</div>
      <div class="wz-card" style="--c:${s.color}">
        <div class="wz-kicker">Шаг ${b.step + 1} из ${BSTEPS.length} · ${s.emoji} ${esc(s.title)}</div>
        <h3>${esc(s.question)}</h3>
        <textarea id="wz-input" rows="4" maxlength="500" placeholder="Напишите своими словами…">${esc(b.answers[s.key] || '')}</textarea>
        <div class="wz-tip"><span>🦜</span><div>${esc(s.tip)}</div></div>
        <button class="wz-example" id="wz-ex">💡 Вставить пример: <i>${esc(s.example)}</i></button>
      </div>
      <div class="wz-nav">
        ${b.step > 0 ? '<button class="btn ghost" id="wz-back">Назад</button>' : ''}
        <button class="btn" id="wz-next" ${(b.answers[s.key] || '').trim() ? '' : 'disabled'}>${b.step === BSTEPS.length - 1 ? 'Собрать шпаргалку' : 'Далее'}</button>
      </div>
    </div>`;
    const input = $('#wz-input', v);
    input.addEventListener('input', () => { b.answers[s.key] = input.value; save(); $('#wz-next', v).disabled = !input.value.trim(); });
    $('#wz-ex', v).onclick = () => { input.value = s.example; b.answers[s.key] = s.example; save(); $('#wz-next', v).disabled = false; sfx('tile'); hap('light'); };
    $('#wz-next', v).onclick = () => { b.step++; save(); sfx(b.step >= BSTEPS.length ? 'win' : 'correct'); hap('success'); if (b.step >= BSTEPS.length) FX.confetti(90); renderBuilder(v); v.scrollTop = 0; };
    const back = $('#wz-back', v);
    if (back) back.onclick = () => { b.step--; save(); sfx('tap'); hap('light'); renderBuilder(v); };
    $$('.wz-dot', v).forEach((d) => d.onclick = () => {
      const i = +d.dataset.i;
      if (i <= b.step || BSTEPS.slice(0, i).every((x) => (b.answers[x.key] || '').trim())) { b.step = i; save(); sfx('tap'); renderBuilder(v); }
    });
  }

  function renderCheat(v) {
    const a = S.builder.answers;
    v.innerHTML = `<div class="wizard">
      <div class="wz-head"><h2>Ваша шпаргалка готова! 🎉</h2><p>Прочитайте вслух 3 раза — и выступление пойдёт как по маслу.</p></div>
      <div class="cheat">
        ${BSTEPS.map((s, i) => `<div class="cheat-row" style="--c:${s.color};animation-delay:${i * 0.1}s">
          <div class="cheat-label">${s.emoji} ${i + 1}. ${esc(s.title)}</div>
          <div class="cheat-text">${esc((a[s.key] || '').trim() || '—')}</div>
        </div>`).join('')}
      </div>
      <button class="btn blue" id="copy">📋 Скопировать текст</button>
      <button class="btn" id="share">📤 Поделиться</button>
      <button class="btn ghost" id="rehearse">🎤 Отрепетировать в Тренажёре</button>
      <button class="btn link" id="edit">✏️ Изменить ответы</button>
      <button class="btn link danger" id="reset">Начать новую речь</button>
    </div>`;
    $('#copy', v).onclick = async () => { hap('success'); (await copyText(cheatText())) ? toast('Текст скопирован 📋') : toast('Не удалось скопировать'); };
    $('#share', v).onclick = async () => { hap('light'); await shareText(cheatText()); };
    $('#rehearse', v).onclick = () => {
      pitchTopic = `Ваша речь: ${(a.problem || '').trim().slice(0, 80)}${(a.problem || '').length > 80 ? '…' : ''}`;
      trainerMode = 'pitch'; go('trainer');
    };
    $('#edit', v).onclick = () => { S.builder.step = 0; save(); renderBuilder(v); };
    $('#reset', v).onclick = () => sheet(`<div class="s-ico">🗑️</div><h3>Начать новую речь?</h3><p>Текущие ответы удалятся.</p>
      <button class="btn red" data-y>Да, начать заново</button><button class="btn link" data-n>Отмена</button>`, (s) => {
      $('[data-y]', s).onclick = () => { S.builder = { step: 0, answers: {} }; save(); closeSheet(); renderBuilder(v); };
      $('[data-n]', s).onclick = closeSheet;
    });
  }

  async function copyText(t) {
    try { if (NativeClipboard) { await NativeClipboard.write({ string: t }); return true; } } catch (e) { /* дальше */ }
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; } } catch (e) { /* дальше */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  async function shareText(t) {
    try { if (NativeShare) { await NativeShare.share({ title: 'Шпаргалка для выступления', text: t, dialogTitle: 'Поделиться шпаргалкой' }); return; } } catch (e) { return; }
    try { if (navigator.share) { await navigator.share({ title: 'Шпаргалка для выступления', text: t }); return; } } catch (e) { return; }
    if (await copyText(t)) toast('Поделиться нельзя — текст скопирован 📋');
  }

  // ------------------------------------------------------------------ профиль (из шапки)
  const AVATARS = ['🦜', '🦊', '🐼', '🦁', '🐸', '🐙', '🦉', '🐯', '🐨', '🦄'];
  function achievements() {
    const done = Object.keys(S.completed).length;
    return [
      ['🌱', 'Первый шаг', 'Пройти первый урок', done >= 1],
      ['🎯', 'Без ошибок', 'Пройти урок без ошибок', S.stats.perfect >= 1],
      ['🎙️', 'Голос найден', 'Выполнить голосовой челлендж', S.stats.voice >= 1],
      ['🛗', 'Лифт до успеха', 'Сделать лифтовую презентацию', S.stats.pitches >= 1],
      ['🎲', 'Импровизатор', 'Пройти раунд импровизации', S.stats.improv >= 1],
      ['🔥', 'Три дня огня', 'Заниматься 3 дня подряд', S.bestStreak >= 3],
      ['📝', 'Архитектор речи', 'Собрать шпаргалку в Конструкторе', S.builder.step >= BSTEPS.length],
      ['🏆', 'Мастер модуля', 'Пройти все 4 кейса', done >= LESSONS.length],
    ];
  }

  function openProfile() {
    sfx('tap'); hap('light');
    const el = $('#profile');
    el.classList.remove('hidden');
    drawProfile();
  }
  function closeProfile() { const el = $('#profile'); el.classList.add('hidden'); el.innerHTML = ''; renderHeader(); }

  function drawProfile() {
    const el = $('#profile');
    const r = rank(); const nr = nextRank();
    const pct = nr ? Math.round(((S.gems - r[0]) / (nr[0] - r[0])) * 100) : 100;
    const done = Object.keys(S.completed).length;
    const ach = achievements();
    el.innerHTML = `<div class="lesson-inner">
      <div class="lesson-top"><button class="x-btn" id="p-close" aria-label="Назад">←</button><b style="font-size:18px;font-weight:900">Профиль</b></div>
      <div class="lesson-body profile">
        <div class="user-card">
          <button class="avatar" id="p-ava" aria-label="Сменить аватар">${S.avatar}</button>
          <div style="flex:1;min-width:0">
            <h2><span>${esc(S.name)}</span><button id="p-name" aria-label="Изменить имя">✏️</button></h2>
            <div class="rank">${r[2]} ${esc(r[1])}${nr ? ` · до «${esc(nr[1])}» ${nr[0] - S.gems} 💎` : ''}</div>
            <div class="lvl-bar"><i style="width:${pct}%"></i></div>
          </div>
        </div>
        <div class="section-title">Статистика</div>
        <div class="stats-grid">
          <div class="stat-card"><span>🔥</span><div><b>${streakNow()}</b><small>дней подряд · рекорд ${S.bestStreak}</small></div></div>
          <div class="stat-card"><span>💎</span><div><b>${S.gems}</b><small>очков харизмы</small></div></div>
          <div class="stat-card"><span>📚</span><div><b>${done}/${LESSONS.length}</b><small>кейсов пройдено</small></div></div>
          <div class="stat-card"><span>🎯</span><div><b>${S.stats.perfect}</b><small>уроков без ошибок</small></div></div>
          <div class="stat-card"><span>🎤</span><div><b>${S.stats.speeches}</b><small>речей записано</small></div></div>
          <div class="stat-card"><span>⚡</span><div><b>${S.stats.bestWpm || '—'}</b><small>лучший темп, слов/мин</small></div></div>
        </div>
        <div class="section-title">Колода приёмов <small>${done}/${LESSONS.length}</small></div>
        <div class="deck">${LESSONS.map((l) => {
          const t = l.technique, open = isDone(l.id);
          return `<div class="tcard ${open ? '' : 'locked'}" style="--tc:${t.color}" data-open="${open ? 1 : 0}">
            <div class="tcard-inner">
              <div class="tface tfront"><div class="t-emoji">${open ? t.emoji : '❓'}</div><b>${open ? esc(t.name) : 'Закрыто'}</b><small>${open ? 'Нажмите, чтобы перевернуть' : esc(l.title)}</small></div>
              <div class="tface tback"><b>${t.emoji} ${esc(t.name)}</b><p>${esc(t.short)}</p><div class="formula">${esc(t.example)}</div></div>
            </div></div>`;
        }).join('')}</div>
        <div class="section-title">Достижения <small>${ach.filter((a) => a[3]).length}/${ach.length}</small></div>
        <div class="ach-list">${ach.map((a) => `<div class="ach ${a[3] ? '' : 'locked'}"><div class="a-ico">${a[0]}</div><div><b>${esc(a[1])}</b><small>${esc(a[2])}</small></div>${a[3] ? '<span class="a-ok">✓</span>' : ''}</div>`).join('')}</div>
        <div class="settings">
          <button class="set-row" id="p-sound"><span>🔊 Звуки и вибрация</span><span class="switch ${S.sound ? 'on' : ''}"></span></button>
          <button class="set-row danger" id="p-reset"><span>🗑️ Сбросить прогресс</span><span>›</span></button>
        </div>
        <p class="app-ver">Говорун 1.0 · прогресс хранится только на этом устройстве</p>
      </div></div>`;
    $('#p-close').onclick = closeProfile;
    $('#p-ava').onclick = () => { S.avatar = AVATARS[(AVATARS.indexOf(S.avatar) + 1) % AVATARS.length]; save(); sfx('tile'); hap('light'); drawProfile(); };
    $('#p-name').onclick = () => sheet(`<div class="s-ico">✏️</div><h3>Как вас зовут?</h3><input id="nm" maxlength="24" value="${esc(S.name)}"><button class="btn" data-ok>Сохранить</button>`, (s) => {
      const i = $('#nm', s); setTimeout(() => i.focus(), 200);
      $('[data-ok]', s).onclick = () => { S.name = i.value.trim() || 'Оратор'; save(); closeSheet(); drawProfile(); };
    });
    $$('.tcard', el).forEach((c) => c.onclick = () => {
      if (c.dataset.open !== '1') { hap('light'); toast('Пройдите урок, чтобы открыть карточку'); return; }
      c.classList.toggle('flipped'); sfx('tile'); hap('light');
    });
    $('#p-sound').onclick = () => { S.sound = !S.sound; FX.setEnabled(S.sound); save(); drawProfile(); };
    $('#p-reset').onclick = () => sheet(`<div class="s-ico">⚠️</div><h3>Сбросить весь прогресс?</h3><p>Уроки, очки, огонёк и шпаргалка удалятся. Это нельзя отменить.</p>
      <button class="btn red" data-y>Сбросить</button><button class="btn link" data-n>Отмена</button>`, (s) => {
      $('[data-y]', s).onclick = () => { S = DEFAULT(); save(); closeSheet(); closeProfile(); go('stories'); toast('Прогресс сброшен'); };
      $('[data-n]', s).onclick = closeSheet;
    });
  }

  // ------------------------------------------------------------------ старт
  function init() {
    FX.setEnabled(S.sound);
    if (S.lastDay && daysBetween(S.lastDay, dayKey()) > 1 && S.streak) { S.streak = 0; save(); }
    $$('.tab').forEach((b) => b.addEventListener('click', () => { sfx('tap'); hap('light'); go(b.dataset.tab); }));
    $('#stat-streak').onclick = streakSheet;
    $('#stat-gems').onclick = gemsSheet;
    $('#stat-hearts').onclick = () => heartsSheet();
    $('#me-btn').onclick = openProfile;
    document.addEventListener('pointerdown', () => FX.unlock(), { once: true });
    setInterval(() => renderHeader(), 60000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopAllRecording(); else renderHeader(); });

    // Кнопка «Назад» на Android: лист → урок → профиль → вкладка «Истории» → выход.
    if (NativeApp) {
      NativeApp.addListener('backButton', () => {
        if (sheetClose) closeSheet();
        else if (L) confirmClose();
        else if (!$('#profile').classList.contains('hidden')) closeProfile();
        else if (tab !== 'stories') go('stories');
        else NativeApp.exitApp();
      });
    }
    render();
  }

  // Для отладки и автотестов.
  window.Govorun = { state: () => S, analyzeSpeech, localParrot, go };

  init();
})();

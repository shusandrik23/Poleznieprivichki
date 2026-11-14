// Движок сессии: проходит сценарий техники в режиме «Соло», «Ведёт приложение» или «В паре».
import { h, fill, toast, confirmBox } from './ui.js';
import { speak, stopSpeak, vibrate, chime, listen, keepAwake } from './speech.js';
import { sessions, uid } from './store.js';
import { openFeelings, chip } from './feelings.js';
import { newMap, mapEditor, mapPreview, exportMap, blocksOf } from './canvas.js';
import { computeStops, timelineView } from './timeline.js';
import { burnView } from './burn.js';
import { MODES } from './techniques.js';
import { beliefs } from './beliefs.js';

const clone = o => JSON.parse(JSON.stringify(o));
// replaceChildren/append без null и false
const put = (el, ...k) => el.replaceChildren(...k.flat().filter(x => x != null && x !== false));
const add = (el, ...k) => el.append(...k.flat().filter(x => x != null && x !== false));

export function runSession(root, tech, mode, { onExit, swapped = false, skipIntro = false } = {}) {
  const S = {
    id: uid(), tech, mode, start: Date.now(),
    stack: [{ type: 'root', steps: tech.script, i: 0 }],
    vars: {},
    data: { fields: {}, scales: {}, log: [], loops: {}, map: tech.preset ? newMap(tech.preset) : null, timeline: null },
    history: [],
  };
  let rtoken = 0, stopListen = () => {}, cleanup = [], finished = false;
  const isGuide = mode === 'guide', isPair = mode === 'pair';
  const vars = () => ({ ...S.data.fields, ...S.vars });
  const T = text => fill(text, vars(), S);

  // ---------- Обход сценария ----------
  function setEachVars(f) {
    const it = f.items[f.idx];
    S.vars.n = f.idx + 1; S.vars.total = f.items.length;
    if (it && typeof it === 'object') { Object.assign(S.vars, it); S.vars[f.as] = it.label; }
    else S.vars[f.as] = it;
  }
  function resolve() {
    for (let guard = 0; guard < 5000; guard++) {
      const f = S.stack[S.stack.length - 1];
      if (f.i >= f.steps.length) {
        if (f.type === 'root') return { kind: 'end' };
        if (f.type === 'loop') return { kind: 'loop', frame: f };
        if (f.type === 'each') {
          f.idx++;
          if (f.idx < f.items.length) { f.i = 0; setEachVars(f); continue; }
          S.stack.pop(); S.stack[S.stack.length - 1].i++; continue;
        }
      }
      const st = f.steps[f.i];
      if ((st.only && !st.only.includes(mode)) || (st.if && !st.if(S))) { f.i++; continue; }
      if (st.t === 'do') { st.fn(S); f.i++; continue; }
      if (st.t === 'loop') { S.stack.push({ type: 'loop', steps: st.steps, i: 0, step: st, count: 1 }); continue; }
      if (st.t === 'each') {
        const items = (typeof st.items === 'function' ? st.items(S) : st.items) || [];
        if (!items.length) { f.i++; continue; }
        const fr = { type: 'each', steps: st.steps, i: 0, items: clone(items), idx: 0, as: st.as };
        S.stack.push(fr); setEachVars(fr); continue;
      }
      return { kind: 'step', step: st, frame: f };
    }
    return { kind: 'end' };
  }
  const snapshot = () => {
    S.history.push({ stack: S.stack.map(f => ({ ...f })), vars: { ...S.vars }, data: clone(S.data) });
    if (S.history.length > 200) S.history.shift();
  };
  function go(fn) { snapshot(); fn(); render(); }
  const next = () => go(() => { S.stack[S.stack.length - 1].i++; });
  const loopMore = () => go(() => { const f = S.stack[S.stack.length - 1]; f.count++; f.i = 0; S.data.loops[f.step.id] = (S.data.loops[f.step.id] || 1) + 1; });
  const loopDone = () => go(() => { S.stack.pop(); S.stack[S.stack.length - 1].i++; });
  function back() {
    const p = S.history.pop();
    if (!p) return;
    S.stack = p.stack; S.vars = p.vars; S.data = p.data; render();
  }
  const logAnswer = (q, a) => { if (a && a.trim()) S.data.log.push({ q, a: a.trim(), t: Date.now() }); };

  // ---------- Каркас экрана ----------
  const titleEl = h('div', { class: 's-title' });
  const body = h('div', { class: 's-body' });
  const foot = h('div', { class: 's-foot' });
  const head = h('header', { class: 's-head' },
    h('button', { class: 'icon-btn', 'aria-label': 'Выйти', onclick: exit }, '✕'),
    titleEl,
    h('button', { class: 'icon-btn', title: 'Таблица чувств', 'aria-label': 'Таблица чувств', onclick: () => pickFeelings() }, '💗'),
    isGuide && h('button', { class: 'icon-btn', title: 'Повторить', 'aria-label': 'Повторить фразу', onclick: () => sayCurrent() }, '🔁'));
  const wrap = h('div', { class: `session mode-${mode}` }, head, body, foot);
  root.replaceChildren(wrap);

  let currentText = '', currentArea = null, onFeelings = null;
  function sayCurrent() { if (isGuide && currentText) return speak(currentText); return Promise.resolve(); }
  function pickFeelings() {
    openFeelings({
      onDone: words => {
        if (!words.length) return;
        if (onFeelings) onFeelings(words);
        else if (currentArea) { currentArea.value = (currentArea.value ? currentArea.value.trim() + ', ' : '') + words.join(', '); currentArea.dispatchEvent(new Event('input')); }
        else { logAnswer('Чувства', words.join(', ')); toast('Записано: ' + words.join(', ')); }
      },
    });
  }

  function setTitle(extra) {
    const loopF = [...S.stack].reverse().find(f => f.type === 'loop');
    const eachF = [...S.stack].reverse().find(f => f.type === 'each');
    titleEl.replaceChildren(
      h('b', null, tech.name),
      h('small', null, [MODES[mode].icon + ' ' + (isPair ? 'Экран суфлёра' : MODES[mode].name),
        eachF ? ` · ${eachF.idx + 1}/${eachF.items.length}` : '',
        loopF ? ` · круг ${loopF.count}` : '', extra || ''].join('')));
  }

  // Подпись над текстом в режиме пары
  const pairLabel = () => isPair ? h('div', { class: 'pair-label' }, 'Прочитайте партнёру:') : null;
  const hintEl = st => (isPair && st.hint) ? h('div', { class: 'hint' }, h('b', null, 'Для ведущего: '), T(st.hint)) : null;
  const mainText = (st, txt) => h('div', { class: 'q' + (st.big || isGuide || isPair ? ' big' : '') }, st.title && h('div', { class: 'q-title' }, T(st.title)), txt);

  function footer(nextLabel = 'Далее', onNext = next, { disabled = false, extra = [] } = {}) {
    put(foot, 
      h('button', { class: 'btn ghost', disabled: !S.history.length, onclick: back }, '← Назад'),
      ...extra,
      h('button', { class: 'btn primary', disabled, onclick: onNext }, nextLabel));
  }
  // В режиме гида: весь экран — зона касания «дальше»
  function guideTap(onTap, label = 'Коснись экрана, когда будешь готов(а)') {
    const zone = h('div', { class: 'tap-zone', role: 'button', tabindex: 0, onclick: e => { if (e.target.closest('button,textarea,input,a,.no-tap')) return; vibrate(25); onTap(); } },
      h('div', { class: 'tap-hint' }, '👆 ' + label));
    return zone;
  }

  // ---------- Шаги ----------
  function render() {
    const my = ++rtoken;
    cleanup.forEach(f => f()); cleanup = [];
    stopSpeak(); stopListen(); stopListen = () => {};
    currentArea = null; onFeelings = null; currentText = '';
    const r = resolve();
    setTitle();
    body.scrollTop = 0;
    wrap.classList.remove('split');
    if (r.kind === 'end') return renderEnd();
    if (r.kind === 'loop') return renderLoop(r.frame, my);
    const st = r.step;
    const fn = R[st.t] || R.say;
    fn(st, my);
    if (isGuide && !['timer', 'scale'].includes(st.t)) {
      stopListen = listen(cmd => { if (cmd === 'next' && my === rtoken) primary(); });
    }
  }
  let primary = () => next();

  const R = {
    say(st, my) {
      const txt = T(st.text);
      currentText = (isPair && st.pair) ? T(st.pair) : txt;
      put(body, pairLabel(), mainText(st, currentText), hintEl(st));
      primary = next;
      if (isGuide) { add(body, guideTap(next)); footer('Дальше'); speak(txt).then(() => { if (my === rtoken && st.auto) next(); }); }
      else footer();
    },
    ask(st, my) {
      const txt = T(st.text);
      currentText = txt;
      const area = h('textarea', { class: 'input', rows: isPair ? 2 : 4, placeholder: isPair ? 'Ответ партнёра (по желанию)' : 'Твой ответ (по желанию)', value: st.key ? (S.data.fields[st.key] || '') : '' });
      currentArea = area;
      const commit = () => { const v = area.value; if (st.key) S.data.fields[st.key] = v.trim(); logAnswer(txt, v); };
      const feelBtn = st.feel && h('button', { class: 'btn soft', onclick: () => pickFeelings() }, '💗 Не могу назвать — Таблица чувств');
      primary = () => { commit(); next(); };
      const quick = st.quick && h('div', { class: 'chips quick no-tap' }, st.quick.map(q => h('button', { class: 'chip big', style: { '--c': '#5b6ee1' }, onclick: () => {
        vibrate(20);
        if (st.single) { area.value = q; commit(); next(); return; }
        area.value = (area.value.trim() ? area.value.trim() + ', ' : '') + q; area.dispatchEvent(new Event('input'));
      } }, q)));
      if (isGuide) {
        const writeToggle = h('details', { class: 'no-tap write-box', open: !!st.belief || undefined }, h('summary', null, '✍️ Записать ответ'), area);
        put(body, mainText(st, txt), quick, feelBtn, writeToggle, guideTap(primary, st.belief ? 'Запиши и коснись экрана' : 'Ответь про себя или вслух — и коснись экрана'));
        footer('Дальше', primary);
        speak(txt);
      } else {
        put(body, pairLabel(), mainText(st, txt), hintEl(st), quick, feelBtn, isPair && !st.key && !st.belief ? h('details', { class: 'write-box' }, h('summary', null, '✍️ Записать ответ партнёра'), area) : area);
        footer('Далее', primary);
      }
    },
    input(st) {
      const txt = T(st.text);
      currentText = txt;
      const inp = h('input', { class: 'input', placeholder: st.placeholder || '', value: S.data.fields[st.key] || '' });
      const commit = () => { S.data.fields[st.key] = inp.value.trim() || st.def || ''; };
      primary = () => { commit(); next(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') primary(); });
      put(body, h('div', { class: 'q' }, txt), isPair && h('p', { class: 'muted small' }, 'Спросите партнёра и запишите.'), inp);
      footer('Далее', primary);
      if (isGuide) speak(txt);
      setTimeout(() => inp.focus(), 50);
    },
    scale(st, my) {
      const txt = T(st.text);
      currentText = txt;
      let val = S.data.scales[st.key];
      const btns = h('div', { class: 'scale' }, Array.from({ length: 10 }, (_, i) => h('button', {
        class: 'scale-btn' + (val === i + 1 ? ' on' : ''), style: { '--k': i / 9 },
        onclick: e => {
          val = i + 1; S.data.scales[st.key] = val; vibrate(20);
          btns.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on');
          footer('Далее', next);
          if (isGuide) setTimeout(() => { if (my === rtoken) next(); }, 700);
        },
      }, i + 1)));
      put(body, pairLabel(), h('div', { class: 'q big' }, txt), hintEl(st), btns, h('div', { class: 'scale-legend muted small' }, h('span', null, '1 — слабо'), h('span', null, '10 — очень сильно')));
      primary = next;
      footer(val ? 'Далее' : 'Пропустить', next);
      if (isGuide) speak(txt + ' Выбери число на экране.');
    },
    timer(st, my) {
      const txt = T(st.text);
      currentText = txt;
      let left = st.sec, running = false, iv = null;
      const num = h('div', { class: 'timer-num' });
      const ring = h('div', { class: 'timer-ring' + (st.breath ? ' breath' : '') }, h('div', { class: 'breath-word' }), num);
      const ctl = h('button', { class: 'btn soft' }, 'Запустить таймер');
      const show = () => { num.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; ring.style.setProperty('--p', 1 - left / st.sec); };
      const word = ring.querySelector('.breath-word');
      let bt = 0;
      const tick = () => {
        left--; bt++; show();
        if (st.breath) word.textContent = (bt % 10) < 4 ? 'вдох' : 'выдох';
        if (left <= 0) { stop(); chime(); vibrate([80, 60, 80]); num.textContent = '✓'; ctl.remove(); if (isGuide && my === rtoken) setTimeout(() => my === rtoken && next(), 1200); }
      };
      const start = () => { if (running || left <= 0) return; running = true; ring.classList.add('run'); ctl.textContent = 'Пауза'; if (st.breath) word.textContent = 'вдох'; iv = setInterval(tick, 1000); };
      const stop = () => { running = false; ring.classList.remove('run'); clearInterval(iv); ctl.textContent = 'Продолжить'; };
      ctl.onclick = () => (running ? stop() : start());
      cleanup.push(() => clearInterval(iv));
      show();
      put(body, pairLabel(), mainText(st, txt), hintEl(st), ring, ctl, isPair && h('p', { class: 'muted small center' }, 'Дайте партнёру время. Таймер подаст мягкий сигнал.'));
      primary = next;
      if (isGuide) {
        add(body, guideTap(next, 'Коснись, чтобы не ждать таймер'));
        footer('Дальше');
        speak(txt).then(() => { if (my === rtoken) start(); });
      } else footer();
    },
    choice(st) {
      const txt = T(st.text);
      currentText = txt;
      put(body, h('div', { class: 'q' }, txt), h('div', { class: 'choices' }, st.options.map(([v, label, desc]) => h('button', {
        class: 'choice' + (S.data.fields[st.key] === v ? ' on' : ''), onclick: () => { S.data.fields[st.key] = v; next(); },
      }, h('b', null, label), desc && h('span', { class: 'muted small' }, desc)))));
      footer('Далее', next, { disabled: !S.data.fields[st.key] });
      if (isGuide) speak(txt);
    },
    canvas(st) {
      const txt = T(st.text);
      currentText = txt;
      const editor = mapEditor(S.data.map, { compact: !st.final, tools: st.tools, tag: st.tag, title: tech.name + (S.data.fields.goal ? ' · ' + S.data.fields.goal : '') });
      put(body, pairLabel(), h('div', { class: 'q' }, txt), hintEl(st), editor);
      primary = () => { const err = st.need && st.need(S); if (err) { toast(err); if (isGuide) speak(err); return; } next(); };
      footer(st.final ? 'Далее' : 'Готово', primary);
      if (isGuide) speak(txt);
    },
    mapview(st) {
      const txt = T(st.text);
      currentText = txt;
      put(body, h('div', { class: 'q big center' }, txt), h('div', { class: 'map-wrap small' }, mapPreview(S.data.map, S.vars.i ?? -1)));
      primary = next;
      if (isGuide) { add(body, guideTap(next)); footer('Дальше'); speak(txt); } else footer();
    },
    timeline(st) {
      const txt = T(st.text);
      currentText = txt;
      const view = h('div');
      const inp = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 8, max: 110, placeholder: 'Возраст', value: S.data.timeline?.age || '' });
      const upd = () => {
        const stops = computeStops(inp.value);
        S.data.timeline = stops.length ? { age: +inp.value, stops } : null;
        put(view, stops.length
          ? h('div', null, h('p', { class: 'muted small' }, 'Остановки: ' + stops.join(' → ') + ' лет'), timelineView(stops, {}))
          : h('p', { class: 'muted small' }, 'Введи возраст от 8 лет.'));
      };
      inp.addEventListener('input', upd); upd();
      put(body, h('div', { class: 'q' }, txt), inp, view);
      primary = () => { if (!S.data.timeline) return toast('Введи возраст'); next(); };
      footer('Далее', primary);
      if (isGuide) speak(txt);
    },
    tlview(st) {
      const stops = S.data.timeline?.stops || [];
      const age = S.vars.age;
      const passed = st.dir === 'down' ? stops.filter(a => a > age) : stops.filter(a => a < age);
      put(body, h('div', { class: 'q big center' }, `${age} ${plural(age)}`), timelineView(stops, { current: age, passed, dir: st.dir }));
      currentText = st.dir === 'down' ? `Отправляемся в ${age}.` : `Возвращаемся в ${age}.`;
      primary = next;
      if (isGuide) { add(body, guideTap(next)); footer('Дальше'); speak(currentText); } else footer();
    },
    write(st, my) {
      const txt = T(st.text);
      currentText = txt;
      const paper = S.data.fields.format === 'paper';
      const area = h('textarea', { class: 'input letter', rows: 9, placeholder: 'Пиши, не исправляя…', value: st.append ? '' : (S.data.fields[st.key] || '') });
      currentArea = paper ? null : area;
      const commit = () => {
        if (paper) return;
        const v = area.value.trim();
        if (st.append) { if (v) S.data.fields[st.key] = (S.data.fields[st.key] ? S.data.fields[st.key] + '\n\n' : '') + v; logAnswer(txt, v); }
        else S.data.fields[st.key] = v;
      };
      put(body, mainText(st, txt));
      if (!paper) add(body, area);
      // Таймер на шаг письма (необязательный)
      const holder = h('div', { class: 'write-timer' });
      add(body, holder, h('button', { class: 'btn soft', onclick: () => pickFeelings() }, '💗 Таблица чувств'));
      let left = st.sec, iv;
      const lbl = h('span');
      const show = () => { lbl.textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };
      const run = () => { if (iv) return; iv = setInterval(() => { left--; show(); if (left <= 0) { clearInterval(iv); chime(); vibrate([80, 60, 80]); lbl.textContent = '⏱ Время шага вышло — можно дописать'; } }, 1000); };
      show();
      add(holder, lbl, h('button', { class: 'btn ghost small', onclick: e => { run(); e.currentTarget.remove(); } }, 'Запустить'));
      cleanup.push(() => clearInterval(iv));
      primary = () => { commit(); next(); };
      footer('Далее', primary);
      if (isGuide) speak((st.title ? T(st.title) + '. ' : '') + txt).then(() => { if (my === rtoken) { run(); holder.querySelector('button')?.remove(); } });
    },
    burn(st) {
      const txt = T(st.text);
      currentText = txt;
      const src = (st.source ? st.source(S) : '') || '';
      const area = h('textarea', { class: 'input', rows: 5, placeholder: 'Что хочешь отпустить?', value: src });
      let done = false;
      const stage = h('div', { class: 'burn-stage' });
      const btn = h('button', { class: 'btn fire wide', onclick: async () => {
        const text = area.value.trim() || '…';
        area.remove(); btn.remove();
        const bv = burnView(text, { title: typeof st.title === 'function' ? st.title(S) : st.title });
        stage.append(bv.el);
        await new Promise(r => requestAnimationFrame(r)); bv.layout();
        vibrate([40, 40, 40]);
        await bv.start();
        if (!wrap.isConnected) return;
        done = true;
        put(stage, h('div', { class: 'ash' }, h('div', { class: 'ash-icon' }, '🕊'), h('p', null, 'Отпущено. Пусть уйдёт с миром.')));
        if (isGuide) speak('Отпущено. Пусть уйдёт с миром.');
        footer('Далее', next);
      } }, '🔥 Сжечь');
      put(body, h('div', { class: 'q' }, txt), area, stage, btn);
      footer('Далее', () => { if (!done) return toast('Сначала нажми «Сжечь» — или пропусти'); next(); }, { extra: [h('button', { class: 'btn ghost', onclick: next }, 'Пропустить')] });
      if (isGuide) speak(txt);
    },
    pct(st) {
      const txt = T(st.text);
      currentText = txt;
      const item = S.data.map?.items.find(i => i.id === S.vars.id && i.type === 'block');
      if (!item) return next();
      const out = h('b', { class: 'pct-big' }, item.pct + '%');
      const was = item.pct;
      const range = h('input', { type: 'range', min: 0, max: 100, value: item.pct, class: 'wide-range', oninput: e => { item.pct = Math.max(1, +e.target.value); out.textContent = e.target.value + '%'; } });
      put(body, pairLabel(), h('div', { class: 'q big' }, txt), hintEl(st), h('div', { class: 'center' }, out, h('div', { class: 'muted small' }, `было ${was}%`)), range,
        h('div', { class: 'map-wrap small' }, mapPreview(S.data.map)));
      primary = () => { if (+range.value <= 10) item.cleared = true; next(); };
      footer('Далее', primary);
      if (isGuide) speak(txt + ' Отметьте на экране.');
    },
  };

  function renderLoop(f, my) {
    const st = f.step;
    const prompt = T(st.prompt || 'Есть ли ещё что-то?');
    const more = st.more || 'Есть ещё эмоция', done = st.done || 'Больше ничего нет';
    currentText = prompt;
    primary = loopMore;
    if (isGuide) {
      wrap.classList.add('split');
      put(body, 
        h('button', { class: 'zone zone-more', onclick: () => { vibrate(30); loopMore(); } }, h('span', null, '↑'), h('b', null, more), h('small', null, 'верх экрана')),
        h('div', { class: 'zone-mid' }, prompt),
        h('button', { class: 'zone zone-done', onclick: () => { vibrate([60, 50, 60]); loopDone(); } }, h('b', null, done), h('small', null, 'низ экрана'), h('span', null, '↓')));
      put(foot, h('button', { class: 'btn ghost', onclick: back }, '← Назад'), h('span', { class: 'muted small' }, `Круг ${f.count}`));
      speak(prompt + ` Коснись верхней половины экрана, если есть ещё. Нижней — если больше ничего нет.`);
      stopListen = listen(cmd => { if (my !== rtoken) return; if (cmd === 'more') loopMore(); if (cmd === 'done') loopDone(); });
    } else {
      put(body, pairLabel(), h('div', { class: 'q big' }, prompt),
        isPair && h('div', { class: 'hint' }, h('b', null, 'Для ведущего: '), `Круг ${f.count}. Повторяйте вопросы, пока партнёр не скажет «больше ничего нет».`),
        h('div', { class: 'loop-btns' },
          h('button', { class: 'btn big-choice more', onclick: () => { vibrate(30); loopMore(); } }, (isPair ? 'Партнёр: ' : '') + more),
          h('button', { class: 'btn big-choice done', onclick: () => { vibrate([60, 50, 60]); loopDone(); } }, (isPair ? 'Партнёр: ' : '') + done)));
      put(foot, h('button', { class: 'btn ghost', disabled: !S.history.length, onclick: back }, '← Назад'));
    }
  }

  function save(done) {
    sessions.save({ id: S.id, tech: tech.id, mode, start: S.start, end: Date.now(), done, swapped, data: S.data });
  }

  function renderEnd() {
    if (!finished) { finished = true; save(true); }
    stopListen();
    const { before, after } = S.data.scales;
    const belief = S.data.fields.belief;
    const kids = [h('div', { class: 'end-icon' }, '🌿'), h('h2', null, 'Практика завершена'),
      h('p', { class: 'muted' }, 'Побудь немного в тишине. Почувствуй своё состояние.')];
    if (before || after) kids.push(h('div', { class: 'compare' },
      before ? h('div', null, h('small', null, 'До'), h('b', null, before)) : null,
      h('span', null, '→'),
      after ? h('div', null, h('small', null, 'После'), h('b', null, after)) : null));
    if (tech.endNote) kids.push(h('div', { class: 'hint' }, tech.endNote));
    if (belief) kids.push(h('div', { class: 'belief-card' }, h('small', null, 'Новое убеждение'), h('b', null, belief)));
    const acts = [];
    if (S.data.map && tech.preset !== 'rod' && blocksOf(S.data.map).length) acts.push(h('button', { class: 'btn soft', onclick: () => exportMap(S.data.map, tech.name).catch(() => toast('Не удалось сохранить')) }, '🖼 Сохранить карту в галерею'));
    if (belief && tech.consolidate) acts.push(h('button', { class: 'btn soft', onclick: () => { beliefs.add(belief, tech.id); location.hash = '#/beliefs'; } }, '📅 Закреплять 14 дней по утрам'));
    if (isPair) acts.push(h('button', { class: 'btn primary', onclick: () => runSession(root, tech, mode, { onExit, swapped: !swapped }) }, '🔄 Поменяться ролями'));
    acts.push(h('button', { class: isPair ? 'btn ghost' : 'btn primary', onclick: () => { teardown(); onExit && onExit(); } }, 'Готово'));
    put(body, h('div', { class: 'end' }, kids, h('div', { class: 'col' }, acts)));
    put(foot, );
    if (isGuide) speak('Практика завершена. Побудь немного в тишине.');
  }

  function teardown() {
    rtoken++; cleanup.forEach(f => f()); stopSpeak(); stopListen(); keepAwake(false);
    window.removeEventListener('hashchange', teardown);
  }
  window.addEventListener('hashchange', teardown);

  async function exit() {
    if (!finished && S.history.length > 1) {
      const ok = await confirmBox('Прервать практику? Ваши записи сохранятся в журнале как незавершённые.', { ok: 'Прервать' });
      if (!ok) return;
      save(false);
    }
    teardown(); onExit && onExit();
  }

  // ---------- Вступление ----------
  function intro() {
    const kids = [h('div', { class: 'intro-icon' }, tech.icon), h('h2', null, tech.name),
      swapped ? h('div', { class: 'hint' }, '🔄 Роли поменялись: теперь ведущий — другой партнёр.') : null];
    if (isGuide) kids.push(h('ul', { class: 'tips' },
      h('li', null, '🎧 Наденьте наушники и сядьте удобно.'),
      h('li', null, '👆 Коснитесь экрана в любом месте, чтобы перейти дальше.'),
      h('li', null, '↕️ В циклах: верх экрана — «Есть ещё», низ — «Больше ничего нет». Вибрация подтвердит выбор.'),
      h('li', null, '💗 Таблица чувств и 🔁 повтор фразы — вверху экрана.')));
    if (isPair) kids.push(h('ul', { class: 'tips' },
      h('li', null, '👥 Этот экран — для ведущего. Ведомый сидит удобно, глаза закрыты.'),
      h('li', null, '🗣 Читайте крупный текст спокойно и медленно. Подсказки «Для ведущего» — только для вас.'),
      h('li', null, '🔢 Фиксируйте замеры 1–10 и отвечайте за партнёра в циклах.'),
      tech.preset && h('li', null, '📄 Ведомому понадобится лист А4 и ручка.')));
    if (tech.heavy) kids.push(h('div', { class: 'hint warn' }, 'Практика затрагивает тяжёлые переживания. Если станет слишком тяжело — остановитесь. Приложение не заменяет психотерапевта.'));
    put(body, h('div', { class: 'intro' }, kids));
    put(foot, h('button', { class: 'btn primary wide', onclick: () => { keepAwake(true); render(); } }, 'Начать'));
    setTitle();
  }

  if (skipIntro || mode === 'solo') { keepAwake(isGuide); render(); } else intro();
  return { teardown };
}

function plural(n) { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'год' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'года' : 'лет'; }
// Чип для вывода выбранных чувств (используется в журнале)
export const feelingChip = w => chip(w, { selected: true });

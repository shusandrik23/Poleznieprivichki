'use strict';
/* מַסָּע בַּתַּנַ״ךְ — prototype. Content lives in content/course.json; progress in localStorage. */

const STORE_KEY = 'tanachkef.v1';
const DAY = 86400000;
const BOX_DAYS = [0, 1, 2, 4, 8, 16, 32]; // Leitner intervals by box
const XP_LESSON = 10, XP_PERFECT = 5, XP_CHEST = 20, XP_REVIEW = 5;

const T = {
  continue: 'הַמְשֵׁךְ', check: 'בְּדִיקָה', start: 'מַתְחִילִים!',
  stages: ['הַסִּפּוּר', 'מִלִּים מֵהַתַּנַ״ךְ', 'הַפָּסוּק שֶׁלָּנוּ', 'תִּרְגּוּל'],
  listen: '🔊 הַקְשִׁיבוּ',
  good: ['כָּל הַכָּבוֹד!', 'מְצֻיָּן!', 'אַלּוּף!', 'יָפֶה מְאוֹד!', 'בְּדִיּוּק!'],
  bad: 'כִּמְעַט!',
  badSub: 'לֹא נוֹרָא – נַחֲזֹר לַשְּׁאֵלָה הַזֹּאת בְּסוֹף הַסִּבּוּב.',
  answer: 'הַתְּשׁוּבָה:',
};
// Russian helper mode: Hebrew stays the main text (the child learns Tanach in Hebrew at school),
// Russian appears under it, and instructions/buttons are in Russian.
const TR = {
  continue: 'Дальше', check: 'Проверить',
  stages: ['История', 'Слова из Танаха', 'Наш стих', 'Тренировка'],
  listen: '🔊 Послушать',
  good: ['Молодец!', 'Отлично!', 'Супер!', 'Очень хорошо!', 'Точно!'],
  bad: 'Почти!',
  badSub: 'Ничего страшного — вернёмся к этому вопросу в конце круга.',
  answer: 'Ответ:',
};
const ruOn = () => S.lang === 'ru';
const tr = (he, ru) => (ruOn() && ru ? ru : he);
const L = key => (ruOn() ? TR[key] : T[key]);
const sub = ru => (ruOn() && ru ? `<span class="ru" lang="ru" dir="ltr">${esc(ru)}</span>` : '');

let C = null;           // course content + indexes
let S = loadState();    // saved progress
let R = null;           // running session (lesson / chest / review)
const app = document.getElementById('app');

/* ---------------- storage ---------------- */
function loadState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { /* storage blocked */ }
  return Object.assign({ xp: 0, streak: 0, lastDay: null, done: {}, chest: {}, words: {}, sound: true, lang: 'he' }, s || {});
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function streakNow() {
  if (!S.lastDay) return 0;
  return (S.lastDay === dayKey() || S.lastDay === dayKey(new Date(Date.now() - DAY))) ? S.streak : 0;
}
function markActive() {
  const t = dayKey();
  if (S.lastDay === t) return false;
  S.streak = S.lastDay === dayKey(new Date(Date.now() - DAY)) ? S.streak + 1 : 1;
  S.lastDay = t;
  return true;
}

/* ---------------- helpers ---------------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const MARK = /\{([^|}]+)\|([^}]+)\}/g;
const plain = s => s.replace(MARK, '$1');
const tanachChars = s => s.replace(/׃/g, '');

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function mascot(mood = 'happy') {
  const mouth = mood === 'happy' ? '<path class="mouth" d="M40 56 Q50 66 60 56"/>'
    : mood === 'oops' ? '<path class="mouth" d="M42 61 Q50 55 58 61"/>'
    : '<circle class="mouth" cx="50" cy="59" r="4"/>';
  return `<svg class="mascot" viewBox="0 0 100 100" aria-hidden="true">
    <rect class="paper" x="20" y="18" width="60" height="64" rx="6"/>
    <rect class="roll" x="10" y="12" width="14" height="76" rx="7"/>
    <rect class="roll" x="76" y="12" width="14" height="76" rx="7"/>
    <circle class="eye" cx="40" cy="44" r="5"/><circle class="eye" cx="60" cy="44" r="5"/>
    <circle class="cheek" cx="33" cy="54" r="4"/><circle class="cheek" cx="67" cy="54" r="4"/>
    ${mouth}</svg>`;
}

/* ---------------- native (Capacitor) ---------------- */
// In the Android app the Capacitor bridge is present; in a browser all of this is skipped.
// Note: a plugin object answers to any property, including `then`, so never `await` the plugin itself.
const CAP = window.capacitorExports;
const isNative = !!CAP?.Capacitor?.isNativePlatform?.();
const pluginCache = {};
const plugin = name => (pluginCache[name] ||= CAP.registerPlugin(name));
let onHome = false;

if (isNative) {
  // Android back button: from any screen go back to the map; on the map, leave the app.
  plugin('App').addListener('backButton', () => {
    if (onHome) plugin('App').minimizeApp();
    else { stopSpeech(); renderHome(); }
  });
  // Android WebView has no speechSynthesis, so the TextToSpeech plugin speaks instead.
  plugin('TextToSpeech').isLanguageSupported({ lang: 'he-IL' })
    .then(r => { if (!r?.supported) warnVoice(); }).catch(() => {});
}

/* ---------------- audio ---------------- */
let heVoice = null, voiceWarned = false;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  heVoice = speechSynthesis.getVoices().find(v => /^(he|iw)/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

function speak(text, audioUrl) {
  if (!S.sound) return;
  if (audioUrl) { new Audio(audioUrl).play().catch(() => speak(text)); return; } // pre-generated file wins
  if (isNative) {
    const tts = plugin('TextToSpeech');
    tts.stop().catch(() => {}).then(() => tts.speak({ text: tanachChars(text), lang: 'he-IL', rate: 0.85 })).catch(warnVoice);
    return;
  }
  if (!('speechSynthesis' in window)) { warnVoice(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(tanachChars(text));
  u.lang = 'he-IL'; u.rate = 0.82;
  if (heVoice) u.voice = heVoice; else warnVoice();
  speechSynthesis.speak(u);
}
function stopSpeech() {
  if (isNative) plugin('TextToSpeech').stop().catch(() => {});
  else if ('speechSynthesis' in window) speechSynthesis.cancel();
}
function warnVoice() {
  if (voiceWarned) return; voiceWarned = true;
  toast(tr('בַּמַּכְשִׁיר הַזֶּה אֵין קוֹל בְּעִבְרִית – הַהַקְרָאָה עֲלוּלָה לֹא לַעֲבֹד.', 'На этом устройстве нет голоса на иврите — озвучка может не работать.'));
}

/* ---------------- content ---------------- */
async function loadCourse() {
  const res = await fetch('content/course.json');
  const c = await res.json();
  // every book (grade) is its own path: lessons open one after another inside a book,
  // but a 5th-grader can start straight at their grade
  c.lessonById = {}; c.wordById = {}; c.steps = {}; c.bookOf = {};
  for (const b of c.books) {
    const steps = c.steps[b.id] = [];
    for (const st of b.stories) {
      if (st.soon) continue;
      for (const l of st.lessons) {
        c.lessonById[l.id] = l; l.story_id = st.id;
        for (const w of l.words) if (!c.wordById[w.id]) c.wordById[w.id] = w;
        steps.push({ kind: 'lesson', id: l.id }); c.bookOf['lesson:' + l.id] = b.id;
      }
      steps.push({ kind: 'chest', id: st.id }); c.bookOf['chest:' + st.id] = b.id;
    }
  }
  return c;
}
const isDone = step => step.kind === 'lesson' ? !!S.done[step.id] : !!S.chest[step.id];
function firstOpenIndex(book) { const st = C.steps[book]; const i = st.findIndex(s => !isDone(s)); return i < 0 ? st.length : i; }
function stepIndex(kind, id) { return C.steps[C.bookOf[kind + ':' + id]].findIndex(s => s.kind === kind && s.id === id); }
function stepUnlocked(kind, id) { return stepIndex(kind, id) <= firstOpenIndex(C.bookOf[kind + ':' + id]); }
function dueWords() {
  const now = Date.now();
  return Object.entries(S.words).filter(([id, w]) => C.wordById[id] && w.due <= now).map(([id]) => id);
}

/* ---------------- home / map ---------------- */
const OFFS = [0, 46, 70, 46, 0, -46, -70, -46];

function renderHome() {
  R = null; onHome = true;
  const st = streakNow(), litToday = S.lastDay === dayKey();
  const due = dueWords();
  const started = Object.keys(S.done).length > 0;
  let k = 0;

  let html = `<header class="topbar">
    <span class="brand">מַסָּע בַּתַּנַ״ךְ</span>
    <span class="chip ${litToday ? '' : 'off'}" title="רֶצֶף יָמִים">🔥 ${st}</span>
    <span class="chip" title="מְגִלּוֹת XP">📜 ${S.xp}</span>
    <button class="iconbtn" data-act="lang" aria-label="${tr('Русский', 'עברית')}">${ruOn() ? 'עב' : 'RU'}</button>
    ${ruOn() ? `<button class="iconbtn" data-act="names" aria-label="Имена">👥</button>` : ''}
    <button class="iconbtn" data-act="dict" aria-label="${tr('הַמִּלּוֹן שֶׁלִּי', 'Мой словарь')}">📖</button>
  </header>
  <nav class="grades" aria-label="כִּתּוֹת">${C.books.map(b => `<button class="grade" data-act="jump" data-book="${b.id}">${esc(b.subtitle)}</button>`).join('')}</nav>`;

  if (due.length) {
    html += `<div class="review-card">${mascot('happy')}
      <p>${ruOn() ? `<b>Мой словарь</b><br>Слов ждут короткого повторения: ${due.length}.`
        : `<b>הַמִּלּוֹן שֶׁלִּי</b><br>${due.length === 1 ? 'מִלָּה אַחַת מְחַכָּה' : `${due.length} מִלִּים מְחַכּוֹת`} לַחֲזָרָה קְצָרָה.`}</p>
      <button class="btn gold" style="width:auto" data-act="review">${tr('חֲזָרָה', 'Повторить')}</button></div>`;
  } else if (!started) {
    html += `<div class="bubble-row" style="margin-top:6px">${mascot('happy')}
      <div class="bubble">${ruOn() ? 'Привет! Я Гили, свиток. Отправимся в путешествие по Танаху — 3 минуты каждый день! Текст на иврите, а перевод на русский — прямо под ним.'
        : 'שָׁלוֹם! אֲנִי גִּילִי, הַמְּגִלָּה. בּוֹאוּ נִצָּא לְמַסָּע בַּתַּנַ״ךְ – 3 דַּקּוֹת בְּכָל יוֹם!'}</div></div>`;
  }

  for (const b of C.books) {
    const steps = C.steps[b.id], open = firstOpenIndex(b.id);
    html += `<section class="book" id="book-${b.id}"><div class="book-banner"><small>${esc(b.subtitle)} · ${Math.min(open, steps.length)}/${steps.length}</small><h2>${esc(b.title)}</h2>${sub(b.ru)}</div>`;
    for (const st of b.stories) {
      html += `<div class="story-title"><span>${esc(st.title)}${sub(st.ru)}</span></div>`;
      if (st.soon) { html += `<div class="soon">🔒 ${tr('בְּקָרוֹב', 'скоро')}</div>`; continue; }
      html += `<div class="trail">`;
      const items = st.lessons.map(l => ({ kind: 'lesson', id: l.id, icon: l.icon, label: l.title, ru: l.ru?.title }))
        .concat([{ kind: 'chest', id: st.id, icon: '🎁', label: 'אוֹצַר הַחָכְמָה', ru: 'Сокровищница мудрости' }]);
      for (const it of items) {
        const idx = stepIndex(it.kind, it.id);
        const state = idx < open ? 'done' : idx === open ? 'open' : 'locked';
        const off = OFFS[k++ % OFFS.length];
        html += `<div class="node-wrap" style="transform:translateX(${off}px)">
          <button class="node ${state} ${it.kind === 'chest' ? 'chest' : ''}" data-act="go" data-kind="${it.kind}" data-id="${it.id}" aria-label="${esc(it.label)}">
            ${state === 'locked' ? '🔒' : it.icon}${state === 'done' ? '<span class="check">✓</span>' : ''}
          </button>
          <span class="node-label">${esc(it.label)}${sub(it.ru)}</span></div>`;
      }
      html += `</div>`;
    }
    html += `</section>`;
  }
  html += `<div style="height:40px"></div>`;
  app.innerHTML = html;
  const lastBook = S.lastBook && C.steps[S.lastBook] ? S.lastBook : null;
  const cur = lastBook && app.querySelector(`#book-${lastBook} .node.open`);
  if (cur) cur.scrollIntoView({ block: 'center' });
}

/* ---------------- sessions ---------------- */
function startLesson(id) {
  const les = C.lessonById[id];
  S.lastBook = C.bookOf['lesson:' + id]; save();
  const tasks = les.tasks.map(t => prepTask(t, les));
  R = { kind: 'lesson', les, stage: 0, queue: tasks, total: tasks.length, solved: 0, mistakes: 0,
        flipped: new Set(), ui: {} };
  renderSession();
}

function startChest(storyId) {
  const story = C.books.flatMap(b => b.stories).find(s => s.id === storyId);
  S.lastBook = C.bookOf['chest:' + storyId]; save();
  const lessons = story.lessons;
  const pool = shuffle(lessons.flatMap(l => l.tasks.filter(t => t.type !== 'match').map(t => prepTask(t, l)))).slice(0, 6);
  const words = shuffle(lessons.flatMap(l => l.words)).slice(0, 4);
  const tasks = shuffle([prepTask({ type: 'match' }, { words }), ...pool]);
  R = { kind: 'chest', story, stage: 3, queue: tasks, total: tasks.length, solved: 0, mistakes: 0, ui: {} };
  renderSession();
}

function startReview() {
  let ids = dueWords();
  if (!ids.length) ids = Object.keys(S.words).filter(id => C.wordById[id]).sort((a, b) => S.words[a].box - S.words[b].box);
  ids = shuffle(ids).slice(0, 6);
  if (!ids.length) { toast(tr('עוֹד אֵין מִלִּים בַּמִּלּוֹן – סַיְּמוּ שִׁעוּר רִאשׁוֹן!', 'В словаре пока нет слов — пройдите первый урок!')); return; }
  const all = Object.values(C.wordById);
  const tasks = ids.map((id, i) => {
    const w = C.wordById[id];
    const others = shuffle(all.filter(x => x.id !== id)).slice(0, 2);
    const flip = i % 2 === 1; // alternate direction: Tanach→modern and modern→Tanach
    const opts = shuffle([w, ...others]);
    return {
      type: 'choice', kind: 'review', wordId: id, tanachOpts: flip,
      q: flip ? `אֵיךְ כָּתוּב בַּתַּנַ״ךְ „${w.m}”?` : `מָה פֵּרוּשׁ „${w.t}”?`,
      options: opts.map(o => flip ? o.t : o.m), answer: opts.indexOf(w), say: w.t,
      ru: { q: flip ? `Как это написано в Танахе: «${w.m}»${w.ru ? ` (${w.ru})` : ''}?` : `Что значит «${w.t}»?`,
            options: flip ? null : opts.map(o => o.ru) },
    };
  });
  R = { kind: 'review', stage: 3, queue: tasks, total: tasks.length, solved: 0, mistakes: 0, wrong: new Set(), reviewIds: ids, ui: {} };
  renderSession();
}

function prepTask(t, les) {
  t = Object.assign({}, t);
  if (t.type === 'match') {
    const words = les.words;
    t.pairs = words.map(w => ({ id: w.id, t: w.t, m: w.m, ru: w.ru }));
    t.left = shuffle(t.pairs.map(p => p.id));
    t.right = shuffle(t.pairs.map(p => p.id));
  } else if (t.type === 'order') {
    t.target = t.text.split(/\s+/);
    t.tiles = shuffle(t.target.concat(t.extra || []));
  } else if (t.type === 'choice' || t.type === 'who') {
    // shuffle options, keep track of the right one
    const order = shuffle(t.options.map((_, i) => i));
    const correct = t.type === 'who' ? t.options.indexOf(t.answer) : t.answer;
    t.options = order.map(i => t.options[i]);
    if (t.ru?.options) t.ru = { ...t.ru, options: order.map(i => t.ru.options[i]) };
    t.answer = order.indexOf(correct);
  }
  return t;
}

/* ---------------- session rendering ---------------- */
function progressPct() {
  if (R.kind === 'lesson') {
    const units = 3 + R.total;
    const doneUnits = Math.min(R.stage, 3) + R.solved;
    return Math.round(100 * doneUnits / units);
  }
  return Math.round(100 * R.solved / R.total);
}

function shell(body, bottom) {
  onHome = false;
  app.innerHTML = `<div class="lesson">
    <div class="lesson-top"><button class="close" data-act="quit" aria-label="יְצִיאָה">✕</button>
      <div class="progress"><i style="width:${progressPct()}%"></i></div></div>
    ${body}</div>
    <div class="bottom" id="bottom"><div class="bottom-inner">${bottom}</div></div>`;
}

function renderSession() {
  R.ui = R.ui || {};
  if (R.stage === 0) return renderStory();
  if (R.stage === 1) return renderWords();
  if (R.stage === 2) return renderVerse();
  if (!R.queue.length) return finish();
  renderTask();
}

function renderStory() {
  const l = R.les;
  shell(`<span class="stage-label">${L('stages')[0]}</span>
    <h1>${esc(l.title)}${sub(l.ru?.title)}</h1>
    <div class="story">${l.story.map((p, i) => `<p>${esc(p)}${sub(l.ru?.story?.[i])}</p>`).join('')}</div>
    <button class="listen" data-act="say-story">${L('listen')}</button>`,
    `<button class="btn" data-act="next-stage">${L('continue')}</button>`);
}

function renderWords() {
  const l = R.les;
  const all = l.words.every(w => R.flipped.has(w.id));
  shell(`<span class="stage-label">${L('stages')[1]}</span>
    <h1>${tr('לַחֲצוּ עַל כָּל כַּרְטִיס כְּדֵי לִפְגֹּשׁ אֶת הַמִּלָּה', 'Нажмите на каждую карточку, чтобы познакомиться со словом')}</h1>
    <div class="cards">${l.words.map(w => {
      const f = R.flipped.has(w.id);
      return `<button class="card ${f ? 'flipped' : ''}" data-act="flip" data-id="${w.id}">
        <span class="t">${esc(w.t)}</span>
        ${f ? `<span class="arrow">${tr('בְּעִבְרִית שֶׁלָּנוּ', 'на современном иврите')}</span><span class="m">${esc(w.m)}</span>${sub(w.ru)}${w.note && !ruOn() ? `<span class="note">${esc(w.note)}</span>` : ''}`
            : `<span class="tap">${tr('לַחֲצוּ', 'нажмите')} 👆</span>`}
      </button>`; }).join('')}</div>`,
    `<button class="btn" data-act="next-stage" ${all ? '' : 'disabled'}>${L('continue')}</button>`);
}

function verseHtml(text) {
  let out = '', last = 0;
  text.replace(MARK, (m, word, ref, pos) => {
    out += esc(text.slice(last, pos));
    out += ref.startsWith('=')
      ? `<button class="vw gloss" data-act="vw" data-g="${esc(ref.slice(1))}" data-t="${esc(word)}">${esc(word)}</button>`
      : `<button class="vw" data-act="vw" data-w="${esc(ref)}" data-t="${esc(word)}">${esc(word)}</button>`;
    last = pos + m.length;
  });
  return out + esc(text.slice(last));
}

function renderVerse() {
  const l = R.les, p = R.ui.pop;
  const shown = R.ui.tr || {};
  shell(`<span class="stage-label">${L('stages')[2]}</span>
    <h1>${tr('קוֹרְאִים אֶת הַפָּסוּק מֵהַתַּנַ״ךְ', 'Читаем стих из Танаха')}</h1>
    <p class="hint">${tr('מִלָּה צְבוּעָה = מִלָּה מֵהַשִּׁעוּר. מִלָּה עִם קַו נְקֻדּוֹת = עוֹד רֶמֶז. לַחֲצוּ עֲלֵיהֶן!',
      'Цветное слово — слово из урока. Слово с пунктиром — ещё одна подсказка. Нажимайте на них! Сначала попробуйте понять сами, а потом откройте перевод.')}</p>
    ${l.verses.map((v, i) => `<div class="verse"><div class="ref">${esc(v.ref)}</div>
      <div class="text">${verseHtml(v.text)}</div>
      ${shown[i] ? `<p class="verse-ru" lang="ru" dir="ltr">${esc(v.ru)}</p>` : ''}
      <div class="verse-tools"><button class="listen" data-act="say-verse" data-i="${i}">${L('listen')}</button>
      ${ruOn() && v.ru ? `<button class="listen" data-act="tr" data-i="${i}">${shown[i] ? 'Скрыть перевод' : '🇷🇺 Показать перевод'}</button>` : ''}</div></div>`).join('')}
    ${p ? `<div class="pop" id="pop"><span class="pt">${esc(p.t)}</span><span class="pm">← ${esc(p.m)}${sub(p.ru)}</span>
      <button class="listen" style="margin:0" data-act="say" data-text="${esc(p.t)}">🔊</button></div>` : ''}`,
    `<button class="btn" data-act="next-stage">${L('continue')}</button>`);
  if (p) document.getElementById('pop').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

const TASK_TITLE = {
  match: 'מִלּוֹן תַּנַ״ךְ', order: 'הַשְׁלֵם אֶת הַפָּסוּק', who: 'מִי אָמַר?',
  meaning: 'מָה הַפֵּרוּשׁ?', detective: 'בַּלַּשׁ הַתַּנַ״ךְ', review: 'הַמִּלּוֹן שֶׁלִּי',
};
const TASK_TITLE_RU = {
  match: 'Переводчик с языка Танаха', order: 'Собери стих', who: 'Кто это сказал?',
  meaning: 'Что это значит?', detective: 'Детектив Танаха', review: 'Мой словарь',
};

function renderTask() {
  const t = R.queue[0], ui = R.ui;
  let body = '', canCheck = false;
  const kind = t.type === 'choice' ? t.kind : t.type;
  const label = (ruOn() ? TASK_TITLE_RU : TASK_TITLE)[kind] || '';

  if (t.type === 'match') {
    ui.matched = ui.matched || new Set();
    body = `<h1>${tr('חַבְּרוּ כָּל מִלָּה מֵהַתַּנַ״ךְ לַמִּלָּה שֶׁלָּנוּ', 'Соедините каждое слово из Танаха с современным')}</h1>
      <div class="match"><div class="col">${t.left.map(id => {
        const p = t.pairs.find(x => x.id === id), ok = ui.matched.has(id);
        return `<button class="tile tan ${ok ? 'ok' : ''} ${ui.selL === id ? 'sel' : ''}" data-act="mL" data-id="${id}" ${ok ? 'disabled' : ''}>${esc(p.t)}</button>`;
      }).join('')}</div><div class="col">${t.right.map(id => {
        const p = t.pairs.find(x => x.id === id), ok = ui.matched.has(id);
        return `<button class="tile ${ok ? 'ok' : ''} ${ui.selR === id ? 'sel' : ''}" data-act="mR" data-id="${id}" ${ok ? 'disabled' : ''}>${esc(p.m)}${sub(p.ru)}</button>`;
      }).join('')}</div></div>`;
    shell(`<span class="stage-label">${label}</span>${body}`, ui.fb || `<p class="hint" style="text-align:center;margin:0">${tr('בַּחֲרוּ זוּג אַחֲרֵי זוּג', 'Выбирайте пару за парой')}</p>`);
    return;
  }

  if (t.type === 'order') {
    ui.picked = ui.picked || [];
    body = `<h1>${tr('סַדְּרוּ אֶת הַמִּלִּים לְפִי הַפָּסוּק', 'Расставьте слова в порядке стиха')}</h1>
      <div class="build-line">${ui.picked.map((ti, k) => `<button class="word" data-act="unpick" data-k="${k}">${esc(t.tiles[ti])}</button>`).join('')}</div>
      <div class="bank">${t.tiles.map((w, i) => `<button class="word ${ui.picked.includes(i) ? 'used' : ''}" data-act="pick" data-i="${i}" ${ui.locked ? 'disabled' : ''}>${esc(w)}</button>`).join('')}</div>`;
    canCheck = ui.picked.length > 0;
  }

  if (t.type === 'who') {
    body = `<h1>${tr('מִי אָמַר אֶת הַמִּלִּים הָאֵלֶּה?', 'Кто сказал эти слова?')}</h1>
      <div class="who-quote">„${esc(t.quote)}”</div>
      <div class="who-grid">${t.options.map((cid, i) => {
        const ch = C.characters[cid];
        return `<button class="opt ${ui.sel === i ? 'sel' : ''}" data-act="sel" data-i="${i}" ${ui.locked ? 'disabled' : ''}><span class="face">${ch.emoji}</span>${esc(ch.name)}${sub(ch.ru)}</button>`;
      }).join('')}</div>`;
    canCheck = ui.sel != null;
  }

  if (t.type === 'choice') {
    body = `<h1>${esc(t.q)}${sub(t.ru?.q)}</h1>
      ${t.say ? `<button class="listen" data-act="say" data-text="${esc(t.say)}">${L('listen')}</button>` : ''}
      <div class="options">${t.options.map((o, i) => `<button class="opt ${ui.sel === i ? 'sel' : ''}" data-act="sel" data-i="${i}" ${ui.locked ? 'disabled' : ''}
        ${t.tanachOpts ? 'style="font-family:var(--font-text);font-size:26px;font-weight:700"' : ''}>${esc(o)}${sub(t.ru?.options?.[i])}</button>`).join('')}</div>`;
    canCheck = ui.sel != null;
  }

  shell(`<span class="stage-label">${label}</span>${body}`,
    ui.fb || `<button class="btn" data-act="check" ${canCheck ? '' : 'disabled'}>${L('check')}</button>`);
}

function feedback(ok, extra) {
  const ui = R.ui;
  ui.locked = true;
  ui.ok = ok;
  ui.fb = `<div class="fb">${mascot(ok ? 'happy' : 'oops')}<div>
      <strong>${ok ? pick(L('good')) : L('bad')}</strong>
      ${extra ? `<p>${extra}</p>` : ''}${ok ? '' : `<p>${L('badSub')}</p>`}</div></div>
    <button class="btn ${ok ? 'okb' : 'badb'}" data-act="after">${L('continue')}</button>`;
  renderTask();
  const b = document.getElementById('bottom');
  b.classList.add(ok ? 'ok' : 'bad');
}

function check() {
  const t = R.queue[0], ui = R.ui;
  if (t.type === 'order') {
    const got = ui.picked.map(i => t.tiles[i]).join(' ');
    const ok = got === t.target.join(' ');
    if (ok) speak(t.text);
    return feedback(ok, ok ? '' : `${L('answer')} <b style="font-family:var(--font-text);font-size:20px">${esc(t.text)}</b>`);
  }
  const ok = ui.sel === t.answer;
  if (t.kind === 'review' && !ok) R.wrong.add(t.wordId);
  if (t.say && ok) speak(t.say);
  const ch = t.type === 'who' ? C.characters[t.options[t.answer]] : null;
  const right = ch ? ch.name : t.options[t.answer];
  const rightRu = ch ? ch.ru : t.ru?.options?.[t.answer];
  let extra = t.explain ? esc(t.explain) + sub(t.ru?.explain) : '';
  if (!ok) extra = `${L('answer')} <b>${esc(right)}</b>${sub(rightRu)}${extra ? '<br>' + extra : ''}`;
  feedback(ok, extra);
}

function afterTask() {
  const t = R.queue.shift();
  if (R.ui.ok) R.solved++;
  else { R.mistakes++; R.queue.push(prepTask(stripPrep(t), null)); }
  R.ui = {};
  renderSession();
}
// re-shuffle a task that went to the back of the queue
function stripPrep(t) {
  const c = Object.assign({}, t);
  if (c.type === 'order') { delete c.tiles; delete c.target; }
  if (c.type === 'choice' || c.type === 'who') {
    c.options = c.options.slice();
    if (c.type === 'who') c.answer = c.options[c.answer];
  }
  return c;
}

function matchTap(side, id) {
  const ui = R.ui, t = R.queue[0];
  if (side === 'L') { ui.selL = id; speak(t.pairs.find(p => p.id === id).t); }
  else ui.selR = id;
  if (ui.selL && ui.selR) {
    if (ui.selL === ui.selR) {
      ui.matched.add(ui.selL);
    } else {
      R.mistakes++;
      const L = ui.selL, Rr = ui.selR;
      ui.selL = ui.selR = null;
      renderTask();
      app.querySelector(`[data-act="mL"][data-id="${L}"]`)?.classList.add('bad');
      app.querySelector(`[data-act="mR"][data-id="${Rr}"]`)?.classList.add('bad');
      return;
    }
    ui.selL = ui.selR = null;
    if (ui.matched.size === t.pairs.length) { ui.ok = true; return feedback(true, ''); }
  }
  renderTask();
}

/* ---------------- finish ---------------- */
function finish() {
  let xp = 0, title = tr('כָּל הַכָּבוֹד!', 'Молодец!'), note = '', newWords = 0;
  const perfect = R.mistakes === 0;
  if (R.kind === 'lesson') {
    const l = R.les;
    if (!S.done[l.id]) {
      S.done[l.id] = true;
      for (const w of l.words) if (!S.words[w.id]) { S.words[w.id] = { box: 1, due: Date.now() + DAY }; newWords++; }
    }
    xp = XP_LESSON + (perfect ? XP_PERFECT : 0);
    title = tr('סִיַּמְתֶּם אֶת הַשִּׁעוּר!', 'Урок пройден!');
    note = newWords ? tr(`${newWords} מִלִּים חֲדָשׁוֹת נִכְנְסוּ לַמִּלּוֹן שֶׁלִּי 📖`, `Новых слов в словаре: ${newWords} 📖`) : '';
  } else if (R.kind === 'chest') {
    S.chest[R.story.id] = true;
    xp = XP_CHEST + (perfect ? XP_PERFECT : 0);
    title = tr('פְּתַחְתֶּם אֶת אוֹצַר הַחָכְמָה! 🎁', 'Сокровищница мудрости открыта! 🎁');
    note = tr(`סִיַּמְתֶּם אֶת „${R.story.title}”.`, `История «${R.story.ru || R.story.title}» пройдена.`);
  } else {
    xp = XP_REVIEW;
    title = tr('חֲזָרָה מֻצְלַחַת!', 'Повторение удалось!');
    note = tr('הַמִּלִּים יַחְזְרוּ אֲלֵיכֶם בְּעוֹד כַּמָּה יָמִים.', 'Слова вернутся к вам через несколько дней.');
    for (const id of R.reviewIds) {
      const w = S.words[id]; if (!w) continue;
      w.box = R.wrong.has(id) ? 1 : Math.min(w.box + 1, BOX_DAYS.length - 1);
      w.due = Date.now() + BOX_DAYS[w.box] * DAY;
    }
  }
  onHome = false;
  S.xp += xp;
  const lit = markActive();
  save();
  app.innerHTML = `<div class="finish">${mascot('happy')}
      <h1>${title}</h1>${note ? `<p style="margin:0">${note}</p>` : ''}
      <div class="stats">
        <div class="stat"><b>+${xp}</b><span>📜 ${tr('מְגִלּוֹת XP', 'свитки опыта')}</span></div>
        <div class="stat"><b>🔥 ${streakNow()}</b><span>${lit ? tr('הַרֶצֶף הִתְעַדְכֵּן!', 'серия продлена!') : tr('רֶצֶף יָמִים', 'дней подряд')}</span></div>
        ${perfect ? `<div class="stat"><b>💯</b><span>${tr('בְּלִי טָעֻיּוֹת', 'без ошибок')}</span></div>` : ''}
      </div></div>
    <div class="bottom"><div class="bottom-inner"><button class="btn" data-act="home">${L('continue')}</button></div></div>`;
  R = null;
}

/* ---------------- dictionary ---------------- */
function renderDict() {
  onHome = false;
  const ids = Object.keys(S.words).filter(id => C.wordById[id]);
  const due = new Set(dueWords());
  app.innerHTML = `<header class="topbar"><button class="close" data-act="home" aria-label="${tr('חֲזָרָה', 'Назад')}">→</button>
      <span class="brand">${tr('הַמִּלּוֹן שֶׁלִּי', 'Мой словарь')}</span></header>
    <div class="dict">
      <p class="hint">${tr('כָּל מִלָּה שֶׁלְּמַדְתֶּם נִשְׁמֶרֶת כָּאן. הַנְּקֻדּוֹת מַרְאוֹת כַּמָּה טוֹב אַתֶּם זוֹכְרִים אוֹתָהּ.', 'Здесь хранится каждое выученное слово. Точки показывают, насколько хорошо вы его помните.')}</p>
      ${ids.length ? `<button class="btn gold" data-act="review">${tr('חֲזָרָה עַל מִלִּים', 'Повторить слова')} (${due.size || ids.length})</button>` : ''}
      <div class="dict-list">${ids.length ? ids.map(id => {
        const w = C.wordById[id], s = S.words[id];
        return `<div class="drow"><span class="t">${esc(w.t)}</span><span class="m">${esc(w.m)}${sub(w.ru)}</span>
          <span class="dots" title="רָמָה ${s.box}">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= s.box ? 'on' : ''}"></i>`).join('')}</span>
          <button class="iconbtn" data-act="say" data-text="${esc(w.t)}" aria-label="הַשְׁמָעָה">🔊</button></div>`;
      }).join('') : `<div class="empty">${mascot('think')}<p>${tr('הַמִּלּוֹן עוֹד רֵיק.<br>סַיְּמוּ שִׁעוּר – וְהַמִּלִּים יוֹפִיעוּ כָּאן.', 'Словарь пока пуст.<br>Пройдите урок — и слова появятся здесь.')}</p></div>`}</div>
      <div class="setting"><span>🔊 ${tr('הַקְרָאָה בְּקוֹל', 'Озвучка')}</span>
        <button class="iconbtn" data-act="sound">${S.sound ? tr('פּוֹעֵל', 'вкл.') : tr('כָּבוּי', 'выкл.')}</button></div>
      <div class="setting"><span>🌐 ${tr('תִּרְגּוּם לְרוּסִית', 'Перевод на русский')}</span>
        <button class="iconbtn" data-act="lang-dict">${ruOn() ? 'вкл.' : 'כָּבוּי'}</button></div>
    </div>`;
}

/* ---------------- names (Russian mode) ---------------- */
function renderNames() {
  onHome = false;
  app.innerHTML = `<header class="topbar"><button class="close" data-act="home" aria-label="Назад">→</button>
      <span class="brand">Имена и названия</span></header>
    <div class="dict">
      <p class="hint" lang="ru">В школе на иврите имена звучат иначе, чем в русских переводах Библии. Например, נֹחַ — это Ноах, а по-русски его называют Ной. В переводах в приложении мы пишем так: «Ноах (Ной)».</p>
      <div class="names" lang="ru"><div class="nrow nhead"><span>иврит</span><span>как говорят в школе</span><span>по-русски</span></div>
      ${C.names.map(([he, school, rus]) => `<div class="nrow"><span class="nhe" lang="he" dir="rtl">${esc(he)}</span><span>${esc(school)}</span><span>${esc(rus)}</span></div>`).join('')}</div>
    </div>`;
}

/* ---------------- events ---------------- */
app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const a = el.dataset.act;
  switch (a) {
    case 'go': {
      if (!stepUnlocked(el.dataset.kind, el.dataset.id)) { toast(tr('🔒 קֹדֶם סַיְּמוּ אֶת הַשִּׁעוּרִים הַקּוֹדְמִים', '🔒 Сначала пройдите предыдущие уроки')); return; }
      el.dataset.kind === 'lesson' ? startLesson(el.dataset.id) : startChest(el.dataset.id);
      break;
    }
    case 'home': window.scrollTo(0, 0); renderHome(); break;
    case 'jump': document.getElementById('book-' + el.dataset.book)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); break;
    case 'quit': stopSpeech(); renderHome(); break;
    case 'dict': renderDict(); window.scrollTo(0, 0); break;
    case 'review': startReview(); window.scrollTo(0, 0); break;
    case 'sound': S.sound = !S.sound; save(); renderDict(); break;
    case 'lang': S.lang = ruOn() ? 'he' : 'ru'; save(); renderHome(); toast(ruOn() ? 'Перевод на русский включён' : 'הַתִּרְגּוּם לְרוּסִית כָּבוּי'); break;
    case 'lang-dict': S.lang = ruOn() ? 'he' : 'ru'; save(); renderDict(); break;
    case 'names': renderNames(); window.scrollTo(0, 0); break;
    case 'tr': R.ui.tr = { ...(R.ui.tr || {}), [el.dataset.i]: !(R.ui.tr || {})[el.dataset.i] }; renderVerse(); break;
    case 'next-stage': R.stage++; R.ui = {}; renderSession(); window.scrollTo(0, 0); break;
    case 'say-story': speak(R.les.story.join(' ')); break;
    case 'say-verse': { const v = R.les.verses[+el.dataset.i]; speak(plain(v.text), v.audio); break; }
    case 'say': speak(el.dataset.text); break;
    case 'flip': {
      R.flipped.add(el.dataset.id);
      speak(C.wordById[el.dataset.id].t);
      renderWords();
      break;
    }
    case 'vw': {
      const w = el.dataset.w ? C.wordById[el.dataset.w] : null;
      R.ui.pop = { t: el.dataset.t, m: w ? w.m : el.dataset.g, ru: w?.ru };
      speak(el.dataset.t);
      renderVerse();
      break;
    }
    case 'sel': R.ui.sel = +el.dataset.i; renderTask(); break;
    case 'pick': if (R.ui.locked || R.ui.picked.includes(+el.dataset.i)) break; R.ui.picked.push(+el.dataset.i); speak(R.queue[0].tiles[+el.dataset.i]); renderTask(); break;
    case 'unpick': if (!R.ui.locked) { R.ui.picked.splice(+el.dataset.k, 1); renderTask(); } break;
    case 'check': check(); break;
    case 'after': afterTask(); window.scrollTo(0, 0); break;
    case 'mL': matchTap('L', el.dataset.id); break;
    case 'mR': matchTap('R', el.dataset.id); break;
  }
});

/* ---------------- boot ---------------- */
loadCourse().then(c => { C = c; renderHome(); })
  .catch(() => { app.innerHTML = `<div class="empty">${mascot('oops')}<p>${tr('לֹא הִצְלַחְנוּ לִטְעֹן אֶת הַשִּׁעוּרִים. נַסּוּ לְרַעְנֵן אֶת הַדַּף.', 'Не удалось загрузить уроки. Попробуйте обновить страницу.')}</p></div>`; });

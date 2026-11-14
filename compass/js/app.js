import { h, $, modal, toast, confirmBox, download } from './ui.js';
import { store, settings, sessions, fmtDate, dayKey } from './store.js';
import { TECHNIQUES, byId, MODES, LEVEL_NAMES, REQUESTS } from './techniques.js';
import { runSession } from './engine.js';
import { feelingsGrid, chip, TOTAL } from './feelings.js';
import { courseScreen, courseStatus } from './course.js';
import { beliefsScreen, beliefs } from './beliefs.js';
import { scheduleReminder } from './remind.js';
import { tpl } from './ppp.js';
import { ruVoices, speak, ttsAvailable, recognitionAvailable } from './speech.js';
import { mapPreview, exportMap, blocksOf } from './canvas.js';

const app = $('#app');
const backBtn = (to = '#/') => h('a', { class: 'link', href: to }, '← Назад');

function applyTheme() {
  const t = settings.get().theme;
  document.documentElement.dataset.theme = t === 'auto' ? '' : t;
  if (t === 'auto') delete document.documentElement.dataset.theme;
}

// ---------------- Главная ----------------
function home() {
  const cs = courseStatus();
  const today = dayKey();
  const activeB = beliefs.all().filter(b => { const d = (new Date(today) - new Date(b.start)) / 864e5; return d >= 0 && d < 14; });
  const bDone = activeB.filter(b => (b.days[today] || 0) >= (b.target || 30)).length;
  app.replaceChildren(h('div', { class: 'page home' },
    h('header', { class: 'top' },
      h('div', null, h('h1', null, 'Внутренний компас'), h('p', { class: 'muted tagline' }, '11 техник ТВП для проработки эмоций, страхов и целей')),
      h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Настройки' }, '⚙️')),
    h('a', { class: 'sos', href: '#/run/tablet/guide/sos' },
      h('span', { class: 'sos-badge' }, 'SOS'),
      h('span', null, h('b', null, 'Скорая помощь'), h('small', null, 'Паника, ярость, обида — вернуть контроль за 2–3 минуты. Спокойный голос проведёт по 6 шагам.'))),
    h('a', { class: 'sos-alt', href: '#/run/tablet/solo' }, '🔇 Без звука — крупные карточки'),
    h('a', { class: 'card wizard-card', href: '#/wizard' },
      h('span', { class: 'big-ic' }, '🧭'),
      h('span', null, h('b', null, 'Подобрать практику'), h('small', { class: 'muted' }, 'Выберите свой запрос — приложение предложит нужную технику'))),
    h('div', { class: 'tiles' },
      tile('#/course', '🔁', 'Курс привычек', cs ? (cs.over ? 'Курс завершён' : `День ${cs.day} из 14${cs.todayDone ? ' · ✓' : ''}`) : '14 вечеров'),
      tile('#/beliefs', '📅', 'Закрепление', activeB.length ? `Сегодня ${bDone}/${activeB.length}` : 'Утренние повторения'),
      tile('#/feelings', '💗', 'Таблица чувств', `${TOTAL} чувств и состояний`),
      tile('#/journal', '📖', 'Журнал', `${sessions.all().length} записей`)),
    h('h2', null, 'Все практики'),
    h('div', { class: 'tech-list' }, TECHNIQUES.map(techRow)),
    h('footer', { class: 'foot muted small' },
      h('p', null, '🔒 Все записи хранятся только на этом устройстве и никуда не передаются. Приложение работает без интернета.'),
      h('a', { href: '#/about' }, 'О безопасности и ограничениях'))));
}
const tile = (href, ic, t, sub) => h('a', { class: 'tile', href }, h('span', { class: 'big-ic' }, ic), h('b', null, t), h('small', { class: 'muted' }, sub));
function techRow(t) {
  return h('a', { class: 'tech-row', href: t.route || `#/t/${t.id}`, style: { '--c': t.color } },
    h('span', { class: 'tech-ic' }, t.icon),
    h('span', { class: 'tech-txt' }, h('b', null, t.name), h('small', { class: 'muted' }, t.short),
      h('span', { class: 'mode-icons' }, Object.keys(t.modes).map(m => h('span', { title: MODES[m].name }, MODES[m].icon)), h('span', { class: 'muted' }, ' · ' + t.duration))),
    h('span', { class: 'chev' }, '›'));
}

// ---------------- Мастер подбора ----------------
function wizard(reqId) {
  if (reqId) {
    const r = REQUESTS.find(x => x.id === reqId);
    app.replaceChildren(h('div', { class: 'page' }, backBtn('#/wizard'),
      h('h1', null, r.icon + ' ' + r.name),
      h('p', { class: 'muted' }, 'Рекомендуем начать с первой практики в списке.'),
      h('div', { class: 'tech-list' }, r.techs.map((id, i) => { const el = techRow(byId(id)); if (i === 0) el.classList.add('first'); return el; }))));
    return;
  }
  app.replaceChildren(h('div', { class: 'page' }, backBtn(),
    h('h1', null, '🧭 Что вас беспокоит?'),
    h('p', { class: 'muted' }, 'Выберите запрос, который ближе всего.'),
    h('div', { class: 'req-grid' }, REQUESTS.map(r => h('a', { class: 'req', href: `#/wizard/${r.id}` }, h('span', { class: 'big-ic' }, r.icon), h('b', null, r.name), h('small', { class: 'muted' }, r.desc))))));
}

// ---------------- Страница техники ----------------
function detail(id) {
  const t = byId(id);
  if (!t) return home();
  if (t.route) { location.hash = t.route; return; }
  const guided = sessions.guidedDone(t.id);
  const all = sessions.all().filter(s => s.tech === t.id);
  const order = ['guide', 'pair', 'solo'].filter(m => t.modes[m]).sort((a, b) => rank(t.modes[a]) - rank(t.modes[b]));
  app.replaceChildren(h('div', { class: 'page' }, backBtn(),
    h('div', { class: 'tech-head', style: { '--c': t.color } },
      h('span', { class: 'tech-ic xl' }, t.icon),
      h('div', null, h('h1', null, t.name), h('small', { class: 'muted' }, `Техника ${t.n} · в оригинале: ${t.orig} · ${t.duration}`))),
    h('p', null, t.about),
    t.heavy && h('div', { class: 'hint warn' }, 'Затрагивает тяжёлые переживания. Лучше проходить, когда есть время и силы, а после — побыть в покое. Приложение не заменяет психотерапевта.'),
    h('h2', null, 'Как будете проходить?'),
    h('div', { class: 'modes' }, order.map(m => {
      const lvl = t.modes[m];
      const locked = lvl === 'after' && t.unlock && guided < t.unlock;
      return h(locked ? 'div' : 'a', { class: 'mode-card' + (locked ? ' locked' : '') + (lvl === 'rec' || lvl === 'main' ? ' rec' : ''), href: locked ? null : `#/run/${t.id}/${m}` },
        h('div', { class: 'row between' }, h('b', null, MODES[m].icon + ' ' + MODES[m].name), h('span', { class: 'badge ' + lvl }, LEVEL_NAMES[lvl])),
        h('small', { class: 'muted' }, t.modeNotes?.[m] || MODES[m].desc),
        locked && h('small', { class: 'lock' }, `🔒 Откроется после ${t.unlock} прохождений с гидом или партнёром, когда алгоритм запомнится (пройдено: ${guided}).`));
    })),
    all.length ? h('p', { class: 'muted small' }, `Вы проходили эту практику ${all.length} раз. `, h('a', { href: '#/journal' }, 'Журнал →')) : null));
}
const rank = l => ({ main: 0, rec: 0, opt: 2, after: 3 }[l] ?? 4);

// ---------------- Сессия ----------------
function run(id, mode, flag) {
  const t = byId(id);
  if (!t || !t.modes[mode]) return home();
  if (t.modes[mode] === 'after' && t.unlock && sessions.guidedDone(t.id) < t.unlock) return detail(id);
  runSession(app, t, mode, { skipIntro: flag === 'sos', onExit: () => { location.hash = t.quick ? '#/' : `#/t/${t.id}`; } });
}

// ---------------- Журнал ----------------
function journal() {
  const list = sessions.all();
  app.replaceChildren(h('div', { class: 'page' }, backBtn(),
    h('h1', null, '📖 Журнал'),
    h('p', { class: 'muted' }, 'Здесь все ваши прохождения. Хранятся только на этом устройстве.'),
    list.length ? h('div', { class: 'jlist' }, list.map(s => {
      const t = byId(s.tech) || { name: s.tech, icon: '•' };
      const sc = s.data?.scales || {};
      return h('button', { class: 'jrow', onclick: () => sessionDetail(s) },
        h('span', { class: 'tech-ic' }, t.icon),
        h('span', { class: 'tech-txt' }, h('b', null, t.name), h('small', { class: 'muted' }, `${fmtDate(s.start)} · ${MODES[s.mode]?.name || ''}${s.done ? '' : ' · не завершено'}`)),
        sc.before || sc.after ? h('span', { class: 'jscore' }, `${sc.before ?? '–'}→${sc.after ?? '–'}`) : null);
    })) : h('div', { class: 'empty' }, 'Пока пусто. Пройдите первую практику.'),
    store.get('courses', []).length ? h('div', null, h('h2', null, 'Архив курсов привычек'), store.get('courses', []).map(c => h('div', { class: 'card small' }, `${c.habit === 'other' ? c.custom : tpl(c).name} · с ${fmtDate(c.start + 'T12:00')} · записей: ${Object.keys(c.entries).length}`))) : null));
}
function sessionDetail(s) {
  const t = byId(s.tech) || { name: s.tech };
  const d = s.data || {};
  const fields = Object.entries(d.fields || {}).filter(([k, v]) => v && !['format'].includes(k) && !/^l\d$/.test(k));
  const close = modal(h('div', null,
    h('p', { class: 'muted' }, `${fmtDate(s.start)} · ${MODES[s.mode]?.name || ''}${s.done ? '' : ' · не завершено'}`),
    d.scales && (d.scales.before || d.scales.after) && h('div', { class: 'compare' }, h('div', null, h('small', null, 'До'), h('b', null, d.scales.before ?? '–')), h('span', null, '→'), h('div', null, h('small', null, 'После'), h('b', null, d.scales.after ?? '–'))),
    fields.map(([k, v]) => h('p', null, h('small', { class: 'muted' }, LABELS[k] || k), h('br'), v)),
    d.map && (d.map.items.length > (d.map.preset === 'rod' ? 8 : 0)) && h('div', null, h('div', { class: 'map-wrap small' }, mapPreview(d.map)), blocksOf(d.map).length ? h('button', { class: 'btn soft', onclick: () => exportMap(d.map, t.name) }, '🖼 Сохранить карту') : null),
    d.log?.length ? h('details', null, h('summary', null, `Записи по ходу (${d.log.length})`), d.log.map(l => h('div', { class: 'logrow' }, h('small', { class: 'muted' }, l.q), h('div', null, l.a)))) : null,
    h('div', { class: 'row end' }, h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('Удалить запись навсегда?', { ok: 'Удалить', danger: true })) { sessions.remove(s.id); close(); journal(); } } }, 'Удалить'))),
    { title: t.name });
}
const LABELS = { person: 'Человек', topic: 'Тема', goal: 'Цель', belief: 'Новое убеждение', lesson: 'Урок', well: 'Старые убеждения из Колодца', talents: 'Таланты', step: 'Первый шаг', i1: 'Я1', root: 'Корень', mirror: 'Отражение', forgive: 'Прощение', sorry: 'Раскаяние', thanks: 'Благодарность', love: 'Любовь', feeling: 'Чувство' };

// ---------------- Справочник ----------------
function feelingsPage() {
  const sel = new Set();
  app.replaceChildren(h('div', { class: 'page' }, backBtn(),
    h('h1', null, '💗 Таблица чувств'),
    h('p', { class: 'muted' }, `Таблица чувств из «Техник ТВП»: ${TOTAL} чувств, мыслей и состояний в 5 кластерах. Вызывается кнопкой 💗 на любом шаге практики, если трудно назвать, что ты чувствуешь.`),
    feelingsGrid(sel, w => (sel.has(w) ? sel.delete(w) : sel.add(w)))));
}

// ---------------- Настройки ----------------
function settingsPage() {
  const s = settings.get();
  const voices = ruVoices();
  const sw = (key, label, sub) => h('label', { class: 'switch-row' }, h('span', null, label, sub && h('small', { class: 'muted' }, sub)),
    h('input', { type: 'checkbox', checked: s[key], onchange: e => { settings.set({ [key]: e.target.checked }); } }));
  app.replaceChildren(h('div', { class: 'page' }, backBtn(),
    h('h1', null, '⚙️ Настройки'),
    h('div', { class: 'card' },
      h('h3', null, 'Голосовой гид'),
      !ttsAvailable() && h('p', { class: 'hint warn' }, 'Этот браузер не умеет озвучивать текст. В режиме гида текст будет крупно на экране.'),
      sw('tts', 'Озвучивать шаги', 'В режиме «Ведёт приложение»'),
      h('label', { class: 'field' }, h('span', null, 'Голос'),
        h('select', { class: 'input', onchange: e => settings.set({ voice: e.target.value }) },
          h('option', { value: '' }, voices.length ? 'Русский по умолчанию' : 'Русские голоса не найдены — установите в настройках телефона'),
          voices.map(v => h('option', { value: v.voiceURI, selected: v.voiceURI === s.voice }, v.name + (v.localService ? ' (офлайн)' : ''))))),
      h('label', { class: 'field' }, h('span', null, 'Скорость речи'),
        h('input', { type: 'range', min: 0.6, max: 1.3, step: 0.05, value: s.rate, onchange: e => settings.set({ rate: +e.target.value }) })),
      h('button', { class: 'btn soft', onclick: () => speak('Сделайте медленный вдох… и длинный выдох. Я рядом.') }, '▶ Проверить голос'),
      sw('vibro', 'Вибрация', 'Подтверждение касаний с закрытыми глазами'),
      recognitionAvailable() && sw('voiceCmd', 'Голосовые команды', '«Дальше», «Есть ещё», «Больше ничего». Внимание: распознавание речи в браузере может отправлять звук на сервер Google/Apple и не работает офлайн.')),
    h('div', { class: 'card' },
      h('h3', null, 'Оформление'),
      h('div', { class: 'seg' }, [['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([v, l]) => h('button', { class: s.theme === v ? 'on' : '', onclick: () => { settings.set({ theme: v }); applyTheme(); settingsPage(); } }, l)))),
    h('div', { class: 'card' },
      h('h3', null, '🔒 Данные'),
      h('p', { class: 'muted small' }, 'Всё хранится только в памяти этого браузера. Если очистить данные браузера или сменить телефон — записи пропадут. Сделайте резервную копию.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn soft', onclick: () => download(new Blob([JSON.stringify({ app: 'vnutrenniy-kompas', v: 1, at: Date.now(), data: store.dump() })], { type: 'application/json' }), `kompas-backup-${dayKey()}.json`) }, '⬇ Резервная копия'),
        h('label', { class: 'btn soft' }, '⬆ Восстановить', h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async e => {
          try { const j = JSON.parse(await e.target.files[0].text()); if (j.app !== 'vnutrenniy-kompas') throw 0; if (!(await confirmBox('Заменить текущие данные данными из файла?', { ok: 'Восстановить' }))) return; store.wipe(); store.load(j.data); toast('Восстановлено'); applyTheme(); settingsPage(); }
          catch { toast('Это не файл резервной копии'); }
        } })),
        h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('Удалить все записи, дневники, карты и настройки с этого устройства? Это нельзя отменить.', { ok: 'Удалить всё', danger: true })) { store.wipe(); toast('Все данные удалены'); location.hash = '#/'; } } }, 'Удалить всё'))),
    installCard()));
}
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
function installCard() {
  if (matchMedia('(display-mode: standalone)').matches) return null;
  return h('div', { class: 'card' }, h('h3', null, '📲 Установить на телефон'),
    deferredInstall ? h('button', { class: 'btn primary', onclick: async () => { deferredInstall.prompt(); deferredInstall = null; } }, 'Установить приложение')
      : h('p', { class: 'muted small' }, 'Android (Chrome): меню ⋮ → «Добавить на главный экран». iPhone (Safari): «Поделиться» → «На экран „Домой“». После установки приложение работает без интернета.'));
}

// ---------------- О безопасности ----------------
function about(first) {
  const body = h('div', { class: 'about' },
    h('p', null, 'Приложение — инструмент самопомощи для самостоятельной и парной работы с эмоциями, страхами, привычками и целями. Оно ', h('b', null, 'не заменяет'), ' психолога, психотерапевта или врача.'),
    h('ul', null,
      h('li', null, 'Если у вас тяжёлое состояние, мысли о самоповреждении или суициде — пожалуйста, обратитесь за помощью к специалисту или позвоните в экстренную службу ', h('b', null, '112'), '.'),
      h('li', null, 'Глубокие практики с закрытыми глазами не выполняйте за рулём и в местах, где нужно внимание.'),
      h('li', null, 'Вы можете остановить любую практику в любой момент — кнопкой ✕.'),
      h('li', null, '🔒 Все записи хранятся только на вашем устройстве и никуда не отправляются. Сделать резервную копию можно в настройках.')),
    h('p', { class: 'muted source' }, 'Техники — по материалам «Техники ТВП» (Трансцендентная Ведическая Психология, Владимир Древс).'));
  if (first) {
    const close = modal(h('div', null, body, h('button', { class: 'btn primary wide', onclick: () => { store.set('agreed', 1); close(); } }, 'Понятно')), { title: 'Добро пожаловать', onClose: () => store.set('agreed', 1) });
    return;
  }
  app.replaceChildren(h('div', { class: 'page' }, backBtn(), h('h1', null, 'О безопасности'), body));
}

// ---------------- Роутер ----------------
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  window.scrollTo(0, 0);
  switch (parts[0]) {
    case 't': return detail(parts[1]);
    case 'run': return run(parts[1], parts[2], parts[3]);
    case 'wizard': return wizard(parts[1]);
    case 'course': return courseScreen(app, () => backBtn());
    case 'beliefs': return beliefsScreen(app, () => backBtn());
    case 'journal': return journal();
    case 'feelings': return feelingsPage();
    case 'settings': return settingsPage();
    case 'about': return about();
    default: return home();
  }
}
window.addEventListener('hashchange', route);
applyTheme();
route();
if (!store.get('agreed') && !location.hash.includes('sos')) about(true);
scheduleReminder();
try { navigator.storage?.persist?.(); } catch {}
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
void chip;

// «Перезапись привычек»: 14-дневный вечерний дневник, трекер, счётчик формулы, напоминания
import { h, toast, confirmBox, download } from './ui.js';
import { store, dayKey, addDays, daysBetween, settings, fmtDate } from './store.js';
import { openFeelings, chip } from './feelings.js';
import { counterEl } from './beliefs.js';
import { scheduleReminder, notifySupported } from './remind.js';

export const HABITS = [
  ['food', '🍔', 'Переедание', 'Я ем, когда голоден(на), и останавливаюсь, когда сыт(а). Я забочусь о своём теле.'],
  ['sweet', '🍬', 'Сладкое', 'Я нахожу радость в жизни, а не в сахаре. Мне сладко и без сладкого.'],
  ['smoke', '🚬', 'Курение', 'Я дышу свободно. Я выбираю чистый воздух и спокойствие без сигарет.'],
  ['alco', '🍷', 'Алкоголь', 'Я расслабляюсь и радуюсь трезвым. Моя ясность — моя сила.'],
  ['phone', '📱', 'Гаджеты и соцсети', 'Я хозяин(хозяйка) своего внимания. Я живу здесь и сейчас.'],
  ['shop', '🛍', 'Импульсивные покупки', 'Я покупаю осознанно. У меня всё есть, я в безопасности.'],
  ['procr', '⏳', 'Прокрастинация', 'Я делаю маленький шаг сразу. Мне легко начинать.'],
  ['other', '✏️', 'Другое', ''],
];
const habitOf = id => HABITS.find(x => x[0] === id) || HABITS[HABITS.length - 1];

const get = () => store.get('course', null);
const put = c => store.set('course', c);

export function courseDay(c, k = dayKey()) { return daysBetween(c.start, k) + 1; }

export function courseScreen(root, back) {
  const c = get();
  if (!c) return setup(root, back);
  if (courseDay(c) > 14 || c.finished) return summary(root, back, c);
  main(root, back, c);
}

function setup(root, back) {
  let habit = 'food', custom = '';
  const aff = h('textarea', { class: 'input', rows: 2 });
  const customInp = h('input', { class: 'input', placeholder: 'Какая привычка?', style: { display: 'none' }, oninput: e => { custom = e.target.value; } });
  const time = h('input', { class: 'input', type: 'time', value: settings.get().remindTime });
  const chips = h('div', { class: 'chips' });
  const renderChips = () => chips.replaceChildren(...HABITS.map(([id, ic, name, a]) => h('button', {
    class: 'chip big' + (habit === id ? ' on' : ''), style: { '--c': '#3aa76d' },
    onclick: () => { habit = id; aff.value = a; customInp.style.display = id === 'other' ? '' : 'none'; renderChips(); },
  }, ic + ' ' + name)));
  aff.value = HABITS[0][3];
  renderChips();
  root.replaceChildren(h('div', { class: 'page' },
    back(),
    h('h1', null, '🔁 Перезапись привычек'),
    h('p', { class: 'muted' }, '14 вечеров по 10–15 минут перед сном. Вы разбираете день: что запускало привычку, что вы чувствовали, какую потребность она закрывала — и закрепляете формулу самонастроя 20–50 повторениями.'),
    h('div', { class: 'card' },
      h('h3', null, 'С какой привычкой работаем?'), chips, customInp,
      h('h3', null, 'Формула самонастроя'),
      h('p', { class: 'muted small' }, 'Короткая, в настоящем времени, без частицы «не». Её вы будете повторять каждый вечер.'),
      aff,
      h('h3', null, 'Вечернее напоминание'),
      time,
      h('button', { class: 'btn primary wide', onclick: () => {
        if (habit === 'other' && !custom.trim()) return toast('Напишите, какая привычка');
        const course = { habit, custom: custom.trim(), aff: aff.value.trim(), start: dayKey(), remind: time.value, entries: {}, target: 30 };
        put(course); settings.set({ remindTime: time.value });
        scheduleReminder(true);
        courseScreen(root, back);
      } }, 'Начать 14 дней'))));
}

function main(root, back, c) {
  const today = dayKey();
  const day = courseDay(c);
  const [, icon, name] = habitOf(c.habit);
  const title = c.habit === 'other' ? c.custom : name;
  const done = Object.keys(c.entries).length;
  const cells = Array.from({ length: 14 }, (_, i) => {
    const k = addDays(c.start, i); const e = c.entries[k];
    const cls = e ? (e.state === 'slip' ? 'slip' : 'done') : k < today ? 'miss' : k === today ? 'today' : 'future';
    return h('button', { class: 'cal-cell ' + cls, disabled: k > today, onclick: () => diary(root, back, c, k) }, i + 1);
  });
  const cravings = Array.from({ length: 14 }, (_, i) => c.entries[addDays(c.start, i)]?.crave || 0);
  root.replaceChildren(h('div', { class: 'page' },
    back(),
    h('h1', null, icon + ' ' + title),
    h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('b', null, `День ${day} из 14`), h('span', { class: 'muted small' }, `заполнено ${done}`)),
      h('div', { class: 'bar' }, h('i', { style: { width: (done / 14) * 100 + '%' } })),
      h('div', { class: 'cal' }, cells),
      h('div', { class: 'legend muted small' }, h('span', { class: 'lg done' }, 'запись'), h('span', { class: 'lg slip' }, 'был срыв'), h('span', { class: 'lg miss' }, 'пропуск')),
      h('button', { class: 'btn primary wide', onclick: () => diary(root, back, c, today) }, c.entries[today] ? '✓ Сегодня заполнено — открыть' : '🌙 Вечерний дневник')),
    cravings.some(Boolean) && h('div', { class: 'card' },
      h('h3', null, 'Сила тяги по дням'),
      h('div', { class: 'bars' }, cravings.map((v, i) => h('div', { class: 'bcol', title: `День ${i + 1}: ${v || '—'}` }, h('i', { style: { height: v * 10 + '%' } }), h('small', null, i + 1))))),
    h('div', { class: 'card' },
      h('h3', null, 'Формула самонастроя'),
      h('p', { class: 'belief-text' }, '«' + (c.aff || '—') + '»'),
      h('h3', null, 'Напоминание'),
      h('div', { class: 'row' },
        h('input', { class: 'input', type: 'time', value: c.remind, onchange: e => { c.remind = e.target.value; put(c); settings.set({ remindTime: c.remind }); scheduleReminder(true); toast('Время сохранено'); } }),
        h('button', { class: 'btn soft', onclick: () => icsDownload(c, title) }, '📆 В календарь телефона')),
      h('p', { class: 'muted small' }, notifySupported()
        ? 'Уведомление придёт, пока приложение открыто или недавно свёрнуто. Надёжнее — добавить повторяющееся событие в календарь телефона (файл .ics): оно напомнит даже без интернета.'
        : 'Добавьте повторяющееся событие в календарь телефона (файл .ics) — он напомнит каждый вечер, даже без интернета.'),
      h('button', { class: 'btn ghost', onclick: async () => { if (await confirmBox('Завершить курс досрочно? Записи сохранятся в архиве.', { ok: 'Завершить' })) { archive(c); courseScreen(root, back); } } }, 'Завершить курс'))));
}

function archive(c) {
  const arch = store.get('courses', []); arch.unshift({ ...c, finished: true, end: dayKey() }); store.set('courses', arch.slice(0, 30));
  store.del('course');
}

const Q = [
  ['trig', 'Ситуации-триггеры', 'Что происходило перед тягой? Где вы были, с кем, во сколько, что делали?'],
  ['need', 'Потребность', 'Какую потребность вы пытались закрыть привычкой? Отдых, утешение, награда, скука, близость, тревога…'],
  ['slip', 'Разбор срыва', 'Что произошло? Что вы подумали и почувствовали? Что можно сделать иначе в следующий раз?'],
  ['instead', 'Что помогло', 'Чем вы заменили привычку? Что сработало сегодня?'],
  ['thanks', 'Благодарность себе', 'За что я благодарю себя сегодня?'],
];

function diary(root, back, c, k) {
  const e = { state: '', crave: 0, feelings: [], count: 0, ...(c.entries[k] || {}) };
  const day = courseDay(c, k);
  const save = () => { c.entries[k] = { ...e, saved: Date.now() }; put(c); };
  const stateBtns = h('div', { class: 'choices' });
  const slipBox = h('div');
  const renderState = () => {
    stateBtns.replaceChildren(...[['clean', '🌿 Тяги почти не было'], ['held', '💪 Была тяга — справился(ась)'], ['slip', '🌧 Был срыв']].map(([v, l]) =>
      h('button', { class: 'choice' + (e.state === v ? ' on' : ''), onclick: () => { e.state = v; renderState(); } }, h('b', null, l))));
    slipBox.style.display = e.state === 'slip' ? '' : 'none';
  };
  const area = (key) => h('textarea', { class: 'input', rows: 3, value: e[key] || '', oninput: ev => { e[key] = ev.target.value; } });
  const qBlock = ([key, t, p]) => h('label', { class: 'field' }, h('span', null, h('b', null, t), h('br'), h('small', { class: 'muted' }, p)), area(key));
  const feelBox = h('div', { class: 'chips' });
  const renderFeel = () => feelBox.replaceChildren(...e.feelings.map(w => chip(w, { selected: true })), h('button', { class: 'btn soft small', onclick: () => openFeelings({ selected: e.feelings, onDone: ws => { e.feelings = ws; renderFeel(); } }) }, e.feelings.length ? 'Изменить' : '💗 Выбрать чувства'));
  const scale = h('div', { class: 'scale' });
  const renderScale = () => scale.replaceChildren(...Array.from({ length: 10 }, (_, i) => h('button', { class: 'scale-btn' + (e.crave === i + 1 ? ' on' : ''), style: { '--k': i / 9 }, onclick: () => { e.crave = i + 1; renderScale(); } }, i + 1)));
  renderState(); renderFeel(); renderScale();
  slipBox.append(qBlock(Q[2]));
  root.replaceChildren(h('div', { class: 'page' },
    h('button', { class: 'link', onclick: () => courseScreen(root, back) }, '← К курсу'),
    h('h1', null, `🌙 День ${day} · ${fmtDate(k + 'T12:00')}`),
    h('div', { class: 'card' },
      h('h3', null, 'Как сегодня проявлялась привычка?'), stateBtns,
      h('h3', null, 'Сила тяги (1–10)'), scale,
      qBlock(Q[0]),
      h('div', { class: 'field' }, h('span', null, h('b', null, 'Что вы чувствовали в тот момент?')), feelBox),
      qBlock(Q[1]), slipBox, qBlock(Q[3]), qBlock(Q[4])),
    h('div', { class: 'card' },
      h('h3', null, 'Формула самонастроя'),
      counterEl(c.aff, { target: c.target || 30, start: e.count || 0, onChange: (n, t) => { e.count = n; c.target = t; } })),
    h('button', { class: 'btn primary wide', onclick: () => {
      if (!e.state) return toast('Отметьте, как проявлялась привычка');
      save(); toast('Запись сохранена 🌙');
      if (courseDay(c) >= 14 && Object.keys(c.entries).length >= 1 && k === addDays(c.start, 13)) c.finished = true, put(c);
      courseScreen(root, back);
    } }, 'Сохранить запись')));
}

function summary(root, back, c) {
  const [, icon, name] = habitOf(c.habit);
  const entries = Object.values(c.entries);
  const slips = entries.filter(e => e.state === 'slip').length;
  const cr = entries.map(e => e.crave).filter(Boolean);
  const first = cr.slice(0, 3), last = cr.slice(-3);
  const avg = a => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : '—');
  root.replaceChildren(h('div', { class: 'page' },
    back(),
    h('h1', null, `${icon} Курс завершён`),
    h('div', { class: 'card center' },
      h('div', { class: 'end-icon' }, '🏆'),
      h('p', null, `${c.habit === 'other' ? c.custom : name}: заполнено ${entries.length} из 14 вечеров, срывов — ${slips}.`),
      cr.length ? h('div', { class: 'compare' }, h('div', null, h('small', null, 'Тяга в начале'), h('b', null, avg(first))), h('span', null, '→'), h('div', null, h('small', null, 'в конце'), h('b', null, avg(last)))) : null,
      h('p', { class: 'muted' }, 'Если привычка ещё держится — пройдите ещё 14 дней. Новый нейронный путь укрепляется повторением.')),
    h('button', { class: 'btn primary wide', onclick: () => { archive(c); courseScreen(root, back); } }, 'Начать новый курс')));
}

function icsDownload(c, title) {
  const [hh, mm] = (c.remind || '21:30').split(':');
  const d = c.start.replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vnutrenniy kompas//RU', 'BEGIN:VEVENT',
    `UID:course-${d}@kompas.local`, `DTSTAMP:${now}`, `DTSTART:${d}T${hh}${mm}00`, 'DURATION:PT15M', 'RRULE:FREQ=DAILY;COUNT=14',
    `SUMMARY:🌙 Дневник привычки: ${title}`, 'DESCRIPTION:10–15 минут: вечерний дневник и формула самонастроя.',
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Вечерний дневник', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  download(new Blob([ics], { type: 'text/calendar' }), 'dnevnik-privychki.ics');
}

export function courseStatus() {
  const c = get(); if (!c) return null;
  const day = courseDay(c);
  return { day: Math.min(day, 14), todayDone: !!c.entries[dayKey()], over: day > 14 };
}

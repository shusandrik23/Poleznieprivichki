// «Перезапись привычек»: 14-дневный вечерний дневник, трекер, счётчик формулы, напоминания
import { h, toast, confirmBox, download } from './ui.js';
import { store, dayKey, addDays, daysBetween, settings, fmtDate } from './store.js';
import { openFeelings, chip } from './feelings.js';
import { counterEl } from './beliefs.js';
import { scheduleReminder, notifySupported } from './remind.js';
import { TEMPLATES, tpl, sections } from './ppp.js';

export const HABITS = TEMPLATES;
const habitOf = id => TEMPLATES.find(x => x[0] === id) || TEMPLATES[3];

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
  const aff = h('textarea', { class: 'input', rows: 3 });
  const customInp = h('input', { class: 'input', placeholder: 'Какая привычка? Например: компьютерные игры', style: { display: 'none' }, oninput: e => { custom = e.target.value; aff.value = tpl({ habit: 'other', custom }).aff; } });
  const time = h('input', { class: 'input', type: 'time', value: settings.get().remindTime });
  const chips = h('div', { class: 'chips' });
  const renderChips = () => chips.replaceChildren(...TEMPLATES.map(([id, ic, name]) => h('button', {
    class: 'chip big' + (habit === id ? ' on' : ''), style: { '--c': '#3aa76d' },
    onclick: () => { habit = id; aff.value = tpl({ habit: id, custom }).aff; customInp.style.display = id === 'other' ? '' : 'none'; renderChips(); },
  }, ic + ' ' + name)));
  aff.value = tpl({ habit }).aff;
  renderChips();
  root.replaceChildren(h('div', { class: 'page' },
    back(),
    h('h1', null, '🔁 Перезапись привычек'),
    h('p', { class: 'muted' }, 'ППП — переписывание подсознательной программы. Избавляет от зависимостей и вредных привычек: алкоголь, сигареты, кофе, сладкое, азартные и компьютерные игры, трудоголизм, покупки и любые другие привязанности. Выполняется самостоятельно, минимум 14 дней по 10–15 минут вечером, перед сном.'),
    h('div', { class: 'hint' }, 'Создаёт новые отпечатки и обесточивает старые, делает Разум сильнее. Ум сам захочет контролировать привычку: ему не захочется поступать по старой самскаре, ведь каждый день нужно будет об этом писать.'),
    h('div', { class: 'card' },
      h('h3', null, 'Выбери шаблон под свою привычку'), chips, customInp,
      h('h3', null, 'Формула самонастроя'),
      h('p', { class: 'muted small' }, 'Её ты будешь писать каждый вечер от 20 до 50 раз. Можно изменить под себя.'),
      aff,
      h('h3', null, 'Вечернее напоминание'),
      time,
      h('button', { class: 'btn primary wide', onclick: () => {
        if (habit === 'other' && !custom.trim()) return toast('Напиши, какая привычка');
        const course = { habit, custom: custom.trim(), aff: aff.value.trim(), start: dayKey(), remind: time.value, entries: {}, target: 30 };
        put(course); settings.set({ remindTime: time.value });
        scheduleReminder(true);
        courseScreen(root, back);
      } }, 'Начать 14 дней'))));
}

function main(root, back, c) {
  const today = dayKey();
  const day = courseDay(c);
  const icon = tpl(c).icon;
  const title = c.habit === 'other' ? c.custom : tpl(c).name;
  const done = Object.keys(c.entries).length;
  const cells = Array.from({ length: 14 }, (_, i) => {
    const k = addDays(c.start, i); const e = c.entries[k];
    const cls = e ? (e.state === 'slip' ? 'slip' : 'done') : k < today ? 'miss' : k === today ? 'today' : 'future';
    return h('button', { class: 'cal-cell ' + cls, disabled: k > today, onclick: () => diary(root, back, c, k) }, i + 1);
  });
  const cravings = Array.from({ length: 14 }, (_, i) => c.entries[addDays(c.start, i)]?.score || 0);
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
      h('h3', null, 'Оценка дня (1–10)'),
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

function diary(root, back, c, k) {
  const e = { a: {}, on: {}, feelings: [], count: 0, score: 0, ...(c.entries[k] || {}) };
  const day = courseDay(c, k);
  const v = tpl(c);
  const area = key => h('textarea', { class: 'input', rows: 2, value: e.a[key] || '', oninput: ev => { e.a[key] = ev.target.value; } });
  const block = sec => {
    const body = h('div', { class: 'sec-body' }, sec.qs.map(([key, text]) => h('label', { class: 'field' }, text && h('span', { class: 'q-small' }, text), area(key))));
    const kids = [h('h3', null, h('span', { class: 'sec-n' }, sec.n), sec.title)];
    if (sec.scale) {
      const sc = h('div', { class: 'scale' });
      const r = () => sc.replaceChildren(...Array.from({ length: 10 }, (_, i) => h('button', { class: 'scale-btn' + (e.score === i + 1 ? ' on' : ''), style: { '--k': (9 - i) / 9 }, onclick: () => { e.score = i + 1; r(); } }, i + 1)));
      r(); kids.push(sc);
    }
    if (sec.feel) {
      const fb = h('div', { class: 'chips' });
      const rf = () => fb.replaceChildren(...e.feelings.map(w => chip(w, { selected: true })), h('button', { class: 'btn soft small', onclick: () => openFeelings({ selected: e.feelings, onDone: ws => { e.feelings = ws; rf(); } }) }, e.feelings.length ? 'Изменить чувства' : '💗 Таблица чувств'));
      rf(); kids.push(fb);
    }
    if (sec.optional) {
      const tg = h('input', { type: 'checkbox', checked: !!e.on[sec.n], onchange: ev => { e.on[sec.n] = ev.target.checked; body.style.display = ev.target.checked ? '' : 'none'; } });
      body.style.display = e.on[sec.n] ? '' : 'none';
      kids.push(h('label', { class: 'switch-row' }, h('span', null, sec.optional, h('small', { class: 'muted' }, 'Если нет — пункт пропускается')), tg));
    }
    kids.push(body);
    return h('div', { class: 'card sec' }, kids);
  };
  root.replaceChildren(h('div', { class: 'page' },
    h('button', { class: 'link', onclick: () => courseScreen(root, back) }, '← К курсу'),
    h('h1', null, `🌙 День ${day} · ${fmtDate(k + 'T12:00')}`),
    h('p', { class: 'muted small' }, 'Каждый день записывай один новый ответ по каждому пункту. 10–15 минут перед сном.'),
    sections(c).map(block),
    h('div', { class: 'card' },
      h('h3', null, h('span', { class: 'sec-n' }, 15), v.affT + '. Пиши формулу самонастроя от 20 до 50 раз'),
      h('p', { class: 'muted small' }, 'Когда пишешь, обязательно находись в осознании того, о чём пишешь! Если есть возможность — пиши на бумаге левой рукой (если ты правша): это повышает концентрацию. После каждой записи касайся круга.'),
      counterEl(c.aff, { target: c.target || 30, start: e.count || 0, onChange: (n, t) => { e.count = n; c.target = t; } })),
    h('button', { class: 'btn primary wide', onclick: () => {
      const filled = Object.values(e.a).filter(x => x && x.trim()).length;
      if (!filled) return toast('Заполни хотя бы несколько пунктов');
      e.state = e.on[8] ? 'slip' : 'done';
      c.entries[k] = { ...e, saved: Date.now() }; put(c);
      toast('Запись сохранена 🌙');
      if (k === addDays(c.start, 13)) { c.finished = true; put(c); }
      courseScreen(root, back);
    } }, 'Сохранить запись')));
}

function summary(root, back, c) {
  const icon = tpl(c).icon, name = tpl(c).name;
  const entries = Object.values(c.entries);
  const slips = entries.filter(e => e.state === 'slip').length;
  const cr = entries.map(e => e.score).filter(Boolean);
  const first = cr.slice(0, 3), last = cr.slice(-3);
  const avg = a => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : '—');
  root.replaceChildren(h('div', { class: 'page' },
    back(),
    h('h1', null, `${icon} Курс завершён`),
    h('div', { class: 'card center' },
      h('div', { class: 'end-icon' }, '🏆'),
      h('p', null, `${c.habit === 'other' ? c.custom : name}: заполнено ${entries.length} из 14 вечеров, срывов — ${slips}.`),
      cr.length ? h('div', { class: 'compare' }, h('div', null, h('small', null, 'Оценка дня в начале'), h('b', null, avg(first))), h('span', null, '→'), h('div', null, h('small', null, 'в конце'), h('b', null, avg(last)))) : null,
      h('p', { class: 'muted' }, 'Если привычка ещё держится — пройди ещё 14 дней: новые отпечатки укрепляются повторением.')),
    h('button', { class: 'btn primary wide', onclick: () => { archive(c); courseScreen(root, back); } }, 'Начать новый курс')));
}

function icsDownload(c, title) {
  const [hh, mm] = (c.remind || '21:30').split(':');
  const d = c.start.replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vnutrenniy kompas//RU', 'BEGIN:VEVENT',
    `UID:course-${d}@kompas.local`, `DTSTAMP:${now}`, `DTSTART:${d}T${hh}${mm}00`, 'DURATION:PT15M', 'RRULE:FREQ=DAILY;COUNT=14',
    `SUMMARY:🌙 ППП: ${title}`, 'DESCRIPTION:10–15 минут перед сном: дневник и формула самонастроя 20–50 раз.',
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Вечерний дневник', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  download(new Blob([ics], { type: 'text/calendar' }), 'dnevnik-privychki.ics');
}

export function courseStatus() {
  const c = get(); if (!c) return null;
  const day = courseDay(c);
  return { day: Math.min(day, 14), todayDone: !!c.entries[dayKey()], over: day > 14 };
}

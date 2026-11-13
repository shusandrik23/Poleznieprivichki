// Подробная статистика привычки (YouBoost Plus): всего дней, процент выполнения,
// лучший день недели, по месяцам и тепловая карта за полгода.
import { dayNumber, dayKeyFromNumber } from './core.js';

export const HEAT_WEEKS = 26;

export function habitStats(h, today) {
  const doneDays = Object.keys(h.done).filter(k => h.done[k]).map(dayNumber).filter(n => n <= today);
  const doneSet = new Set(doneDays);
  const created = h.created ? dayNumber(h.created) : Infinity;
  const start = Math.min(created, doneDays.length ? Math.min(...doneDays) : today, today);
  const span = today - start + 1;
  const total = doneDays.length;

  // Сегодня ещё не отмечено — день не закончился, не считаем его пропуском
  const last = doneSet.has(today) || start === today ? today : today - 1;
  const rate = (from) => {
    const a = Math.max(from, start);
    let n = 0;
    for (let d = a; d <= last; d++) if (doneSet.has(d)) n++;
    return Math.round(n / Math.max(1, last - a + 1) * 100);
  };

  // По дням недели (0 = понедельник): выполнено / сколько таких дней было
  const wd = Array.from({ length: 7 }, () => ({ done: 0, all: 0 }));
  for (let d = start; d <= last; d++) {
    const w = (new Date(d * 86400000).getUTCDay() + 6) % 7;
    wd[w].all++;
    if (doneSet.has(d)) wd[w].done++;
  }
  const weekdays = wd.map(x => (x.all ? x.done / x.all : 0));
  let best = -1, worst = -1;
  if (span >= 14) {           // меньше двух недель — рано судить
    weekdays.forEach((v, i) => {
      if (best < 0 || v > weekdays[best]) best = i;
      if (worst < 0 || v < weekdays[worst]) worst = i;
    });
    if (weekdays[best] === weekdays[worst]) best = worst = -1;
  }

  // Последние 6 месяцев: сколько дней выполнено
  const tk = dayKeyFromNumber(today);
  let y = +tk.slice(0, 4), m = +tk.slice(5, 7);
  const months = [];
  for (let i = 0; i < 6; i++) {
    const prefix = `${y}-${String(m).padStart(2, '0')}`;
    months.unshift({ y, m, count: Object.keys(h.done).filter(k => h.done[k] && k.startsWith(prefix)).length });
    if (--m === 0) { m = 12; y--; }
  }

  // Тепловая карта: HEAT_WEEKS недель, колонки — недели (с понедельника), строки — дни недели
  const todayW = (new Date(today * 86400000).getUTCDay() + 6) % 7;
  const first = today - todayW - (HEAT_WEEKS - 1) * 7;
  const heat = [];
  for (let d = first; d < first + HEAT_WEEKS * 7; d++) {
    heat.push(d > today ? 'future' : doneSet.has(d) ? 'on' : h.frozen?.[dayKeyFromNumber(d)] ? 'frozen' : d < start ? 'before' : 'off');
  }

  return { total, span, rateAll: rate(start), rate30: rate(last - 29), rate7: rate(last - 6), weekdays, best, worst, months, heat };
}

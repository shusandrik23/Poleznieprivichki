// Общие функции: даты, серии, сравнение привычек.

export const DAY_MS = 86400000;

// Даты храним как "YYYY-MM-DD" по местному времени.
export function dateKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Номер дня (без влияния перехода на летнее время) для подсчёта серий.
export function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function dayKeyFromNumber(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function todayNumber() {
  return dayNumber(dateKey(new Date()));
}

// Максимальная серия, текущая серия и последний день текущей серии.
// Текущая серия не обрывается, если сегодня ещё не отмечено, — считается до вчера.
export function streaks(habit, todayKey = dateKey(new Date())) {
  const days = Object.keys(habit.done).filter(k => habit.done[k]).map(dayNumber).sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  for (const n of days) {
    run = (prev !== null && n === prev + 1) ? run + 1 : 1;
    best = Math.max(best, run);
    prev = n;
  }
  const set = new Set(days);
  let cursor = dayNumber(todayKey);
  if (!set.has(cursor)) cursor -= 1;
  const end = cursor;
  let current = 0;
  while (set.has(cursor)) { current++; cursor--; }
  return { best, current, end };
}

// Текущая серия друга по сохранённым данным: если серия закончилась раньше вчерашнего дня — она прервана.
export function liveStreak(stat, today = todayNumber()) {
  return stat.end >= today - 1 ? stat.cur : 0;
}

// Ключ для сравнения привычек: без эмодзи, знаков и регистра.
export function habitKey(name) {
  return name.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// Прогресс в вызове: сколько дней подряд выполнено начиная с дня старта.
export function challengeProgress(habit, startDay, days, today = todayNumber()) {
  let count = 0, d = startDay;
  while (d <= today && count < days && habit && habit.done[dayKeyFromNumber(d)]) { count++; d++; }
  const completed = count >= days;
  const failed = !completed && d < today; // пропущен день до сегодняшнего
  return { count, completed, failed };
}

export function plural(n) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return 'дней';
  if (b === 1) return 'день';
  if (b >= 2 && b <= 4) return 'дня';
  return 'дней';
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

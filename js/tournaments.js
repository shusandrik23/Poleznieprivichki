// Турниры: общие для всех пользователей серии, которые стартуют в определённый день.
import { dayNumber, habitKey } from './core.js';

// Каждый понедельник автоматически стартует турнир недели (7 дней). Привычки идут по кругу.
export const WEEKLY_HABITS = [
  '💧 Выпить 2 литра воды',
  '🚶 Пройти 8 000 шагов',
  '📖 Читать 20 минут',
  '🏃 Зарядка 10 минут',
  '📵 Час без телефона перед сном',
  '🍬 Без сладкого',
  '🧘 Медитация 10 минут',
  '🪜 Лестница вместо лифта',
  '😴 Лечь спать до 23:00',
  '💪 5 отжиманий',
];

// Особые турниры к датам. Чтобы добавить новый — допишите объект в этот список.
// id — латиницей и уникальный; start — первый день турнира.
export const SPECIAL = [
  { id: 'newyear2027', title: 'Новогодний марафон', habit: '🏃 Зарядка 10 минут', start: '2027-01-01', days: 21,
    text: 'Начните год с движения: 21 день зарядки подряд вместе со всеми.' },
  { id: 'spring2027', title: 'Весенний детокс', habit: '📱 Не больше часа соцсетей', start: '2027-03-01', days: 14,
    text: 'Две недели меньше ленты — больше времени на себя.' },
];

const SHOW_SPECIAL_BEFORE = 14; // за сколько дней показывать анонс особого турнира
const JOIN_GRACE = 1;           // присоединиться можно до конца второго дня

// Понедельник недели, в которую входит день n (день 0 — четверг 1 января 1970).
export function mondayOf(n) { return n - ((n - 4) % 7 + 7) % 7; }

function weekly(startDay) {
  const habit = WEEKLY_HABITS[Math.floor(startDay / 7) % WEEKLY_HABITS.length];
  return { id: 'w' + startDay, kind: 'weekly', title: 'Турнир недели', habit, habitKey: habitKey(habit), startDay, days: 7,
    text: 'Семь дней подряд — и вы в таблице победителей.' };
}

function special(s) {
  return { ...s, kind: 'special', habitKey: habitKey(s.habit), startDay: dayNumber(s.start) };
}

export function tournamentById(id) {
  if (/^w\d+$/.test(id)) return weekly(Number(id.slice(1)));
  const s = SPECIAL.find(x => x.id === id);
  return s ? special(s) : null;
}

// Турниры, которые стоит показать сегодня: текущий и следующий недельные плюс ближайшие особые.
export function tournamentsAround(today) {
  const mon = mondayOf(today);
  const list = [weekly(mon), weekly(mon + 7)];
  for (const s of SPECIAL.map(special)) {
    if (today <= s.startDay + s.days && s.startDay - today <= SHOW_SPECIAL_BEFORE) list.push(s);
  }
  return list.sort((a, b) => a.startDay - b.startDay);
}

export function tournamentStatus(t, today) {
  if (today < t.startDay) return 'upcoming';
  if (today < t.startDay + t.days) return 'active';
  return 'finished';
}

export function canJoin(t, today) { return today <= t.startDay + JOIN_GRACE; }

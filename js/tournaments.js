// Турниры: общие для всех пользователей серии, которые стартуют в определённый день.
import { dayNumber } from './core.js';
import { lang, t } from './i18n.js';
import { catalogName } from './catalog.js';
import { isKidMode, KID_WEEKLY, kidAllowed } from './kids.js';

// Каждый понедельник автоматически стартует турнир недели (7 дней). Привычки (коды из js/catalog.js) идут по кругу.
export const WEEKLY_HABITS = [
  'water', 'steps', 'read', 'morning_exercise', 'no_phone_bed',
  'no_sugar', 'meditate', 'stairs', 'sleep', 'pushups',
];

// Особые турниры к датам. Чтобы добавить новый — допишите объект в этот список.
// id — латиницей и уникальный; habit — код из js/catalog.js; start — первый день турнира.
export const SPECIAL = [
  { id: 'newyear2027', habit: 'morning_exercise', start: '2027-01-01', days: 21,
    title: { ru: 'Новогодний марафон', en: 'New Year marathon' },
    text: { ru: 'Начните год с движения: 21 день зарядки подряд вместе со всеми.', en: 'Start the year moving: 21 days of exercise in a row, together with everyone.' } },
  { id: 'spring2027', habit: 'less_social', start: '2027-03-01', days: 14,
    title: { ru: 'Весенний детокс', en: 'Spring detox' },
    text: { ru: 'Две недели меньше ленты — больше времени на себя.', en: 'Two weeks of less scrolling — more time for yourself.' } },
];

export const FLAG_LIMIT = 3;    // столько отметок «не похоже на правду» — и день с фото не засчитывается
const SHOW_SPECIAL_BEFORE = 14; // за сколько дней показывать анонс особого турнира
const JOIN_GRACE = 1;           // присоединиться можно до конца второго дня

// Понедельник недели, в которую входит день n (день 0 — четверг 1 января 1970).
export function mondayOf(n) { return n - ((n - 4) % 7 + 7) % 7; }

// Детские турниры — отдельные (id начинается с 'kids-'): дети соревнуются только с детьми.
function weekly(startDay, kid = false) {
  const list = kid ? KID_WEEKLY : WEEKLY_HABITS;
  const cid = list[Math.floor(startDay / 7) % list.length];
  return { id: (kid ? 'kids-w' : 'w') + startDay, kind: 'weekly', title: t('tour.weeklyTitle'), cid, habit: catalogName(cid), habitKey: 'c:' + cid,
    startDay, days: 7, text: t('tour.weeklyText') };
}

function special(s, kid = false) {
  return { id: (kid ? 'kids-' : '') + s.id, kind: 'special', title: s.title[lang], text: s.text[lang], cid: s.habit, habit: catalogName(s.habit),
    habitKey: 'c:' + s.habit, startDay: dayNumber(s.start), days: s.days };
}

export function tournamentById(id) {
  if (/^w\d+$/.test(id)) return weekly(Number(id.slice(1)));
  if (/^kids-w\d+$/.test(id)) return weekly(Number(id.slice(6)), true);
  const kid = id.startsWith('kids-');
  const s = SPECIAL.find(x => x.id === (kid ? id.slice(5) : id));
  return s && (!kid || kidAllowed(s.habit)) ? special(s, kid) : null;
}

// Турниры, которые стоит показать сегодня: текущий и следующий недельные плюс ближайшие особые.
export function tournamentsAround(today) {
  const mon = mondayOf(today);
  const kid = isKidMode();
  const list = [weekly(mon, kid), weekly(mon + 7, kid)];
  for (const s of SPECIAL.filter(x => !kid || kidAllowed(x.habit)).map(x => special(x, kid))) {
    if (today <= s.startDay + s.days && s.startDay - today <= SHOW_SPECIAL_BEFORE) list.push(s);
  }
  return list.sort((a, b) => a.startDay - b.startDay);
}

export function tournamentStatus(tr, today) {
  if (today < tr.startDay) return 'upcoming';
  if (today < tr.startDay + tr.days) return 'active';
  return 'finished';
}

export function canJoin(tr, today) { return today <= tr.startDay + JOIN_GRACE; }

// Прогресс в турнире по отметкам на сервере: дни подряд с первого дня турнира.
// checks — { 'номер дня': время }, rejected — дни, чьи фото участники сочли неправдоподобными.
export function tourProgress(checks, tr, today, rejected) {
  const ok = n => !!checks[String(n)] && !(rejected && rejected.has(String(n)));
  let count = 0, d = tr.startDay;
  while (d <= today && count < tr.days && ok(d)) { count++; d++; }
  const completed = count >= tr.days;
  const failed = !completed && d < today;
  return { count, completed, failed };
}

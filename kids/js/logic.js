// Расчёты: дни, отметки, серии, звёзды, питомец, наклейки, семейные вызовы.
// Ничего не хранится «готовым» — всё считается из отметок, поэтому данные не расходятся.

export const DAY_MS = 86400000;

export function dateKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
export function keyFromNumber(n) { return new Date(n * DAY_MS).toISOString().slice(0, 10); }
export function addDays(key, n) { return keyFromNumber(dayNumber(key) + n); }
export function weekday(key) { return new Date(dayNumber(key) * DAY_MS).getUTCDay(); }
export const today = () => dateKey();

export function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ---------- Привычки и отметки ----------

export function scheduledOn(habit, key) {
  if (habit.once) return key === habit.once;   // разовая задача (например, от мамы из YouBoost)
  if (habit.since && key < habit.since) return false;
  return !habit.days || habit.days.length === 0 || habit.days.includes(weekday(key));
}

// 'none' | 'pending' (ждёт подтверждения) | 'done' | 'rejected'
export function status(kid, habitId, key, habit) {
  const mark = kid.marks?.[key]?.[habitId];
  if (!mark) return 'none';
  const ap = kid.approved?.[key]?.[habitId];
  if (ap === false) return 'rejected';
  if (ap === true) return 'done';
  if (habit && habit.approval) return 'pending';
  return 'done';
}
// Для серий и питомца засчитываем и то, что ждёт подтверждения: ребёнок дело сделал.
export const isDone = (kid, h, key) => { const s = status(kid, h.id, key, h); return s === 'done' || s === 'pending'; };

export function todayList(kid, key = today()) {
  return (kid.habits || []).filter(h => scheduledOn(h, key));
}

// Текущая серия: подряд выполненные дни по расписанию. Сегодня, пока не отмечено, серию не обрывает.
export function streak(kid, habit, key = today()) {
  if (habit.once) return 0;
  let d = key, n = 0, guard = 0;
  if (scheduledOn(habit, d) && !isDone(kid, habit, d)) d = addDays(d, -1);
  while (guard++ < 2000) {
    if (habit.since && d < habit.since) break;
    if (scheduledOn(habit, d)) {
      if (!isDone(kid, habit, d)) break;
      n++;
    }
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(kid, habit, key = today()) {
  if (habit.once) return 0;
  const start = habit.since || firstMarkDay(kid) || key;
  let best = 0, run = 0;
  for (let n = dayNumber(start), end = dayNumber(key); n <= end; n++) {
    const d = keyFromNumber(n);
    if (!scheduledOn(habit, d)) continue;
    if (isDone(kid, habit, d)) { run++; best = Math.max(best, run); }
    else if (d !== key) run = 0;
  }
  return best;
}

function firstMarkDay(kid) {
  const days = Object.keys(kid.marks || {}).sort();
  return days[0] || null;
}

// ---------- Звёзды ----------

// Заработано за отметки: звёзды записываются в отметку в момент выполнения.
export function earnedFromMarks(kid) {
  let sum = 0;
  const byId = Object.fromEntries((kid.habits || []).map(h => [h.id, h]));
  for (const [day, marks] of Object.entries(kid.marks || {})) {
    for (const [hid, stars] of Object.entries(marks || {})) {
      if (!stars) continue;
      const ap = kid.approved?.[day]?.[hid];
      if (ap === false) continue;
      // Удалённая привычка (или прошедшая разовая задача) звёзды не отнимает.
      if (ap === true || !byId[hid] || !byId[hid].approval) sum += Number(stars) || 0;
    }
  }
  return sum;
}

export function bonusStars(kid) {
  return (kid.bonus || []).reduce((s, b) => s + (Number(b.stars) || 0), 0);
}

export function challengeStars(kid, family, key = today()) {
  let sum = 0;
  for (const ch of family?.challenges || []) {
    const pid = 'k:' + kid.id;
    if (!ch.participants?.includes(pid)) continue;
    const st = challengeState(ch, key);
    if (st !== 'finished') continue;
    if (challengeCount(ch, pid, kidChMarks(kid, ch)) >= ch.days) sum += Number(ch.bonus) || 0;
  }
  return sum;
}

export function requestStatus(kid, req) { return kid.decisions?.[req.id] || 'pending'; }

export function spentStars(kid) {
  return (kid.requests || []).reduce((s, r) => s + (requestStatus(kid, r) === 'rejected' ? 0 : Number(r.cost) || 0), 0);
}

export function lifetimeStars(kid, family) { return earnedFromMarks(kid) + bonusStars(kid) + challengeStars(kid, family); }
export function balance(kid, family) { return lifetimeStars(kid, family) - spentStars(kid); }

// Сколько звёзд ждёт подтверждения родителя.
export function pendingList(kid) {
  const out = [];
  const byId = Object.fromEntries((kid.habits || []).map(h => [h.id, h]));
  for (const [day, marks] of Object.entries(kid.marks || {})) {
    for (const [hid, stars] of Object.entries(marks || {})) {
      const h = byId[hid];
      if (!stars || !h || !h.approval) continue;
      if (kid.approved?.[day]?.[hid] === undefined) out.push({ day, habit: h, stars });
    }
  }
  return out.sort((a, b) => (a.day < b.day ? 1 : -1));
}

// ---------- Питомец ----------

export const PETS = [
  { id: 'cat', emoji: '🐱', ru: 'Котёнок', en: 'Kitten' },
  { id: 'dog', emoji: '🐶', ru: 'Щенок', en: 'Puppy' },
  { id: 'bunny', emoji: '🐰', ru: 'Зайчик', en: 'Bunny' },
  { id: 'fox', emoji: '🦊', ru: 'Лисёнок', en: 'Fox cub' },
  { id: 'panda', emoji: '🐼', ru: 'Панда', en: 'Panda' },
  { id: 'dragon', emoji: '🐲', ru: 'Дракончик', en: 'Little dragon' },
  { id: 'unicorn', emoji: '🦄', ru: 'Единорог', en: 'Unicorn' },
  { id: 'turtle', emoji: '🐢', ru: 'Черепашка', en: 'Turtle' },
  { id: 'penguin', emoji: '🐧', ru: 'Пингвинёнок', en: 'Penguin' },
  { id: 'owl', emoji: '🦉', ru: 'Совёнок', en: 'Owlet' },
];
export const petById = id => PETS.find(p => p.id === id) || PETS[0];

// Уровни питомца по всем заработанным звёздам. Уровень 0 — яйцо.
export const PET_LEVELS = [0, 5, 20, 50, 100, 180, 300, 450, 650, 1000];
export function petLevel(xp) {
  let lvl = 0;
  PET_LEVELS.forEach((need, i) => { if (xp >= need) lvl = i; });
  const next = PET_LEVELS[lvl + 1];
  const prev = PET_LEVELS[lvl];
  return { level: lvl, max: next === undefined, next, progress: next === undefined ? 1 : (xp - prev) / (next - prev), toNext: next === undefined ? 0 : next - xp };
}
// Украшения, которые питомец получает с уровнями.
export const PET_ITEMS = [null, null, '🎀', '🧣', '🎒', '🕶️', '🎩', '🌟', '🦸', '👑'];

// Настроение по сегодняшним делам.
export function petMood(kid, key = today(), hour = new Date().getHours()) {
  const list = todayList(kid, key);
  if (!list.length) return 'chill';
  const done = list.filter(h => isDone(kid, h, key)).length;
  if (done === list.length) return 'happy';
  if (done / list.length >= 0.5) return 'good';
  if (done > 0) return 'ok';
  return hour < 12 ? 'morning' : 'miss';
}

// ---------- Семейные вызовы ----------

export function challengeEnd(ch) { return addDays(ch.start, ch.days - 1); }
export function challengeState(ch, key = today()) {
  if (key < ch.start) return 'upcoming';
  if (key > challengeEnd(ch)) return 'finished';
  return 'active';
}
export function kidChMarks(kid, ch) { return kid?.chMarks?.[ch.id] || {}; }
export function challengeCount(ch, pid, marks) {
  const m = marks || ch.marks?.[pid] || {};
  let n = 0;
  for (let i = 0; i < ch.days; i++) if (m[addDays(ch.start, i)]) n++;
  return n;
}
// Таблица: [{ pid, count }] по убыванию.
export function challengeBoard(ch, kidsById) {
  return (ch.participants || []).map(pid => {
    const marks = pid.startsWith('k:') ? kidChMarks(kidsById[pid.slice(2)], ch) : (ch.marks?.[pid] || {});
    return { pid, count: challengeCount(ch, pid, marks) };
  }).sort((a, b) => b.count - a.count);
}
export function challengeWinners(ch, kidsById) {
  const board = challengeBoard(ch, kidsById);
  const top = board[0]?.count || 0;
  return top ? board.filter(r => r.count === top).map(r => r.pid) : [];
}

// ---------- Наклейки (достижения) ----------

export function kidStats(kid, family, kidsById = {}, key = today()) {
  const habits = kid.habits || [];
  let totalDone = 0, perfect = 0, maxInDay = 0;
  const days = new Set(Object.keys(kid.marks || {}));
  for (const d of days) {
    const list = habits.filter(h => scheduledOn(h, d));
    const done = list.filter(h => isDone(kid, h, d)).length;
    const all = Object.keys(kid.marks[d] || {}).filter(hid => kid.marks[d][hid] && kid.approved?.[d]?.[hid] !== false).length;
    totalDone += all;
    maxInDay = Math.max(maxInDay, all);
    if (list.length && done === list.length) perfect++;
  }
  const best = habits.reduce((m, h) => Math.max(m, bestStreak(kid, h, key)), 0);
  let chDone = 0, chWon = 0;
  for (const ch of family?.challenges || []) {
    const pid = 'k:' + kid.id;
    if (!ch.participants?.includes(pid) || challengeState(ch, key) !== 'finished') continue;
    if (challengeCount(ch, pid, kidChMarks(kid, ch)) >= ch.days) chDone++;
    if (challengeWinners(ch, { ...kidsById, [kid.id]: kid }).includes(pid)) chWon++;
  }
  const xp = lifetimeStars(kid, family);
  return {
    totalDone, perfect, maxInDay, best, xp, chDone, chWon,
    rewards: (kid.requests || []).filter(r => requestStatus(kid, r) === 'given').length,
    petLevel: petLevel(xp).level,
  };
}

export const STICKERS = [
  { id: 'first', emoji: '🌱', test: s => s.totalDone >= 1, ru: ['Первый шаг', 'Выполни первое дело'], en: ['First step', 'Complete your first task'] },
  { id: 'hatch', emoji: '🐣', test: s => s.petLevel >= 1, ru: ['Вылупился!', 'Помоги питомцу вылупиться'], en: ['Hatched!', 'Help your pet hatch'] },
  { id: 'streak3', emoji: '🔥', test: s => s.best >= 3, ru: ['Огонёк', '3 дня подряд'], en: ['Little flame', '3 days in a row'] },
  { id: 'five', emoji: '🖐️', test: s => s.maxInDay >= 5, ru: ['Пятёрка', '5 дел за один день'], en: ['High five', '5 tasks in one day'] },
  { id: 'perfect1', emoji: '🌈', test: s => s.perfect >= 1, ru: ['Радуга', 'Все дела дня выполнены'], en: ['Rainbow', 'All tasks of the day done'] },
  { id: 'stars10', emoji: '⭐', test: s => s.xp >= 10, ru: ['Звёздочка', 'Собери 10 звёзд'], en: ['Little star', 'Collect 10 stars'] },
  { id: 'streak7', emoji: '⚡', test: s => s.best >= 7, ru: ['Молния', '7 дней подряд'], en: ['Lightning', '7 days in a row'] },
  { id: 'reward1', emoji: '🎁', test: s => s.rewards >= 1, ru: ['Подарок', 'Получи первую награду'], en: ['Present', 'Get your first reward'] },
  { id: 'stars50', emoji: '🌠', test: s => s.xp >= 50, ru: ['Звездопад', 'Собери 50 звёзд'], en: ['Shooting star', 'Collect 50 stars'] },
  { id: 'chdone', emoji: '🤝', test: s => s.chDone >= 1, ru: ['Командный игрок', 'Пройди семейный вызов до конца'], en: ['Team player', 'Finish a family challenge'] },
  { id: 'chwin', emoji: '🥇', test: s => s.chWon >= 1, ru: ['Чемпион', 'Победи в семейном вызове'], en: ['Champion', 'Win a family challenge'] },
  { id: 'streak14', emoji: '🌟', test: s => s.best >= 14, ru: ['Две недели', '14 дней подряд'], en: ['Two weeks', '14 days in a row'] },
  { id: 'perfect7', emoji: '🦸', test: s => s.perfect >= 7, ru: ['Супергерой', '7 идеальных дней'], en: ['Superhero', '7 perfect days'] },
  { id: 'stars100', emoji: '🚀', test: s => s.xp >= 100, ru: ['Ракета', 'Собери 100 звёзд'], en: ['Rocket', 'Collect 100 stars'] },
  { id: 'rewards5', emoji: '🛍️', test: s => s.rewards >= 5, ru: ['Коллекционер', 'Получи 5 наград'], en: ['Collector', 'Get 5 rewards'] },
  { id: 'streak30', emoji: '🏆', test: s => s.best >= 30, ru: ['Кубок', '30 дней подряд'], en: ['Trophy', '30 days in a row'] },
  { id: 'done100', emoji: '💯', test: s => s.totalDone >= 100, ru: ['Сотня', '100 выполненных дел'], en: ['Hundred', '100 tasks done'] },
  { id: 'perfect30', emoji: '👑', test: s => s.perfect >= 30, ru: ['Король дня', '30 идеальных дней'], en: ['Ruler of the day', '30 perfect days'] },
  { id: 'stars500', emoji: '🪐', test: s => s.xp >= 500, ru: ['Космос', 'Собери 500 звёзд'], en: ['Outer space', 'Collect 500 stars'] },
  { id: 'streak100', emoji: '💎', test: s => s.best >= 100, ru: ['Алмаз', '100 дней подряд'], en: ['Diamond', '100 days in a row'] },
  { id: 'petmax', emoji: '🐉', test: s => s.petLevel >= PET_LEVELS.length - 1, ru: ['Легенда', 'Вырасти питомца до последнего уровня'], en: ['Legend', 'Grow your pet to the top level'] },
];

export function earnedStickers(kid, family, kidsById) {
  const s = kidStats(kid, family, kidsById);
  return STICKERS.filter(st => st.test(s)).map(st => st.id);
}

// Короткий код из понятных символов (без 0/O, 1/I/L).
export function makeCode(len = 6) {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return [...buf].map(n => abc[n % abc.length]).join('');
}

// ---------- Связь с YouBoost: задачи от взрослых и вызовы от ребёнка ----------

// Как ребёнок зовёт взрослого: «Мама», «Папа» или имя из аккаунта.
export function parentName(family, uid, fallback = '') {
  if (uid === 'local') return fallback;
  const n = family?.parents?.[uid];
  return n || fallback;
}

// Разовые задачи старше двух недель убираем из списка (заработанные звёзды остаются).
export function dropOldTasks(habits, key = today()) {
  const limit = addDays(key, -14);
  return (habits || []).filter(h => !h.once || h.once >= limit);
}

// Вызов, который ребёнок бросил взрослому: kid.proposals (пишет ребёнок), kid.proposalAnswers (отвечает взрослый).
export function proposalStatus(kid, p) { return kid.proposalAnswers?.[p.id] || 'pending'; }
export function pendingProposals(kid, toPid = null) {
  return (kid.proposals || []).filter(p => proposalStatus(kid, p) === 'pending' && (!toPid || p.to === toPid));
}
export function challengeFromProposal(kid, p, key = today()) {
  return {
    id: newId(), name: p.name, emoji: p.emoji || '🏆', days: p.days || 7, bonus: 10,
    start: addDays(key, 1), participants: ['k:' + kid.id, p.to], marks: {}, fromKid: kid.id,
    createdAt: new Date().toISOString(),
  };
}

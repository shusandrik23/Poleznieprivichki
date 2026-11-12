// Каталог привычек. У каждой — код: по нему привычка совпадает у людей с разными языками
// (английское «Read for 20 minutes» и русское «Читать 20 минут» — одна и та же привычка).
import { lang } from './i18n.js';
import { habitKey } from './core.js';

export const HABITS = {
  water:            { e: '💧', ru: 'Выпить 2 литра воды', en: 'Drink 2 liters of water' },
  morning_exercise: { e: '🏃', ru: 'Зарядка 10 минут', en: '10-minute workout' },
  steps:            { e: '🚶', ru: 'Пройти 8 000 шагов', en: 'Walk 8,000 steps' },
  sleep:            { e: '😴', ru: 'Лечь спать до 23:00', en: 'In bed by 11 pm' },
  veggies:          { e: '🥗', ru: 'Съесть овощи или фрукты', en: 'Eat fruit or vegetables' },
  stretch:          { e: '🧘', ru: 'Растяжка', en: 'Stretching' },
  cold_shower:      { e: '🚿', ru: 'Контрастный душ', en: 'Contrast shower' },
  pushups:          { e: '💪', ru: '5 отжиманий', en: '5 push-ups' },
  squats:           { e: '🏋️', ru: '20 приседаний', en: '20 squats' },
  plank:            { e: '⏱️', ru: 'Планка 1 минута', en: '1-minute plank' },
  stairs:           { e: '🪜', ru: 'Лестница вместо лифта', en: 'Stairs instead of the elevator' },
  read:             { e: '📖', ru: 'Читать 20 минут', en: 'Read for 20 minutes' },
  language:         { e: '🗣️', ru: 'Учить иностранный язык 15 минут', en: 'Study a language for 15 minutes' },
  podcast:          { e: '🎧', ru: 'Послушать подкаст или лекцию', en: 'Listen to a podcast or lecture' },
  journal:          { e: '✍️', ru: 'Вести дневник', en: 'Write in a journal' },
  puzzle:           { e: '🧠', ru: 'Решить задачу или головоломку', en: 'Solve a puzzle' },
  meditate:         { e: '🧘', ru: 'Медитация 10 минут', en: 'Meditate for 10 minutes' },
  gratitude:        { e: '🙏', ru: 'Записать 3 вещи, за которые благодарен', en: 'Write down 3 things you are grateful for' },
  walk_outside:     { e: '🌳', ru: 'Прогулка на свежем воздухе', en: 'Walk outdoors' },
  no_phone_bed:     { e: '📵', ru: 'Час без телефона перед сном', en: 'No phone for an hour before bed' },
  plan_day:         { e: '📝', ru: 'Составить план на день', en: 'Plan your day' },
  tidy_desk:        { e: '🧹', ru: 'Убрать рабочее место', en: 'Tidy your desk' },
  no_snooze:        { e: '⏰', ru: 'Встать без «ещё 5 минут»', en: 'Get up without snoozing' },
  track_spending:   { e: '💰', ru: 'Записать расходы', en: 'Track your spending' },
  save_money:       { e: '💰', ru: 'Откладывать деньги', en: 'Save some money', aliases: ['Откладывать 100 ₽'] },
  no_smoking:       { e: '🚭', ru: 'Не курить', en: 'No smoking' },
  no_sugar:         { e: '🍬', ru: 'Без сладкого', en: 'No sweets' },
  no_alcohol:       { e: '🍺', ru: 'Без алкоголя', en: 'No alcohol' },
  less_social:      { e: '📱', ru: 'Не больше часа соцсетей', en: 'Max 1 hour of social media' },
  call_family:      { e: '📞', ru: 'Позвонить родным', en: 'Call your family' },
  compliment:       { e: '💬', ru: 'Сделать комплимент', en: 'Give a compliment' },
  help_someone:     { e: '🤝', ru: 'Помочь кому-нибудь', en: 'Help someone' },
};

export const CATEGORIES = [
  { ru: 'Здоровье', en: 'Health', items: ['water', 'morning_exercise', 'steps', 'sleep', 'veggies', 'stretch', 'cold_shower'] },
  { ru: 'Спорт', en: 'Fitness', items: ['pushups', 'squats', 'plank', 'stairs'] },
  { ru: 'Ум и развитие', en: 'Mind & growth', items: ['read', 'language', 'podcast', 'journal', 'puzzle'] },
  { ru: 'Спокойствие', en: 'Calm', items: ['meditate', 'gratitude', 'walk_outside', 'no_phone_bed'] },
  { ru: 'Продуктивность', en: 'Productivity', items: ['plan_day', 'tidy_desk', 'no_snooze', 'track_spending', 'save_money'] },
  { ru: 'Отказ от вредного', en: 'Quit bad habits', items: ['no_smoking', 'no_sugar', 'no_alcohol', 'less_social'] },
  { ru: 'Близкие', en: 'People you love', items: ['call_family', 'compliment', 'help_someone'] },
];

// Название каталожной привычки на текущем языке, с эмодзи.
export function catalogName(id) {
  const h = HABITS[id];
  return h ? `${h.e} ${h[lang]}` : id;
}

// Поиск кода по названию на любом языке (в том числе по старым названиям).
const idByNorm = {};
for (const [id, h] of Object.entries(HABITS)) {
  for (const n of [h.ru, h.en, ...(h.aliases || [])]) idByNorm[habitKey(n)] = id;
}
export function catalogIdFor(name) { return idByNorm[habitKey(name)] || null; }

// Ключ привычки для сравнения: 'c:код' для каталожных, нормализованное название — для своих.
export function normKey(key) {
  if (!key || key.startsWith('c:')) return key;
  const id = idByNorm[key];
  return id ? 'c:' + id : key;
}
export function keyOfName(name) { return normKey(habitKey(name)); }
export function keyOf(h) { return keyOfName(h.name); }

// Название для показа: каталожные — на языке пользователя, свои — как вписали.
export function displayName(name) {
  const id = catalogIdFor(name);
  return id ? catalogName(id) : name;
}
export function nameOfKey(key, fallback) {
  const k = normKey(key);
  if (k && k.startsWith('c:') && HABITS[k.slice(2)]) return catalogName(k.slice(2));
  return fallback || key;
}

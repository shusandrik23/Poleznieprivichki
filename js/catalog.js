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
  wake_early:       { e: '🌅', ru: 'Встать до 8:00', en: 'Wake up before 8 am', by: '08:00' },
  track_spending:   { e: '💰', ru: 'Записать расходы', en: 'Track your spending' },
  save_money:       { e: '💰', ru: 'Откладывать деньги', en: 'Save some money', aliases: ['Откладывать 100 ₽'] },
  no_smoking:       { e: '🚭', ru: 'Не курить', en: 'No smoking' },
  no_sugar:         { e: '🍬', ru: 'Без сладкого', en: 'No sweets' },
  no_alcohol:       { e: '🍺', ru: 'Без алкоголя', en: 'No alcohol' },
  less_social:      { e: '📱', ru: 'Не больше часа соцсетей', en: 'Max 1 hour of social media' },
  call_family:      { e: '📞', ru: 'Позвонить родным', en: 'Call your family' },
  compliment:       { e: '💬', ru: 'Сделать комплимент', en: 'Give a compliment' },
  help_someone:     { e: '🤝', ru: 'Помочь кому-нибудь', en: 'Help someone' },
  compliment_close: { e: '💞', ru: 'Сделать комплимент близкому', en: 'Compliment someone close to you' },
  no_yelling:       { e: '🤫', ru: 'Не кричать на ребёнка', en: 'Don’t yell at my child' },
  dishes:           { e: '🍽️', ru: 'Сразу мыть грязную посуду', en: 'Wash the dishes right away' },
  make_bed:         { e: '🛏️', ru: 'Заправить кровать', en: 'Make your bed' },
  punctual:         { e: '🕘', ru: 'Не опаздывать', en: 'Be on time' },
  beauty_photo:     { e: '📷', ru: 'Сфотографировать что-то красивое на улице', en: 'Photograph something beautiful outside' },
  no_judging:       { e: '🕊️', ru: 'Не оценивать других', en: 'Don’t judge others' },
  breathing:        { e: '🌬️', ru: 'Дыхательная практика 5 минут', en: '5-minute breathing exercise' },
  mood_check:       { e: '😊', ru: 'Отметить своё настроение', en: 'Check in with your mood' },
  no_news_morning:  { e: '📰', ru: 'Утро без новостей', en: 'No news in the morning' },
  self_kindness:    { e: '💛', ru: 'Сказать себе доброе слово', en: 'Say something kind to yourself' },
  daylight:         { e: '☀️', ru: '10 минут дневного света', en: '10 minutes of daylight' },
  learn_new:        { e: '💡', ru: 'Узнать что-то новое', en: 'Learn something new' },
  online_course:    { e: '🎓', ru: 'Урок онлайн-курса', en: 'Take an online course lesson' },
  write_ideas:      { e: '🗒️', ru: 'Записать 3 идеи', en: 'Write down 3 ideas' },
  reflect:          { e: '🔁', ru: 'Подвести итоги дня', en: 'Reflect on your day' },
  deep_work:        { e: '🎯', ru: 'Час без отвлечений на важное дело', en: 'One focused hour on what matters' },
  // Детские (показываются в детском профиле, раздел «Для детей»)
  brush_teeth:      { e: '🪥', ru: 'Почистить зубы утром и вечером', en: 'Brush teeth morning and evening' },
  homework:         { e: '📚', ru: 'Сделать уроки', en: 'Do homework' },
  pack_bag:         { e: '🎒', ru: 'Собрать портфель с вечера', en: 'Pack my school bag the night before' },
  tidy_toys:        { e: '🧸', ru: 'Убрать игрушки', en: 'Put away my toys' },
  help_home:        { e: '🏠', ru: 'Помочь по дому', en: 'Help at home' },
  play_outside:     { e: '⚽', ru: 'Поиграть на улице', en: 'Play outside' },
  screen_limit:     { e: '🎮', ru: 'Не больше часа игр и мультиков', en: 'Max 1 hour of games and cartoons' },
  practice:         { e: '🎹', ru: 'Позаниматься музыкой или спортом', en: 'Practice music or a sport' },
  draw:             { e: '🎨', ru: 'Порисовать', en: 'Draw something' },
  bed_on_time:      { e: '🌙', ru: 'Лечь спать вовремя', en: 'Go to bed on time' },
};

export const CATEGORIES = [
  { ru: 'Здоровье', en: 'Health', items: ['water', 'morning_exercise', 'steps', 'sleep', 'veggies', 'stretch', 'cold_shower'] },
  { ru: 'Спорт', en: 'Fitness', items: ['pushups', 'squats', 'plank', 'stairs'] },
  { ru: 'Ментальное здоровье', en: 'Mental health', items: ['meditate', 'breathing', 'gratitude', 'mood_check', 'self_kindness', 'no_judging', 'walk_outside', 'daylight', 'beauty_photo', 'no_news_morning', 'no_phone_bed'] },
  { ru: 'Саморазвитие', en: 'Self-development', items: ['read', 'learn_new', 'language', 'online_course', 'podcast', 'journal', 'write_ideas', 'reflect', 'puzzle'] },
  { ru: 'Продуктивность', en: 'Productivity', items: ['plan_day', 'deep_work', 'punctual', 'wake_early', 'no_snooze', 'track_spending', 'save_money'] },
  { ru: 'Дом', en: 'Home', items: ['dishes', 'make_bed', 'tidy_desk'] },
  { ru: 'Отказ от вредного', en: 'Quit bad habits', items: ['no_smoking', 'no_sugar', 'no_alcohol', 'less_social'] },
  { ru: 'Близкие', en: 'People you love', items: ['call_family', 'compliment_close', 'no_yelling', 'compliment', 'help_someone'] },
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

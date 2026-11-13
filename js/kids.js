// Детский профиль (младше 13): ребёнка добавляет родитель — ссылкой или кодом.
// У ребёнка нет Google-аккаунта и почты, имя — вымышленное из готовых слов. Друзья и соперники —
// только другие дети и своя семья; переписки нет, фото нет, свои привычки — только от родителя.
import { lang } from './i18n.js';
import { CATEGORIES } from './catalog.js';

let kidMode = false;
export function setKidMode(on) { kidMode = !!on; }
export function isKidMode() { return kidMode; }

export const MAX_KIDS = 5;

// Вымышленные имена: прилагательное (по роду животного) + животное + число.
const ADJ = {
  ru: [['Смелый', 'Смелая'], ['Быстрый', 'Быстрая'], ['Весёлый', 'Весёлая'], ['Мудрый', 'Мудрая'], ['Ловкий', 'Ловкая'],
    ['Яркий', 'Яркая'], ['Добрый', 'Добрая'], ['Звёздный', 'Звёздная'], ['Солнечный', 'Солнечная'], ['Сильный', 'Сильная'],
    ['Хитрый', 'Хитрая'], ['Радужный', 'Радужная']],
  en: ['Brave', 'Swift', 'Happy', 'Wise', 'Clever', 'Bright', 'Kind', 'Starry', 'Sunny', 'Strong', 'Sly', 'Rainbow'],
};
const ANIMALS = {
  ru: [['Ёжик', 0], ['Енот', 0], ['Тигр', 0], ['Пингвин', 0], ['Дельфин', 0], ['Барсук', 0], ['Кит', 0], ['Дракон', 0],
    ['Сова', 1], ['Лиса', 1], ['Панда', 1], ['Белка', 1], ['Выдра', 1], ['Черепаха', 1], ['Рысь', 1], ['Чайка', 1]],
  en: ['Hedgehog', 'Raccoon', 'Tiger', 'Penguin', 'Dolphin', 'Badger', 'Whale', 'Dragon', 'Owl', 'Fox', 'Panda', 'Squirrel',
    'Otter', 'Turtle', 'Lynx', 'Seagull'],
};
const pick = list => list[Math.floor(Math.random() * list.length)];

export function randomKidName() {
  const num = 1 + Math.floor(Math.random() * 99);
  if (lang === 'ru') {
    const [animal, g] = pick(ANIMALS.ru);
    return `${pick(ADJ.ru)[g]} ${animal} ${num}`;
  }
  return `${pick(ADJ.en)} ${pick(ANIMALS.en)} ${num}`;
}

// Код для ребёнка: 8 букв и цифр без похожих (0/O, 1/I/L).
export function kidCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(8);
  crypto.getRandomValues(a);
  return [...a].map(n => abc[n % abc.length]).join('');
}
export const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Привычки из каталога, подходящие детям (без алкоголя, курения, денег, соцсетей и т. п.)
const KID_SAFE = new Set([
  'water', 'morning_exercise', 'steps', 'veggies', 'stretch', 'pushups', 'squats', 'plank', 'stairs',
  'read', 'language', 'puzzle', 'learn_new', 'write_ideas', 'journal',
  'meditate', 'breathing', 'gratitude', 'mood_check', 'self_kindness', 'walk_outside', 'daylight', 'beauty_photo', 'no_phone_bed',
  'plan_day', 'punctual', 'wake_early', 'no_snooze', 'save_money', 'no_sugar',
  'dishes', 'make_bed', 'tidy_desk', 'call_family', 'compliment_close', 'compliment', 'help_someone', 'no_judging',
]);
export const KID_ONLY = ['brush_teeth', 'homework', 'pack_bag', 'tidy_toys', 'help_home', 'play_outside', 'screen_limit', 'practice', 'draw', 'bed_on_time'];
const KID_ALLOWED = new Set([...KID_SAFE, ...KID_ONLY]);
export const kidAllowed = id => KID_ALLOWED.has(id);

// Каталог для показа: у детей — раздел «Для детей» и безопасные привычки; у взрослых — без детского раздела.
export function catalogCategories() {
  if (!kidMode) return CATEGORIES;
  const cats = [{ ru: 'Для детей', en: 'For kids', items: KID_ONLY }];
  for (const c of CATEGORIES) {
    const items = c.items.filter(id => KID_SAFE.has(id));
    if (items.length) cats.push({ ...c, items });
  }
  return cats;
}

// Турнир недели для детей: свои привычки по кругу.
export const KID_WEEKLY = ['brush_teeth', 'read', 'play_outside', 'make_bed', 'water', 'tidy_toys', 'homework', 'morning_exercise', 'help_home', 'draw'];

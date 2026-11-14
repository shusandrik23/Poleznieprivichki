// Готовые детские привычки и награды. Названия на двух языках; stars — сколько звёзд даёт по умолчанию.
// days — дни недели (0 — воскресенье … 6 — суббота); без days — каждый день.

const SCHOOL = [1, 2, 3, 4, 5];

export const CATEGORIES = [
  { id: 'morning', emoji: '🌅', name: { ru: 'Утро', en: 'Morning' } },
  { id: 'school', emoji: '🎒', name: { ru: 'Учёба', en: 'School' } },
  { id: 'home', emoji: '🏠', name: { ru: 'Дом и помощь', en: 'Home & helping' } },
  { id: 'health', emoji: '💪', name: { ru: 'Здоровье', en: 'Health' } },
  { id: 'kind', emoji: '💛', name: { ru: 'Добрые дела', en: 'Kindness' } },
  { id: 'hobby', emoji: '🎨', name: { ru: 'Творчество', en: 'Creativity' } },
  { id: 'evening', emoji: '🌙', name: { ru: 'Вечер', en: 'Evening' } },
];

export const HABITS = [
  { code: 'teeth_am', cat: 'morning', emoji: '🪥', stars: 1, ru: 'Почистить зубы утром', en: 'Brush teeth in the morning' },
  { code: 'bed', cat: 'morning', emoji: '🛏️', stars: 1, ru: 'Заправить кровать', en: 'Make the bed' },
  { code: 'wash', cat: 'morning', emoji: '🧼', stars: 1, ru: 'Умыться', en: 'Wash your face' },
  { code: 'exercise', cat: 'morning', emoji: '🤸', stars: 2, ru: 'Сделать зарядку', en: 'Morning exercise' },
  { code: 'dress', cat: 'morning', emoji: '👕', stars: 1, ru: 'Одеться самому', en: 'Get dressed by myself' },
  { code: 'breakfast', cat: 'morning', emoji: '🥣', stars: 1, ru: 'Позавтракать', en: 'Eat breakfast' },

  { code: 'homework', cat: 'school', emoji: '📚', stars: 3, days: SCHOOL, approval: true, ru: 'Сделать уроки', en: 'Do homework' },
  { code: 'backpack', cat: 'school', emoji: '🎒', stars: 1, days: [0, 1, 2, 3, 4], ru: 'Собрать портфель', en: 'Pack the school bag' },
  { code: 'read', cat: 'school', emoji: '📖', stars: 2, ru: 'Читать 20 минут', en: 'Read for 20 minutes' },
  { code: 'english', cat: 'school', emoji: '🔤', stars: 2, ru: 'Английский 10 минут', en: 'Learn a language for 10 minutes' },
  { code: 'math', cat: 'school', emoji: '🔢', stars: 2, ru: 'Решить 5 примеров', en: 'Solve 5 math problems' },
  { code: 'instrument', cat: 'school', emoji: '🎹', stars: 2, ru: 'Позаниматься музыкой', en: 'Practice an instrument' },

  { code: 'toys', cat: 'home', emoji: '🧸', stars: 1, ru: 'Убрать игрушки', en: 'Tidy up toys' },
  { code: 'room', cat: 'home', emoji: '🧹', stars: 2, approval: true, ru: 'Убрать в комнате', en: 'Clean my room' },
  { code: 'dishes', cat: 'home', emoji: '🍽️', stars: 2, ru: 'Помочь с посудой', en: 'Help with the dishes' },
  { code: 'table', cat: 'home', emoji: '🥄', stars: 1, ru: 'Накрыть на стол', en: 'Set the table' },
  { code: 'pet', cat: 'home', emoji: '🐕', stars: 2, ru: 'Покормить питомца', en: 'Feed the pet' },
  { code: 'plants', cat: 'home', emoji: '🪴', stars: 1, days: [3, 6], ru: 'Полить цветы', en: 'Water the plants' },
  { code: 'trash', cat: 'home', emoji: '🗑️', stars: 1, ru: 'Вынести мусор', en: 'Take out the trash' },
  { code: 'clothes', cat: 'home', emoji: '🧺', stars: 1, ru: 'Убрать одежду на место', en: 'Put clothes away' },

  { code: 'water', cat: 'health', emoji: '💧', stars: 1, ru: 'Выпить 5 стаканов воды', en: 'Drink 5 glasses of water' },
  { code: 'veggies', cat: 'health', emoji: '🥕', stars: 1, ru: 'Съесть овощи или фрукты', en: 'Eat fruit or veggies' },
  { code: 'outside', cat: 'health', emoji: '🌳', stars: 2, ru: 'Погулять на улице', en: 'Play outside' },
  { code: 'sport', cat: 'health', emoji: '⚽', stars: 2, ru: 'Спорт или активная игра', en: 'Sport or active play' },
  { code: 'screen', cat: 'health', emoji: '📵', stars: 2, approval: true, ru: 'Гаджеты не больше часа', en: 'Screens no more than 1 hour' },
  { code: 'hands', cat: 'health', emoji: '🫧', stars: 1, ru: 'Мыть руки перед едой', en: 'Wash hands before meals' },

  { code: 'thanks', cat: 'kind', emoji: '🙏', stars: 1, ru: 'Сказать «спасибо»', en: 'Say "thank you"' },
  { code: 'hug', cat: 'kind', emoji: '🤗', stars: 1, ru: 'Обнять родных', en: 'Hug my family' },
  { code: 'help', cat: 'kind', emoji: '🤝', stars: 2, ru: 'Помочь кому-нибудь', en: 'Help someone' },
  { code: 'sibling', cat: 'kind', emoji: '👫', stars: 2, ru: 'Поиграть с братом или сестрой', en: 'Play with my brother or sister' },
  { code: 'compliment', cat: 'kind', emoji: '💬', stars: 1, ru: 'Сказать кому-то приятное', en: 'Give someone a compliment' },

  { code: 'draw', cat: 'hobby', emoji: '🎨', stars: 1, ru: 'Порисовать', en: 'Draw something' },
  { code: 'build', cat: 'hobby', emoji: '🧱', stars: 1, ru: 'Построить что-нибудь', en: 'Build something' },
  { code: 'dance', cat: 'hobby', emoji: '💃', stars: 1, ru: 'Потанцевать', en: 'Dance' },
  { code: 'diary', cat: 'hobby', emoji: '📝', stars: 2, ru: 'Записать, что было за день', en: 'Write about my day' },

  { code: 'teeth_pm', cat: 'evening', emoji: '🪥', stars: 1, ru: 'Почистить зубы вечером', en: 'Brush teeth in the evening' },
  { code: 'shower', cat: 'evening', emoji: '🛁', stars: 1, ru: 'Помыться', en: 'Take a bath or shower' },
  { code: 'sleep', cat: 'evening', emoji: '😴', stars: 2, ru: 'Лечь спать вовремя', en: 'Go to bed on time' },
  { code: 'pajamas', cat: 'evening', emoji: '🩳', stars: 1, ru: 'Приготовить одежду на завтра', en: 'Lay out clothes for tomorrow' },
];

// Наборы для быстрого старта по возрасту.
export const STARTER = {
  young: ['teeth_am', 'bed', 'toys', 'veggies', 'read', 'teeth_pm'],
  middle: ['teeth_am', 'bed', 'homework', 'backpack', 'read', 'outside', 'teeth_pm'],
  teen: ['bed', 'homework', 'read', 'sport', 'screen', 'dishes', 'sleep'],
};
export function starterFor(age) {
  if (!age || age <= 8) return STARTER.young;
  if (age <= 11) return STARTER.middle;
  return STARTER.teen;
}

export const REWARDS = [
  { emoji: '🍦', cost: 10, ru: 'Мороженое', en: 'Ice cream' },
  { emoji: '🎲', cost: 8, ru: 'Настолка с родителями', en: 'Board game with parents' },
  { emoji: '🎮', cost: 15, ru: '+30 минут игр', en: '+30 minutes of games' },
  { emoji: '🌙', cost: 12, ru: 'Лечь на 30 минут позже', en: 'Stay up 30 minutes later' },
  { emoji: '🍕', cost: 20, ru: 'Выбрать ужин', en: 'Choose dinner' },
  { emoji: '🎬', cost: 30, ru: 'Поход в кино', en: 'Trip to the cinema' },
  { emoji: '🧸', cost: 40, ru: 'Маленькая игрушка', en: 'A small toy' },
  { emoji: '🎢', cost: 60, ru: 'Парк аттракционов', en: 'Amusement park' },
];

// Эмодзи, из которых можно выбрать свою привычку, награду или аватар.
export const HABIT_EMOJI = ['⭐', '🪥', '🛏️', '📚', '📖', '🎒', '🧸', '🧹', '🍽️', '🐕', '🪴', '💧', '🥕', '🍎', '🌳', '⚽', '🚴', '🏊', '🤸', '🎹', '🎨', '🧱', '📝', '🙏', '🤗', '🤝', '😴', '🛁', '📵', '🧠', '🔢', '🔤', '🧺', '🗑️', '🎻', '♟️'];
export const REWARD_EMOJI = ['🎁', '🍦', '🍫', '🍕', '🎬', '🎮', '🎲', '🧸', '🎢', '🌙', '📚', '🏊', '🛝', '🎨', '🚲', '⚽', '🍰', '💸'];
export const AVATARS = ['🦁', '🐯', '🐻', '🐼', '🐨', '🐰', '🦊', '🐸', '🐵', '🦄', '🐙', '🦖', '🐧', '🐝', '🦋', '🐬', '🚀', '⚽', '🌸', '🌟'];
export const COLORS = ['#ff8a3d', '#7c5cff', '#2fbf71', '#ff5d8f', '#22a7f0', '#f5b400', '#14b8a6', '#e0533d'];

export function habitByCode(code) { return HABITS.find(h => h.code === code); }

// Случайный ник для самостоятельного старта: «Весёлый Енот 42». Настоящее имя не нужно.
const NICK = {
  ru: {
    adj: ['Весёлый', 'Смелый', 'Быстрый', 'Добрый', 'Звёздный', 'Солнечный', 'Ловкий', 'Яркий', 'Чудесный', 'Хитрый', 'Космический', 'Радужный'],
    noun: ['Енот', 'Лис', 'Дракон', 'Пингвин', 'Ёжик', 'Тигрёнок', 'Медвежонок', 'Единорог', 'Дельфин', 'Котёнок', 'Совёнок', 'Зайчик'],
  },
  en: {
    adj: ['Happy', 'Brave', 'Speedy', 'Kind', 'Starry', 'Sunny', 'Clever', 'Bright', 'Super', 'Cosmic', 'Rainbow', 'Lucky'],
    noun: ['Raccoon', 'Fox', 'Dragon', 'Penguin', 'Hedgehog', 'Tiger', 'Bear', 'Unicorn', 'Dolphin', 'Kitten', 'Owl', 'Bunny'],
  },
};
export function randomNick(lang) {
  const d = NICK[lang] || NICK.en;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  return `${pick(d.adj)} ${pick(d.noun)} ${10 + Math.floor(Math.random() * 90)}`;
}

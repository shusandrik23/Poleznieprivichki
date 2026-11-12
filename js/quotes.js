// Цитата дня: показывается при первом запуске приложения за день.
// Чтобы добавить цитату — допишите объект в список (на обоих языках).
import { lang } from './i18n.js';

export const QUOTES = [
  { ru: 'Мы — это то, что мы делаем регулярно. Таким образом, совершенство — это не разовое действие, а привычка.',
    en: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    author: { ru: 'Аристотель', en: 'Aristotle' } },
  { ru: 'Сначала мы формируем привычки, а затем привычки формируют нас.',
    en: 'We first make our habits, and then our habits make us.',
    author: { ru: 'Джон Драйден', en: 'John Dryden' } },
  { ru: 'Мотивация — это то, что помогает вам начать. Привычка — это то, что помогает вам продолжать.',
    en: 'Motivation is what gets you started. Habit is what keeps you going.',
    author: { ru: 'Джим Рюн', en: 'Jim Ryun' } },
  { ru: 'Успех — это сумма небольших усилий, повторяющихся изо дня в день.',
    en: 'Success is the sum of small efforts, repeated day in and day out.',
    author: { ru: 'Роберт Кольер', en: 'Robert Collier' } },
];

export function quoteFor(dayNum) {
  const q = QUOTES[((dayNum % QUOTES.length) + QUOTES.length) % QUOTES.length];
  return { text: q[lang], author: q.author[lang] };
}

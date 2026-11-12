// Языки интерфейса: русский и английский.
import ru from './locales/ru.js';
import en from './locales/en.js';

const DICTS = { ru, en };
const LANG_KEY = 'youboost-lang';
export const LANGS = [['ru', 'Русский'], ['en', 'English']];

function detect() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch (err) {}
  return (navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export let lang = detect();
document.documentElement.lang = lang;

export function setLang(l) {
  if (!DICTS[l]) return;
  lang = l;
  document.documentElement.lang = l;
  try { localStorage.setItem(LANG_KEY, l); } catch (err) {}
}

export function locale() { return lang === 'ru' ? 'ru-RU' : 'en-US'; }

// t('key', { n: 5 }) — строка из словаря с подстановкой {n}.
export function t(key, vars = {}) {
  let s = DICTS[lang][key] ?? DICTS.en[key];
  if (s === undefined) { console.warn('i18n: missing', key); return key; }
  if (typeof s === 'function') return s(vars);
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

// Форма слова для числа: pw(5, 'day') → «дней» / «days».
export function pw(n, word) {
  const forms = DICTS[lang].plurals[word] || DICTS.en.plurals[word];
  if (lang === 'ru') {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b === 1) return forms[0];
    if (b >= 2 && b <= 4) return forms[1];
    return forms[2];
  }
  return Math.abs(n) === 1 ? forms[0] : forms[1];
}

// Число с разделителями разрядов по правилам языка: 1 825 / 1,825.
export function num(n) { return n.toLocaleString(locale()); }

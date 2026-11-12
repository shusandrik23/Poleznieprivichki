// Личные настройки на этом устройстве: цветовая гамма, напоминания, уведомления о вызовах.
const PREFS_KEY = 'youboost-prefs';

// Пастельные гаммы. accent — цвет кнопок, grad — фон экрана цитаты и картинки серии.
export const THEMES = {
  green:  { accent: '#2f9e6a', grad: ['#1f8f5f', '#0f5c3c'], swatch: '#bfe5d1' },
  pink:   { accent: '#c2557f', grad: ['#d98aa8', '#a8456c'], swatch: '#f6cddd' },
  beige:  { accent: '#a07444', grad: ['#c9a27a', '#8a6238'], swatch: '#ead8c0' },
  purple: { accent: '#7b5cc0', grad: ['#a08ad6', '#5e44a0'], swatch: '#d9cff2' },
};

const DEFAULTS = { theme: 'green', reminder: { on: false, time: '20:00' }, notifyChallenges: true };

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch (err) { return { ...DEFAULTS }; }
}

export const prefs = load();

export function savePrefs(patch) {
  Object.assign(prefs, patch);
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (err) {}
}

export function theme() { return THEMES[prefs.theme] || THEMES.green; }

export function applyTheme() {
  const name = THEMES[prefs.theme] ? prefs.theme : 'green';
  document.documentElement.dataset.palette = name;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', THEMES[name].accent);
}

applyTheme();

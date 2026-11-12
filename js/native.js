// Мост к Android-приложению (Capacitor). В браузере всё это просто не используется.

// Мост Capacitor внедряется в страницу до запуска наших скриптов (androidBridge — его канал связи с Android).
export const isNative = !!(window.androidBridge || window.Capacitor?.isNativePlatform?.());

// Публичный адрес приложения — для ссылок-приглашений из Android-версии.
export const PUBLIC_URL = 'https://shusandrik23.github.io/Poleznieprivichki/';

export function appUrl() {
  return isNative ? PUBLIC_URL : location.origin + location.pathname;
}

let corePromise = null;
// Ядро Capacitor (vendor/capacitor.js) кладётся в сборку скриптом scripts/build-web.mjs.
function loadCore() {
  if (!corePromise) {
    corePromise = new Promise((resolve, reject) => {
      if (window.Capacitor?.registerPlugin) return resolve();
      const s = document.createElement('script');
      s.src = 'vendor/capacitor.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Capacitor core not found'));
      document.head.appendChild(s);
    });
  }
  return corePromise;
}

const plugins = {};
async function plugin(name) {
  await loadCore();
  return (plugins[name] ||= window.Capacitor.registerPlugin(name));
}

// Есть ли нативный вход через Google (плагин ставится вместе с настройками Firebase).
export function hasNativeGoogle() {
  return isNative && !!window.Capacitor?.PluginHeaders?.some?.(p => p.name === 'FirebaseAuthentication');
}

export async function nativeGoogleIdToken() {
  const fa = await plugin('FirebaseAuthentication');
  // Классическое окно выбора аккаунта Google (Google Play services): на части телефонов
  // новый Credential Manager не показывает окно и не отвечает.
  const res = await fa.signInWithGoogle({ useCredentialManager: false });
  return res.credential?.idToken;
}

export async function nativeSignOut() {
  if (!hasNativeGoogle()) return;
  try { await (await plugin('FirebaseAuthentication')).signOut(); } catch (err) {}
}

// Системное меню «Поделиться»: текст и (по желанию) картинка.
export async function nativeShare({ text, imageDataUrl, filename }) {
  const share = await plugin('Share');
  if (imageDataUrl) {
    const fs = await plugin('Filesystem');
    const res = await fs.writeFile({ path: filename, data: imageDataUrl.split(',')[1], directory: 'CACHE' });
    await share.share({ text, files: [res.uri], dialogTitle: 'Поделиться серией' });
  } else {
    await share.share({ text, dialogTitle: 'Поделиться' });
  }
}

export async function copyText(text) {
  if (isNative) return (await plugin('Clipboard')).write({ string: text });
  return navigator.clipboard.writeText(text);
}

// Внешние ссылки (WhatsApp и т. п.): в приложении Android сам откроет нужную программу.
export function openExternal(url) {
  if (isNative) location.href = url;
  else window.open(url, '_blank', 'noopener');
}

// Кнопка «Назад» на Android. handler возвращает true, если что-то закрыл.
export async function onBackButton(handler) {
  if (!isNative) return;
  const app = await plugin('App');
  app.addListener('backButton', () => { if (!handler()) app.minimizeApp(); });
}

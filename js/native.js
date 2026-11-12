// Мост к Android-приложению (Capacitor). В браузере всё это просто не используется.
import { registerPlugin } from './vendor/capacitor-core.js';

// Мост Capacitor внедряется в страницу до запуска наших скриптов (androidBridge — его канал связи с Android).
export const isNative = !!(window.androidBridge || window.Capacitor?.isNativePlatform?.());

// Публичный адрес приложения — для ссылок-приглашений из Android-версии.
export const PUBLIC_URL = 'https://shusandrik23.github.io/Poleznieprivichki/';

export function appUrl() {
  return isNative ? PUBLIC_URL : location.origin + location.pathname;
}

// Ядро Capacitor (копия @capacitor/core) подключено обычным импортом — через него вызываются нативные плагины.
// ВАЖНО: plugin() — обычная (не async) функция, и её результат нельзя «ждать» через await.
// Объект плагина Capacitor отвечает на любое свойство, в том числе `then`, поэтому JavaScript
// принимает его за обещание и зависает навсегда. Ждём только результаты методов плагина.
const plugins = {};
function plugin(name) {
  return (plugins[name] ||= registerPlugin(name));
}

// Ограничение по времени, чтобы ничего не висело молча.
function withTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timeout')), ms))]);
}

// Есть ли нативный вход через Google (плагин ставится вместе с настройками Firebase).
export function hasNativeGoogle() {
  return isNative && !!window.Capacitor?.PluginHeaders?.some?.(p => p.name === 'FirebaseAuthentication');
}

export async function nativeGoogleIdToken() {
  // Классическое окно выбора аккаунта Google (Google Play services): на части телефонов
  // новый Credential Manager не показывает окно и не отвечает.
  const res = await plugin('FirebaseAuthentication').signInWithGoogle({ useCredentialManager: false });
  return res?.credential?.idToken;
}

export async function nativeSignOut() {
  if (!hasNativeGoogle()) return;
  try { await withTimeout(plugin('FirebaseAuthentication').signOut(), 5000, 'signOut'); } catch (err) {}
}

// Системное меню «Поделиться»: текст и (по желанию) картинка.
export async function nativeShare({ text, imageDataUrl, filename }) {
  if (imageDataUrl) {
    const res = await plugin('Filesystem').writeFile({ path: filename, data: imageDataUrl.split(',')[1], directory: 'CACHE' });
    await plugin('Share').share({ text, files: [res.uri], dialogTitle: 'YouBoost' });
  } else {
    await plugin('Share').share({ text, dialogTitle: 'YouBoost' });
  }
}

export async function copyText(text) {
  if (isNative) return plugin('Clipboard').write({ string: text });
  return navigator.clipboard.writeText(text);
}

// Внешние ссылки (WhatsApp и т. п.): в приложении Android сам откроет нужную программу.
export function openExternal(url) {
  if (isNative) location.href = url;
  else window.open(url, '_blank', 'noopener');
}

// Проверка связи с Android: отвечает ли нативная часть вообще (для диагностики входа).
export async function bridgeCheck() {
  try {
    const info = await withTimeout(plugin('App').getInfo(), 5000, 'bridge');
    return 'ok ' + (info?.version || '');
  } catch (err) { return 'fail ' + (err?.message || err); }
}
export function pluginHasMethod(name, method) {
  return !!window.Capacitor?.PluginHeaders?.find(p => p.name === name)?.methods?.some(m => m.name === method);
}

// Ссылки, открывшие приложение (возврат из браузера после входа).
export async function onAppUrlOpen(handler) {
  if (!isNative) return;
  plugin('App').addListener('appUrlOpen', ev => handler(ev.url));
  try { const r = await withTimeout(plugin('App').getLaunchUrl(), 5000, 'launchUrl'); if (r?.url) handler(r.url); } catch (err) {}
}

// ---------- Уведомления (Android) ----------
const REMINDER_ID = 1;

export async function notificationsAllowed() {
  if (!isNative) return false;
  try {
    let st = await withTimeout(plugin('LocalNotifications').checkPermissions(), 5000, 'perm');
    if (st.display !== 'granted') st = await plugin('LocalNotifications').requestPermissions();
    return st.display === 'granted';
  } catch (err) { console.error(err); return false; }
}

// Ежедневное напоминание в hh:mm (неточный будильник — не нужно отдельное разрешение на точные).
export async function scheduleDailyReminder(hour, minute, title, body) {
  if (!isNative) return false;
  if (!(await notificationsAllowed())) return false;
  await cancelDailyReminder();
  await plugin('LocalNotifications').schedule({ notifications: [{
    id: REMINDER_ID, title, body, schedule: { on: { hour, minute }, allowWhileIdle: true }, isExactNotification: false,
  }] });
  return true;
}

export async function cancelDailyReminder() {
  if (!isNative) return;
  try { await plugin('LocalNotifications').cancel({ notifications: [{ id: REMINDER_ID }] }); } catch (err) {}
}

// Уведомление прямо сейчас (например, «вам бросили вызов»).
export async function notifyNow(id, title, body) {
  if (isNative) {
    if (!(await notificationsAllowed())) return;
    await plugin('LocalNotifications').schedule({ notifications: [{ id, title, body, isExactNotification: false }] });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'icons/icon-192.png' });
  }
}

// ---------- Пуш-уведомления (Firebase Cloud Messaging) ----------
// Возвращает токен телефона для пушей или null. handlers: { onReceived(n), onTap(data) }.
let pushListening = false;
export async function registerPush(handlers = {}) {
  if (!isNative || !window.Capacitor?.PluginHeaders?.some?.(p => p.name === 'PushNotifications')) return null;
  const push = plugin('PushNotifications');
  let st = await withTimeout(push.checkPermissions(), 5000, 'pushPerm');
  if (st.receive !== 'granted') st = await push.requestPermissions();
  if (st.receive !== 'granted') return null;
  try { await push.createChannel({ id: 'default', name: 'YouBoost', importance: 4 }); } catch (err) {}
  const token = new Promise((resolve, reject) => {
    push.addListener('registration', t => resolve(t.value));
    push.addListener('registrationError', e => reject(new Error(e?.error || 'push registration failed')));
  });
  if (!pushListening) {
    pushListening = true;
    push.addListener('pushNotificationReceived', n => handlers.onReceived?.(n));
    push.addListener('pushNotificationActionPerformed', a => handlers.onTap?.(a?.notification?.data || {}));
  }
  await push.register();
  return withTimeout(token, 20000, 'pushToken');
}

export async function unregisterPush() {
  if (!isNative || !window.Capacitor?.PluginHeaders?.some?.(p => p.name === 'PushNotifications')) return;
  try { await withTimeout(plugin('PushNotifications').unregister(), 5000, 'pushUnreg'); } catch (err) {}
}

// Кнопка «Назад» на Android. handler возвращает true, если что-то закрыл.
export async function onBackButton(handler) {
  if (!isNative) return;
  plugin('App').addListener('backButton', () => { if (!handler()) plugin('App').minimizeApp(); });
}

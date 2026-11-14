// Мост к Android-приложению (Capacitor). В браузере всё это просто не используется.
import { registerPlugin } from './vendor/capacitor-core.js';

export const isNative = !!(window.androidBridge || window.Capacitor?.isNativePlatform?.());
export const PUBLIC_URL = 'https://shusandrik23.github.io/Poleznieprivichki/kids/';

// ВАЖНО: результат plugin() нельзя «ждать» через await — объект плагина притворяется обещанием.
const plugins = {};
function plugin(name) { return (plugins[name] ||= registerPlugin(name)); }
const hasPlugin = name => !!window.Capacitor?.PluginHeaders?.some?.(p => p.name === name);

function withTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timeout')), ms))]);
}

export function hasNativeGoogle() { return isNative && hasPlugin('FirebaseAuthentication'); }

export async function nativeGoogleIdToken() {
  const res = await withTimeout(plugin('FirebaseAuthentication').signInWithGoogle({ useCredentialManager: false }), 60000, 'signin');
  return res?.credential?.idToken;
}

export async function nativeSignOut() {
  if (!hasNativeGoogle()) return;
  try { await withTimeout(plugin('FirebaseAuthentication').signOut(), 5000, 'signOut'); } catch (err) {}
}

export async function shareText(text) {
  if (isNative && hasPlugin('Share')) return plugin('Share').share({ text, dialogTitle: 'YouBoost Kids' });
  if (navigator.share) return navigator.share({ text });
  return copyText(text);
}

export async function copyText(text) {
  if (isNative && hasPlugin('Clipboard')) return plugin('Clipboard').write({ string: text });
  return navigator.clipboard.writeText(text);
}

// Ежедневное напоминание ребёнку (только в Android-приложении).
const REMINDER_ID = 1;
export async function scheduleDailyReminder(hour, minute, title, body) {
  if (!isNative || !hasPlugin('LocalNotifications')) return false;
  const ln = plugin('LocalNotifications');
  let st = await withTimeout(ln.checkPermissions(), 5000, 'perm');
  if (st.display !== 'granted') st = await ln.requestPermissions();
  if (st.display !== 'granted') return false;
  await cancelDailyReminder();
  await ln.schedule({ notifications: [{ id: REMINDER_ID, title, body, schedule: { on: { hour, minute }, allowWhileIdle: true } }] });
  return true;
}
export async function cancelDailyReminder() {
  if (!isNative || !hasPlugin('LocalNotifications')) return;
  try { await plugin('LocalNotifications').cancel({ notifications: [{ id: REMINDER_ID }] }); } catch (err) {}
}
export const canRemind = () => isNative && hasPlugin('LocalNotifications');

// Кнопка «Назад» на Android. handler возвращает true, если что-то закрыл.
export function onBackButton(handler) {
  if (!isNative || !hasPlugin('App')) return;
  plugin('App').addListener('backButton', () => { if (!handler()) plugin('App').minimizeApp(); });
}

// Выбор одного контакта из телефонной книги (без доступа ко всем контактам).
// Android: своё окно выбора (плагин ContactPicker в android/), браузер Chrome на Android: Contact Picker API.
// Номер никуда не отправляется — только чтобы открыть SMS или WhatsApp с приглашением.
export const canPickContact = () => (isNative && hasPlugin('ContactPicker')) || (!isNative && 'contacts' in navigator && 'select' in navigator.contacts);
export async function pickContact() {
  if (isNative) {
    const r = await plugin('ContactPicker').pick();
    return r?.cancelled || !r?.phone ? null : { name: r.name || '', phone: r.phone };
  }
  const list = await navigator.contacts.select(['name', 'tel'], { multiple: false });
  const c = list?.[0];
  return c?.tel?.[0] ? { name: c.name?.[0] || '', phone: c.tel[0] } : null;
}
export function openSms(phone, text) {
  const num = String(phone).replace(/[^\d+]/g, '');
  location.href = `sms:${num}?body=${encodeURIComponent(text)}`;
}
export function openWhatsApp(phone, text) {
  const num = String(phone).replace(/\D/g, '');
  const url = `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  if (isNative) location.href = url; else window.open(url, '_blank', 'noopener');
}

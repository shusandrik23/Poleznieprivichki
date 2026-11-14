// Вечернее напоминание о дневнике. Без сервера браузер может показать уведомление,
// только пока приложение открыто или недавно свёрнуто, — поэтому есть ещё и файл .ics.
import { store, dayKey } from './store.js';

let timer;
export const notifySupported = () => 'Notification' in window;

export async function scheduleReminder(ask = false) {
  clearTimeout(timer);
  const c = store.get('course', null);
  if (!c || !notifySupported()) return;
  if (ask && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch {} }
  if (Notification.permission !== 'granted') return;
  const [hh, mm] = (c.remind || '21:30').split(':').map(Number);
  const now = new Date(), at = new Date(); at.setHours(hh, mm, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  timer = setTimeout(async () => {
    const cur = store.get('course', null);
    if (cur && !cur.entries[dayKey()]) {
      const reg = await navigator.serviceWorker?.getRegistration();
      const opts = { body: 'Время вечернего дневника — 10–15 минут для себя.', icon: 'icons/icon-192.png', tag: 'diary', data: { url: '#/course' } };
      try { reg ? reg.showNotification('🌙 Новый сценарий', opts) : new Notification('🌙 Новый сценарий', opts); } catch {}
    }
    scheduleReminder();
  }, Math.min(at - now, 2 ** 31 - 1));
}

// Всё хранится только на этом устройстве (localStorage). Никаких запросов в сеть.
const P = 'vk.';

export const store = {
  get(k, d) {
    try { const v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); }
    catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(P + k, JSON.stringify(v)); return true; }
    catch (e) { console.warn('Не удалось сохранить', k, e); return false; }
  },
  del(k) { try { localStorage.removeItem(P + k); } catch {} },
  dump() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(P)) out[k.slice(P.length)] = JSON.parse(localStorage.getItem(k));
      }
    } catch {}
    return out;
  },
  load(obj) { for (const [k, v] of Object.entries(obj || {})) this.set(k, v); },
  wipe() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(P)) keys.push(k); }
      keys.forEach(k => localStorage.removeItem(k));
    } catch {}
  },
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const DEFAULTS = { rate: 0.95, voice: '', vibro: true, voiceCmd: false, theme: 'auto', remindTime: '21:30', tts: true };
export const settings = {
  get() { return { ...DEFAULTS, ...store.get('settings', {}) }; },
  set(patch) { store.set('settings', { ...this.get(), ...patch }); },
};

// ---- Сессии (журнал) ----
export const sessions = {
  all() { return store.get('sessions', []); },
  save(rec) {
    const list = this.all().filter(s => s.id !== rec.id);
    list.unshift(rec);
    store.set('sessions', list.slice(0, 300));
  },
  remove(id) { store.set('sessions', this.all().filter(s => s.id !== id)); },
  // Сколько раз техника пройдена до конца с ведущим (гид или партнёр)
  guidedDone(tech) { return this.all().filter(s => s.tech === tech && s.done && s.mode !== 'solo').length; },
};

export const dayKey = (d = new Date()) => {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const addDays = (key, n) => { const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n); return dayKey(d); };
export const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
export const fmtDate = (ts) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

// Голос (озвучка браузером), вибрация, звуковой сигнал, голосовые команды
import { settings } from './store.js';

const synth = window.speechSynthesis;
let voices = [];
function loadVoices() { if (synth) voices = synth.getVoices(); }
if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices); }

export const ttsAvailable = () => !!synth;
export const ruVoices = () => voices.filter(v => /^ru/i.test(v.lang));

let token = 0;
// Озвучивает текст по предложениям (длинные фразы Chrome обрывает). Возвращает Promise.
export function speak(text) {
  stopSpeak();
  const s = settings.get();
  if (!synth || !s.tts || !text) return Promise.resolve();
  const my = ++token;
  const parts = String(text).replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]*/g) || [text];
  const voice = voices.find(v => v.voiceURI === s.voice) || ruVoices()[0];
  return new Promise(resolve => {
    let i = 0;
    const next = () => {
      if (my !== token) return resolve();
      if (i >= parts.length) return resolve();
      const u = new SpeechSynthesisUtterance(parts[i++].trim());
      u.lang = 'ru-RU'; if (voice) u.voice = voice; u.rate = s.rate || 1;
      u.onend = () => setTimeout(next, 180);
      u.onerror = () => setTimeout(next, 50);
      synth.speak(u);
    };
    next();
  });
}
export function stopSpeak() { token++; try { synth && synth.cancel(); } catch {} }

export function vibrate(p = 30) { if (settings.get().vibro && navigator.vibrate) try { navigator.vibrate(p); } catch {} }

let actx;
export function chime() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    [528, 792].forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 1.6);
      o.connect(g).connect(actx.destination); o.start(t + i * 0.18); o.stop(t + i * 0.18 + 1.7);
    });
  } catch {}
}

// Голосовые команды «дальше», «есть ещё», «больше ничего». Включаются в настройках:
// распознавание речи в браузере может отправлять звук на сервер браузера.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const recognitionAvailable = () => !!SR;
export function listen(onCmd) {
  if (!SR || !settings.get().voiceCmd) return () => {};
  let stopped = false, rec;
  const start = () => {
    if (stopped) return;
    rec = new SR(); rec.lang = 'ru-RU'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = e => {
      const said = e.results[e.results.length - 1][0].transcript.toLowerCase();
      if (/больше ничего|ничего нет|всё|хватит|закончил/.test(said)) onCmd('done');
      else if (/ещ[её]|есть/.test(said)) onCmd('more');
      else if (/дальше|далее|готов|продолж/.test(said)) onCmd('next');
    };
    rec.onend = () => setTimeout(start, 300);
    rec.onerror = () => {};
    try { rec.start(); } catch {}
  };
  start();
  return () => { stopped = true; try { rec && rec.abort(); } catch {} };
}

// Не даём экрану гаснуть во время сессии
let lock;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen');
    else if (!on && lock) { await lock.release(); lock = null; }
  } catch {}
}

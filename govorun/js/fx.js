// Звуки (Web Audio, без аудиофайлов), вибрация и конфетти.
(function () {
  let ctx = null;
  let enabled = true;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Одна нота: частота, начало (с), длительность (с), тип волны, громкость.
  function tone(freq, start, dur, type, vol, slideTo) {
    const a = ac();
    if (!a) return;
    const t0 = a.currentTime + start;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  const sounds = {
    tap() { tone(660, 0, 0.06, 'triangle', 0.08); },
    correct() {
      tone(784, 0, 0.12, 'sine', 0.2);       // G5
      tone(1047, 0.1, 0.22, 'sine', 0.2);    // C6
      tone(1568, 0.1, 0.18, 'triangle', 0.05);
    },
    wrong() {
      tone(220, 0, 0.18, 'square', 0.07, 180);
      tone(165, 0.16, 0.28, 'square', 0.07, 130);
    },
    tile() { tone(520, 0, 0.05, 'triangle', 0.07, 700); },
    start() { tone(440, 0, 0.1, 'sine', 0.15); tone(880, 0.1, 0.15, 'sine', 0.15); },
    tick() { tone(1200, 0, 0.03, 'square', 0.04); },
    word() { tone(988, 0, 0.08, 'triangle', 0.12); tone(1319, 0.07, 0.12, 'triangle', 0.12); },
    win() {
      const notes = [523, 659, 784, 1047, 784, 1047, 1319];
      notes.forEach((f, i) => tone(f, i * 0.11, i === notes.length - 1 ? 0.6 : 0.16, 'triangle', 0.16));
      tone(262, 0, 0.9, 'sine', 0.08);
    },
    heart() { tone(300, 0, 0.25, 'sine', 0.15, 120); },
    gem() { tone(1400, 0, 0.08, 'sine', 0.1); tone(2100, 0.06, 0.12, 'sine', 0.08); },
  };

  function play(name) {
    if (!enabled) return;
    try { sounds[name] && sounds[name](); } catch (e) { /* звук не обязателен */ }
  }

  function vibrate(p) {
    try { if (enabled && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* нет вибрации */ }
  }

  // ---- Конфетти ----
  const COLORS = ['#58CC02', '#1CB0F6', '#FFC800', '#FF4B4B', '#CE82FF', '#FF9600'];
  let parts = [];
  let raf = null;

  function confetti(amount) {
    const cv = document.getElementById('confetti');
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = amount || 140;
    for (let i = 0; i < n; i++) {
      const fromLeft = i % 2 === 0;
      parts.push({
        x: fromLeft ? -10 : innerWidth + 10,
        y: innerHeight * (0.45 + Math.random() * 0.25),
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 7),
        vy: -(9 + Math.random() * 9),
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0,
      });
    }
    if (!raf) {
      const step = () => {
        g.clearRect(0, 0, innerWidth, innerHeight);
        parts.forEach((p) => {
          p.life++;
          p.vy += 0.32;
          p.vx *= 0.985;
          p.x += p.vx;
          p.y += p.vy;
          p.r += p.vr;
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.r);
          g.fillStyle = p.c;
          g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life * 0.1)));
          g.restore();
        });
        parts = parts.filter((p) => p.y < innerHeight + 40 && p.life < 400);
        if (parts.length) raf = requestAnimationFrame(step);
        else { raf = null; g.clearRect(0, 0, innerWidth, innerHeight); }
      };
      raf = requestAnimationFrame(step);
    }
  }

  window.FX = {
    play,
    vibrate,
    confetti,
    setEnabled(v) { enabled = !!v; },
    unlock() { ac(); },
  };
})();

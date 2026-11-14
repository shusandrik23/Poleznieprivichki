// Анимация «сжигания» листа с текстом: огонь идёт снизу вверх, искры и пепел
import { h } from './ui.js';

export function burnView(text, { title = '' } = {}) {
  const cvs = h('canvas', { class: 'burn-canvas' });
  const el = h('div', { class: 'burn' }, cvs);
  let laid = null;

  function layout() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.min(560, (el.clientWidth || 340));
    const ctx = cvs.getContext('2d');
    let font = 18; const pad = 22;
    const lines = [];
    const wrap = (fs) => {
      lines.length = 0; ctx.font = `${fs}px Georgia, serif`;
      const paras = (title ? [title, ''] : []).concat(String(text || '').split('\n'));
      for (const para of paras) {
        let cur = '';
        for (const word of para.split(/\s+/)) {
          const t = (cur ? cur + ' ' : '') + word;
          if (ctx.measureText(t).width > w - pad * 2 && cur) { lines.push(cur); cur = word; } else cur = t;
        }
        lines.push(cur);
      }
    };
    wrap(font);
    while (lines.length * font * 1.5 > 700 && font > 11) wrap(--font);
    const hgt = Math.max(260, Math.min(760, lines.length * font * 1.5 + pad * 2));
    cvs.width = w * dpr; cvs.height = hgt * dpr; cvs.style.width = w + 'px'; cvs.style.height = hgt + 'px';
    // Бумага с текстом — во внеэкранный холст
    const base = document.createElement('canvas'); base.width = cvs.width; base.height = cvs.height;
    const b = base.getContext('2d'); b.scale(dpr, dpr);
    const grd = b.createLinearGradient(0, 0, w, hgt); grd.addColorStop(0, '#f6ecd4'); grd.addColorStop(1, '#ead9b4');
    b.fillStyle = grd; b.fillRect(0, 0, w, hgt);
    b.fillStyle = '#2d2a26'; b.font = `${font}px Georgia, serif`; b.textBaseline = 'top';
    let y = pad; const maxLines = Math.floor((hgt - pad * 2) / (font * 1.5));
    lines.slice(0, maxLines).forEach((l, i) => { b.fillText(i === maxLines - 1 && lines.length > maxLines ? l + ' …' : l, pad, y); y += font * 1.5; });
    cvs.getContext('2d').drawImage(base, 0, 0);
    laid = { base, w, hgt, dpr };
  }

  function start() {
    if (!laid) layout();
    const { base, w, hgt, dpr } = laid;
    const ctx = cvs.getContext('2d');
    const C = 5, cols = Math.ceil(w / C), rows = Math.ceil(hgt / C);
    // Плавный шум, чтобы край огня был неровным
    const gx = 8, gy = 10, grid = Array.from({ length: (gx + 1) * (gy + 1) }, () => Math.random());
    const noise = (x, y) => {
      const fx = x * gx, fy = y * gy, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const g = (a, c) => grid[Math.min(gy, c) * (gx + 1) + Math.min(gx, a)];
      const a = g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx, b = g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx;
      return a * (1 - ty) + b * ty;
    };
    const thr = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      thr[r * cols + c] = (1 - r / rows) * 0.72 + noise(c / cols, r / rows) * 0.28 + Math.random() * 0.03;
    const parts = [];
    const T = 6200; const t0 = performance.now();
    return new Promise(resolve => {
      function frame(now) {
        const t = (now - t0) / T * 1.2;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.drawImage(base, 0, 0);
        ctx.scale(dpr, dpr);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const d = t - thr[r * cols + c];
          if (d < -0.07) continue;
          const x = c * C, y = r * C;
          if (d < 0) { ctx.fillStyle = `rgba(110,60,20,${(d + 0.07) / 0.07 * 0.6})`; ctx.fillRect(x, y, C, C); }
          else if (d < 0.035) {
            ctx.fillStyle = Math.random() < 0.5 ? '#ffb43a' : '#ff6a1a'; ctx.fillRect(x, y, C, C);
            if (Math.random() < 0.05) parts.push({ x: x + C / 2, y, vx: (Math.random() - 0.5) * 0.6, vy: -1 - Math.random() * 1.6, life: 1, ember: true });
            if (Math.random() < 0.02) parts.push({ x: x + C / 2, y, vx: (Math.random() - 0.5) * 0.8, vy: -0.3 - Math.random() * 0.5, life: 1, ember: false });
          } else if (d < 0.06) { ctx.fillStyle = '#1e1410'; ctx.fillRect(x, y, C, C); }
          else ctx.clearRect(x, y, C, C);
        }
        for (const p of parts) {
          p.x += p.vx; p.y += p.vy; p.life -= p.ember ? 0.012 : 0.006; if (!p.ember) p.vx += (Math.random() - 0.5) * 0.1;
          if (p.life <= 0) continue;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.ember ? (Math.random() < 0.3 ? '#fff1a8' : '#ff8a2a') : '#8a847c';
          ctx.fillRect(p.x, p.y, p.ember ? 2.5 : 3.5, p.ember ? 2.5 : 3.5);
        }
        ctx.globalAlpha = 1;
        for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
        if (t < 1.12 || parts.length) requestAnimationFrame(frame);
        else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }
  requestAnimationFrame(() => { if (!laid) layout(); });
  return { el, start, layout };
}

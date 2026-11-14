// Интерактивный холст вместо листа А4: маркеры, блокады с процентами, переворот на 180°, экспорт в картинку
import { h, saveImage, toast } from './ui.js';

export const TYPES = {
  me:     { label: 'Я', color: '#4f7cff', r: 34, single: true },
  i1:     { label: 'Я1', full: 'Я1 — как сейчас', color: '#7d8799', r: 36, single: true },
  i2:     { label: 'Я2', full: 'Я2 — желаемый образ', color: '#e8a33a', r: 40, single: true },
  goal:   { label: 'Цель', color: '#3aa76d', r: 34, single: true },
  block:  { label: 'Блокада', color: '#e05252', r: 24, pct: true },
  root:   { label: 'КВБ', full: 'Корень всех блокад', color: '#8c2f39', r: 32, single: true },
  well:   { label: 'Колодец', color: '#2c8c8c', r: 32, single: true },
  sphere: { label: 'Сфера', color: '#9b6bd6', r: 20 },
  level:  { label: 'Уровень', color: '#b08a4a', r: 30 },
};
export const LEVELS = ['Родители', 'Род', 'Народ', 'Человечество', 'Природа', 'Вселенная', 'Бог'];
export const SPHERES = ['Здоровье и тело', 'Отношения и семья', 'Деньги', 'Дело и работа', 'Развитие', 'Духовность'];
export const PRESETS = {
  matrix:  { tools: ['me', 'goal', 'block', 'root', 'well'], flip: false, title: 'Матрица решений' },
  quantum: { tools: ['i1', 'i2', 'block', 'root', 'well', 'sphere'], flip: true, title: 'Квантовый переход' },
  rod:     { tools: [], fixed: true, title: 'Сила рода и единства' },
};

const W = 1000, H = 1300, NS = 'http://www.w3.org/2000/svg';
let seq = 0;
const nid = () => 'm' + Date.now().toString(36) + (seq++);

export function newMap(preset) {
  const m = { preset, items: [], flipped: false, belief: '', done: [] };
  if (preset === 'rod') {
    m.items.push({ id: 'me', type: 'me', x: 500, y: 1215, label: 'Я' });
    LEVELS.forEach((l, i) => m.items.push({ id: 'lv' + i, type: 'level', x: i % 2 ? 690 : 310, y: 1060 - i * 150, label: l }));
  }
  return m;
}
export const blocksOf = m => (m?.items || []).filter(i => i.type === 'block');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Разметка содержимого карты (используется и на экране, и при экспорте)
function mapMarkup(map, { ink = 'currentColor', sel = null, current = -1 } = {}) {
  const P = p => (map.flipped ? { x: W - p.x, y: H - p.y } : { x: p.x, y: p.y });
  const by = t => map.items.filter(i => i.type === t);
  const one = t => by(t)[0];
  let s = '';
  const line = (a, b, dash, color = ink, w = 3, op = 0.45) => {
    if (!a || !b) return;
    const A = P(a), B = P(b);
    s += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${color}" stroke-width="${w}" opacity="${op}" ${dash ? 'stroke-dasharray="10 10"' : ''}/>`;
  };
  if (map.preset === 'matrix') { line(one('me'), one('goal'), false, '#3aa76d', 5, 0.6); }
  if (map.preset === 'quantum') { line(one('i1'), one('i2'), false, '#e8a33a', 5, 0.6); by('sphere').forEach(sp => line(sp, one('i2'), false, '#9b6bd6', 2, 0.4)); }
  by('block').forEach(b => line(b, one('root'), true, '#8c2f39', 2, 0.5));
  if (map.preset === 'rod') {
    const chain = [one('me'), ...by('level')];
    for (let i = 1; i < chain.length; i++) line(chain[i - 1], chain[i], !(map.done || []).includes(i - 1), '#b08a4a', 4, 0.6);
  }
  map.items.forEach((it, idx) => {
    const T = TYPES[it.type]; const p = P(it);
    let r = T.r; if (it.type === 'block') r = 20 + (it.pct || 50) * 0.32;
    let fill = T.color, op = 1;
    if (it.type === 'level') {
      const li = +it.id.slice(2); const done = (map.done || []).includes(li);
      fill = done ? '#d4a017' : li === current ? '#b08a4a' : '#9a9a9a'; op = done || li === current ? 1 : 0.55;
      if (done) s += `<circle cx="${p.x}" cy="${p.y}" r="${r + 14}" fill="#f5d36b" opacity="0.35"/>`;
    }
    if (it.id === sel) s += `<circle cx="${p.x}" cy="${p.y}" r="${r + 9}" fill="none" stroke="${ink}" stroke-width="3" stroke-dasharray="6 6"/>`;
    s += `<g data-id="${it.id}" style="cursor:pointer" opacity="${op}">`;
    if (it.type === 'well') s += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="none" stroke="${fill}" stroke-width="8"/><circle cx="${p.x}" cy="${p.y}" r="${r - 12}" fill="${fill}" opacity="${it.cleared ? 0.15 : 0.6}"/>`;
    else s += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}" ${it.cleared ? 'opacity="0.35"' : ''}/>`;
    const inner = it.type === 'block' ? `${it.pct || 50}%` : (['me', 'i1', 'i2', 'root'].includes(it.type) ? T.label : it.type === 'level' ? String(+it.id.slice(2) + 1) : '');
    if (inner) s += `<text x="${p.x}" y="${p.y + 8}" text-anchor="middle" font-size="${inner.length > 3 ? 20 : 24}" font-weight="700" fill="#fff">${esc(inner)}</text>`;
    const lbl = it.type === 'block' || it.type === 'sphere' || it.type === 'level' || it.type === 'goal' || it.type === 'well' ? (it.label || T.label) : (it.label && it.label !== T.label ? it.label : '');
    if (lbl) s += `<text x="${p.x}" y="${p.y + r + 30}" text-anchor="middle" font-size="26" fill="${ink}">${esc(lbl.length > 26 ? lbl.slice(0, 25) + '…' : lbl)}</text>`;
    s += '</g>';
  });
  return s;
}

function wrapLines(text, max = 34) {
  const out = []; let cur = '';
  for (const w of String(text).split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

export async function exportMap(map, title) {
  const belief = (map.belief || '').trim();
  const lines = belief ? wrapLines(belief) : [];
  const HH = 1300 + 130 + (lines.length ? 80 + lines.length * 48 : 40);
  let s = `<svg xmlns="${NS}" viewBox="0 0 1000 ${HH}" width="1080" height="${Math.round(HH * 1.08)}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">`;
  s += `<rect width="1000" height="${HH}" fill="#fbf8f2"/>`;
  s += `<text x="500" y="70" text-anchor="middle" font-size="40" font-weight="700" fill="#2a2a33">${esc(title)}</text>`;
  s += `<text x="500" y="112" text-anchor="middle" font-size="24" fill="#7a7a85">${new Date().toLocaleDateString('ru-RU')}</text>`;
  s += `<g transform="translate(0 120)">${mapMarkup(map, { ink: '#2a2a33' })}</g>`;
  if (lines.length) {
    const y0 = 1300 + 150;
    s += `<rect x="40" y="${y0 - 10}" width="920" height="${lines.length * 48 + 70}" rx="24" fill="#fff3d6"/>`;
    s += `<text x="500" y="${y0 + 30}" text-anchor="middle" font-size="24" fill="#8a6a1e">Моё новое убеждение</text>`;
    lines.forEach((l, i) => { s += `<text x="500" y="${y0 + 80 + i * 48}" text-anchor="middle" font-size="36" font-weight="700" fill="#2a2a33">${esc(l)}</text>`; });
  }
  s += '</svg>';
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width || 1080; c.height = img.height || Math.round(HH * 1.08);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  await saveImage(blob, `karta-${new Date().toISOString().slice(0, 10)}.png`);
}

// Редактор карты. map изменяется на месте, onChange вызывается после правок.
export function mapEditor(map, { onChange = () => {}, current = -1, compact = false, title } = {}) {
  const preset = PRESETS[map.preset];
  let tool = preset.tools[0] || null, sel = null, drag = null;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'map-svg');
  const draw = () => {
    svg.innerHTML = `<defs><pattern id="g" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="currentColor" stroke-width="1" opacity=".08"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#g)"/>` +
      (map.flipped ? `<text x="${W - 24}" y="44" text-anchor="end" font-size="26" fill="#e8a33a">↻ Взгляд со стороны Я2</text>` : '') +
      mapMarkup(map, { sel, current });
  };
  const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return { x: Math.max(30, Math.min(W - 30, q.x)), y: Math.max(30, Math.min(H - 30, q.y)) }; };
  const model = p => (map.flipped ? { x: W - p.x, y: H - p.y } : p);
  const changed = (panelToo) => { draw(); if (panelToo) renderPanel(); onChange(map); };

  svg.addEventListener('pointerdown', e => {
    const g = e.target.closest('[data-id]');
    const p = pt(e);
    if (g) {
      if (preset.fixed) { sel = g.dataset.id; draw(); return; }
      drag = { id: g.dataset.id, x: p.x, y: p.y, moved: false };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    if (preset.fixed || !tool) return;
    const T = TYPES[tool]; const m = model(p);
    let it = T.single && map.items.find(i => i.type === tool);
    if (it) { it.x = m.x; it.y = m.y; }
    else {
      it = { id: nid(), type: tool, x: m.x, y: m.y, label: T.label };
      if (tool === 'block') { it.pct = 50; it.label = 'Блокада ' + (blocksOf(map).length + 1); }
      if (tool === 'sphere') { const used = map.items.filter(i => i.type === 'sphere').map(i => i.label); it.label = SPHERES.find(s => !used.includes(s)) || 'Сфера'; }
      map.items.push(it);
    }
    sel = it.id;
    changed(true);
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = pt(e);
    if (Math.hypot(p.x - drag.x, p.y - drag.y) > 10) drag.moved = true;
    if (!drag.moved) return;
    const it = map.items.find(i => i.id === drag.id); const m = model(p);
    it.x = m.x; it.y = m.y; draw();
  });
  const end = () => { if (!drag) return; const d = drag; drag = null; if (!d.moved) { sel = d.id; changed(true); } else changed(false); };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  const panel = h('div', { class: 'map-panel' });
  function renderPanel() {
    const kids = [];
    if (preset.tools.length) {
      kids.push(h('div', { class: 'map-tools' },
        h('span', { class: 'muted small' }, 'Коснитесь холста, чтобы поставить:'),
        h('div', { class: 'chips' }, preset.tools.map(t => h('button', {
          class: 'chip tool' + (t === tool ? ' on' : ''), style: { '--c': TYPES[t].color },
          onclick: () => { tool = t; renderPanel(); },
        }, TYPES[t].full || TYPES[t].label)))));
      const row = [];
      if (preset.flip) row.push(h('button', { class: 'btn ' + (map.flipped ? 'primary' : 'ghost'), onclick: () => { map.flipped = !map.flipped; changed(true); } }, map.flipped ? '↺ Вернуть как было' : '↻ Перевернуть на 180°'));
      if (map.preset === 'quantum' && !map.items.some(i => i.type === 'sphere')) row.push(h('button', { class: 'btn ghost', onclick: addSpheres }, '+ 6 сфер вокруг Я2'));
      if (row.length) kids.push(h('div', { class: 'row wrap' }, row));
    }
    const list = map.items.filter(i => i.type !== 'me' || map.preset !== 'rod');
    if (list.length && !preset.fixed) {
      kids.push(h('div', { class: 'map-list' }, list.map(it => {
        const T = TYPES[it.type];
        return h('div', { class: 'map-item' + (it.id === sel ? ' sel' : '') },
          h('span', { class: 'dot', style: { background: T.color } }),
          h('input', { class: 'input slim', value: it.label || '', 'aria-label': 'Название', oninput: e => { it.label = e.target.value; draw(); onChange(map); } }),
          T.pct && h('label', { class: 'pct' },
            h('input', { type: 'range', min: 1, max: 100, value: it.pct || 50, oninput: e => { it.pct = +e.target.value; e.target.nextSibling.textContent = it.pct + '%'; draw(); onChange(map); } }),
            h('b', null, (it.pct || 50) + '%')),
          h('button', { class: 'icon-btn', 'aria-label': 'Удалить', onclick: () => { map.items = map.items.filter(x => x !== it); if (sel === it.id) sel = null; changed(true); } }, '✕'));
      })));
      const bl = blocksOf(map);
      if (bl.length) kids.push(h('p', { class: 'muted small' }, `Блокад: ${bl.length}. Двигайте ползунок — сколько энергии (1–100%) забирает каждая.`));
    }
    if (!compact) {
      kids.push(h('label', { class: 'field' }, h('span', null, 'Новое убеждение (для картинки)'),
        h('textarea', { class: 'input', rows: 2, placeholder: 'Например: «Я спокойно иду к своей цели»', value: map.belief || '', oninput: e => { map.belief = e.target.value; onChange(map); } })));
      kids.push(h('button', { class: 'btn ghost', onclick: () => exportMap(map, title || preset.title).catch(() => toast('Не удалось сохранить картинку')) }, '🖼 Сохранить карту картинкой'));
    }
    panel.replaceChildren(...kids);
  }
  function addSpheres() {
    const c = map.items.find(i => i.type === 'i2') || { x: 500, y: 350 };
    SPHERES.forEach((s, k) => {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      map.items.push({ id: nid(), type: 'sphere', label: s, x: Math.max(60, Math.min(W - 60, c.x + Math.cos(a) * 190)), y: Math.max(60, Math.min(H - 60, c.y + Math.sin(a) * 190)) });
    });
    changed(true);
  }
  draw(); renderPanel();
  return h('div', { class: 'map-editor' }, h('div', { class: 'map-wrap' }, svg), panel);
}

// Небольшая карта только для просмотра (прогресс уровней рода и т.п.)
export function mapPreview(map, current = -1) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'map-svg preview');
  svg.innerHTML = mapMarkup(map, { current });
  return svg;
}

// Мини-помощники для DOM
export const $ = (s, r = document) => r.querySelector(s);

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function modal(content, { title, onClose, full = false } = {}) {
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'modal-box' + (full ? ' full' : ''), role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'modal-head' },
      h('h3', null, title || ''),
      h('button', { class: 'icon-btn', 'aria-label': 'Закрыть', onclick: close }, '✕')),
    h('div', { class: 'modal-body' }, content));
  const wrap = h('div', { class: 'modal-wrap', onclick: e => { if (e.target === wrap) close(); } }, box);
  document.body.append(wrap);
  document.addEventListener('keydown', onKey);
  return close;
}

export function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

export function confirmBox(msg, { ok = 'Да', cancel = 'Отмена', danger = false } = {}) {
  return new Promise(res => {
    let done = false;
    const finish = v => { if (done) return; done = true; close(); res(v); };
    const body = h('div', null,
      h('p', null, msg),
      h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', onclick: () => finish(false) }, cancel),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => finish(true) }, ok)));
    const close = modal(body, { title: '', onClose: () => finish(false) });
  });
}

// Подставляет {переменные} в текст
export function fill(text, vars = {}, ctx) {
  if (typeof text === 'function') text = text(ctx);
  if (text == null) return '';
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
}

export function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Сохранить картинку: «Поделиться» (на телефоне → «Сохранить в галерею») или скачать
export async function saveImage(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  download(blob, name);
}

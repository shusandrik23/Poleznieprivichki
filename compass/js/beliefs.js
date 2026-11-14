// Календарь закрепления: 14 дней утренней работы с новым убеждением + счётчик аффирмаций
import { h, modal, toast, confirmBox } from './ui.js';
import { store, uid, dayKey, addDays, daysBetween, fmtDate } from './store.js';
import { vibrate, chime } from './speech.js';

export const beliefs = {
  all() { return store.get('beliefs', []); },
  save(list) { store.set('beliefs', list); },
  add(text, tech) {
    const list = this.all();
    if (list.some(b => b.text === text && daysBetween(b.start, dayKey()) < 14)) return;
    list.unshift({ id: uid(), text, tech, start: dayKey(), days: {}, target: 30 });
    this.save(list);
  },
  update(id, patch) { this.save(this.all().map(b => (b.id === id ? { ...b, ...patch } : b))); },
  remove(id) { this.save(this.all().filter(b => b.id !== id)); },
};

// Кликер с прогресс-баром: считает повторения формулы
export function counterEl(text, { target = 30, start = 0, onChange, onDone } = {}) {
  let n = start, tgt = target;
  const bar = h('div', { class: 'bar' }, h('i'));
  const num = h('b', { class: 'cnt-num' });
  const sel = h('div', { class: 'seg' }, [20, 30, 50].map(v => h('button', { class: v === tgt ? 'on' : '', onclick: e => { tgt = v; sel.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); upd(); onChange && onChange(n, tgt); } }, v)));
  const upd = () => { num.textContent = `${n} / ${tgt}`; bar.firstChild.style.width = Math.min(100, (n / tgt) * 100) + '%'; btn.classList.toggle('full', n >= tgt); };
  const btn = h('button', { class: 'cnt-btn', 'aria-label': 'Повторил(а)', onclick: () => {
    n++; vibrate(n === tgt ? [80, 60, 120] : 15); upd(); onChange && onChange(n, tgt);
    if (n === tgt) { chime(); onDone && onDone(n); }
  } }, h('span', { class: 'cnt-text' }, text || 'Формула'), num);
  upd();
  return h('div', { class: 'counter' },
    h('p', { class: 'muted small center' }, 'Произнесите формулу и коснитесь круга. Цель повторений:'), sel, btn, bar,
    h('button', { class: 'btn ghost small', onclick: () => { if (n > 0) { n--; upd(); onChange && onChange(n, tgt); } } }, '−1 исправить'));
}

export function openCounter(b, onSaved) {
  const today = dayKey();
  const close = modal(h('div', null,
    h('p', { class: 'muted' }, 'Утром, сразу после пробуждения: прочитайте убеждение вслух или про себя, почувствуйте его в теле. Если сохраняли карту — посмотрите на неё.'),
    counterEl(b.text, {
      target: b.target || 30, start: b.days[today] || 0,
      onChange: (n, tgt) => { b.days[today] = n; b.target = tgt; beliefs.update(b.id, { days: b.days, target: tgt }); onSaved && onSaved(); },
      onDone: () => toast('Готово на сегодня! 🌞'),
    }),
    h('button', { class: 'btn primary wide', onclick: () => close() }, 'Закрыть')), { title: 'Утреннее закрепление' });
}

export function beliefsScreen(root, back) {
  const render = () => {
    const list = beliefs.all();
    const today = dayKey();
    const form = h('input', { class: 'input', placeholder: 'Новое убеждение, например: «Я достоин(на) любви»' });
    root.replaceChildren(h('div', { class: 'page' },
      back(),
      h('h1', null, '📅 Календарь закрепления'),
      h('p', { class: 'muted' }, '14 дней по утрам повторяйте новое убеждение 20–50 раз. Убеждения добавляются сами в конце глубоких практик — или впишите своё.'),
      h('div', { class: 'row' }, form, h('button', { class: 'btn primary', onclick: () => { const v = form.value.trim(); if (!v) return; beliefs.add(v, null); render(); } }, 'Добавить')),
      list.length ? list.map(b => {
        const day = daysBetween(b.start, today) + 1;
        const cells = Array.from({ length: 14 }, (_, i) => {
          const k = addDays(b.start, i);
          const cnt = b.days[k] || 0;
          const st = cnt >= (b.target || 30) ? 'done' : cnt > 0 ? 'part' : k < today ? 'miss' : k === today ? 'today' : 'future';
          return h('div', { class: 'cal-cell ' + st, title: fmtDate(k + 'T12:00') + (cnt ? ` · ${cnt}` : '') }, i + 1);
        });
        const doneDays = Object.keys(b.days).filter(k => b.days[k] >= (b.target || 30)).length;
        const active = day >= 1 && day <= 14;
        return h('div', { class: 'card' },
          h('div', { class: 'belief-text' }, '«' + b.text + '»'),
          h('div', { class: 'muted small' }, active ? `День ${day} из 14 · выполнено дней: ${doneDays}` : day > 14 ? `Цикл завершён · выполнено дней: ${doneDays} из 14` : ''),
          h('div', { class: 'cal' }, cells),
          h('div', { class: 'row' },
            active && h('button', { class: 'btn primary', onclick: () => openCounter(b, render) }, (b.days[today] || 0) >= (b.target || 30) ? '✓ Сегодня готово' : '☀️ Утренние повторения'),
            day > 14 && h('button', { class: 'btn soft', onclick: () => { beliefs.update(b.id, { start: today, days: {} }); render(); } }, 'Ещё 14 дней'),
            h('button', { class: 'btn ghost', onclick: async () => { if (await confirmBox('Удалить это убеждение из календаря?', { ok: 'Удалить', danger: true })) { beliefs.remove(b.id); render(); } } }, 'Удалить')));
      }) : h('div', { class: 'empty' }, 'Пока пусто. Пройдите глубокую практику или добавьте убеждение вручную.')));
  };
  render();
}

// Справочник чувств и состояний: 135 слов в 5 цветовых кластерах
import { h, modal } from './ui.js';

export const CLUSTERS = [
  { id: 'anger', name: 'Гнев', color: '#e0594f', words: ['гнев', 'злость', 'ярость', 'бешенство', 'раздражение', 'возмущение', 'негодование', 'обида', 'досада', 'ненависть', 'зависть', 'ревность', 'презрение', 'отвращение', 'брезгливость', 'враждебность', 'неприязнь', 'недовольство', 'нетерпение', 'мстительность', 'агрессия', 'упрямство', 'протест', 'осуждение', 'горечь', 'ожесточение', 'вредность'] },
  { id: 'fear', name: 'Страх', color: '#8a66c9', words: ['страх', 'ужас', 'паника', 'тревога', 'беспокойство', 'волнение', 'испуг', 'опасение', 'неуверенность', 'растерянность', 'беспомощность', 'стыд', 'вина', 'смущение', 'неловкость', 'робость', 'застенчивость', 'подозрительность', 'недоверие', 'оцепенение', 'напряжение', 'нервозность', 'уязвимость', 'смятение', 'боязнь осуждения', 'страх потери', 'страх одиночества'] },
  { id: 'sad', name: 'Грусть', color: '#4f86c9', words: ['грусть', 'печаль', 'тоска', 'горе', 'скорбь', 'уныние', 'отчаяние', 'безысходность', 'разочарование', 'сожаление', 'одиночество', 'покинутость', 'отверженность', 'ненужность', 'жалость к себе', 'апатия', 'усталость', 'опустошённость', 'безразличие', 'подавленность', 'хандра', 'меланхолия', 'ностальгия', 'беспросветность', 'бессилие', 'тяжесть', 'утрата'] },
  { id: 'joy', name: 'Радость', color: '#d9a21b', words: ['радость', 'счастье', 'восторг', 'ликование', 'воодушевление', 'вдохновение', 'энтузиазм', 'интерес', 'любопытство', 'азарт', 'веселье', 'игривость', 'облегчение', 'удовлетворение', 'гордость', 'уверенность', 'бодрость', 'лёгкость', 'свобода', 'спокойствие', 'умиротворение', 'безмятежность', 'надежда', 'предвкушение', 'удивление', 'изумление', 'торжество'] },
  { id: 'love', name: 'Любовь', color: '#d9578f', words: ['любовь', 'нежность', 'теплота', 'привязанность', 'забота', 'сочувствие', 'сострадание', 'доброта', 'благодарность', 'признательность', 'принятие', 'доверие', 'близость', 'уважение', 'восхищение', 'симпатия', 'влюблённость', 'обожание', 'преданность', 'единство', 'прощение', 'дружелюбие', 'открытость', 'щедрость', 'гармония', 'умиление', 'расположенность'] },
];

export const colorOf = w => (CLUSTERS.find(c => c.words.includes(w)) || {}).color || '#888';

export function chip(word, { on, selected } = {}) {
  return h('button', {
    type: 'button',
    class: 'chip' + (selected ? ' on' : ''),
    style: { '--c': colorOf(word) },
    onclick: on,
  }, word);
}

// Сетка всех чувств с поиском. selected — Set, onToggle(word) вызывается по нажатию.
export function feelingsGrid(selected, onToggle) {
  const list = h('div');
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Найти чувство…', oninput: () => render() });
  function render() {
    const q = search.value.trim().toLowerCase();
    list.replaceChildren(...CLUSTERS.map(c => {
      const words = c.words.filter(w => !q || w.includes(q));
      if (!words.length) return null;
      return h('section', { class: 'cluster', style: { '--c': c.color } },
        h('h4', null, h('span', { class: 'dot' }), c.name),
        h('div', { class: 'chips' }, words.map(w => chip(w, {
          selected: selected.has(w),
          on: e => { onToggle(w); e.currentTarget.classList.toggle('on', selected.has(w)); },
        }))));
    }).filter(Boolean));
  }
  render();
  return h('div', { class: 'feelings' }, search, list);
}

// Модальное окно справочника. onDone(массив слов)
export function openFeelings({ selected = [], onDone, title = 'Справочник чувств' } = {}) {
  const set = new Set(selected);
  const picked = h('div', { class: 'chips picked' });
  const renderPicked = () => picked.replaceChildren(...(set.size
    ? [...set].map(w => chip(w, { selected: true, on: () => { set.delete(w); renderPicked(); grid.replaceWith(grid = mk()); } }))
    : [h('span', { class: 'muted' }, 'Отметьте то, что откликается — можно несколько')]));
  const mk = () => feelingsGrid(set, w => { set.has(w) ? set.delete(w) : set.add(w); renderPicked(); });
  let grid = mk();
  renderPicked();
  const body = h('div', null,
    picked,
    grid,
    onDone && h('div', { class: 'sticky-foot' },
      h('button', { class: 'btn primary wide', onclick: () => { close(); onDone([...set]); } }, 'Готово')));
  const close = modal(body, { title, full: true });
}

export const TOTAL = CLUSTERS.reduce((n, c) => n + c.words.length, 0);

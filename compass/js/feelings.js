// Таблица чувств и состояний из «Техник ТВП»: 5 цветовых кластеров
import { h, modal } from './ui.js';

// Таблица чувств из «Техник ТВП»: 5 кластеров + «Мысли (или состояния), вызванные гаммой чувств»
export const CLUSTERS = [
  { id: 'anger', name: 'Гнев', color: '#e0594f',
    words: ['бешенство', 'ярость', 'ненависть', 'истерия', 'злость', 'раздражение', 'презрение', 'негодование', 'обида', 'ревность', 'уязвлённость', 'досада', 'зависть', 'неприязнь', 'возмущение', 'отвращение'],
    states: ['нервозность', 'пренебрежение', 'недовольство', 'вредность', 'огорчение', 'нетерпимость', 'вседозволенность'] },
  { id: 'fear', name: 'Страх', color: '#8a66c9',
    words: ['ужас', 'отчаяние', 'испуг', 'оцепенение', 'подозрение', 'тревога', 'ошарашенность', 'беспокойство', 'боязнь', 'унижение', 'замешательство', 'растерянность', 'вина', 'стыд', 'сомнение', 'застенчивость', 'опасение', 'смущение', 'сломленность', 'подвох', 'надменность', 'ошеломлённость'],
    states: ['раскаяние', 'безвыходность', 'превосходство', 'высокомерие', 'неполноценность', 'неудобство', 'неловкость', 'апатия', 'безразличие', 'неуверенность'] },
  { id: 'sad', name: 'Грусть', color: '#4f86c9',
    words: ['горечь', 'тоска', 'скорбь', 'лень', 'жалость', 'отрешённость', 'отчаяние', 'беспомощность', 'душевная боль', 'безнадёжность', 'отчуждённость', 'разочарование', 'потрясение', 'сожаление', 'скука', 'безысходность', 'печаль', 'загнанность'],
    states: ['тупик', 'усталость', 'принуждение', 'одиночество', 'отверженность', 'подавленность', 'холодность', 'безучастность', 'равнодушие'] },
  { id: 'joy', name: 'Радость', color: '#d9a21b',
    words: ['счастье', 'восторг', 'ликование', 'приподнятость', 'оживление', 'умиротворение', 'увлечение', 'интерес', 'забота', 'ожидание', 'возбуждение', 'предвкушение', 'надежда', 'любопытство', 'освобождение', 'принятие', 'нетерпение', 'вера', 'изумление'],
    states: ['удовлетворение', 'уверенность', 'довольство', 'окрылённость', 'торжественность', 'жизнерадостность', 'облегчение', 'ободрённость'] },
  { id: 'love', name: 'Любовь', color: '#d9578f',
    words: ['нежность', 'теплота', 'сочувствие', 'блаженство', 'доверие', 'безопасность', 'благодарность', 'спокойствие', 'симпатия', 'идентичность', 'гордость', 'восхищение', 'уважение', 'самоценность', 'влюблённость', 'любовь к себе', 'очарованность', 'смирение', 'искренность', 'дружелюбие', 'доброта', 'взаимовыручка'],
    states: ['сопереживание', 'сопричастность', 'уравновешенность', 'естественность', 'жизнелюбие', 'вдохновение', 'воодушевление'] },
];

export const colorOf = w => (CLUSTERS.find(c => c.words.includes(w) || c.states.includes(w)) || {}).color || '#888';

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
      const states = c.states.filter(w => !q || w.includes(q));
      if (!words.length && !states.length) return null;
      const mk = w => chip(w, { selected: selected.has(w), on: e => { onToggle(w); e.currentTarget.classList.toggle('on', selected.has(w)); } });
      return h('section', { class: 'cluster', style: { '--c': c.color } },
        h('h4', null, h('span', { class: 'dot' }), c.name),
        h('div', { class: 'chips' }, words.map(mk)),
        states.length && h('div', { class: 'states' }, h('small', { class: 'muted' }, 'Мысли и состояния'), h('div', { class: 'chips' }, states.map(mk))));
    }).filter(Boolean));
  }
  render();
  return h('div', { class: 'feelings' }, search, list);
}

// Модальное окно справочника. onDone(массив слов)
export function openFeelings({ selected = [], onDone, title = 'Таблица чувств' } = {}) {
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

export const TOTAL = new Set(CLUSTERS.flatMap(c => [...c.words, ...c.states])).size;

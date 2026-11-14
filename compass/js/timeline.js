// Линия времени: от текущего возраста назад с шагом 5 лет до раннего детства (3–5 лет)
import { h } from './ui.js';

export function computeStops(age) {
  age = Math.round(+age);
  if (!(age >= 8 && age <= 110)) return [];
  const stops = [age];
  while (stops[stops.length - 1] - 5 >= 3) stops.push(stops[stops.length - 1] - 5);
  if (stops[stops.length - 1] > 5) stops.push(4);
  return stops; // по убыванию: 34, 29, 24, 19, 14, 9, 4
}

// stops — по убыванию; current — возраст, который сейчас подсвечен; passed — уже пройденные
export function timelineView(stops, { current = null, passed = [], dir = 'down' } = {}) {
  const asc = [...stops].reverse();
  return h('div', { class: 'timeline' },
    h('div', { class: 'tl-axis' }, asc.map(a => h('div', {
      class: 'tl-stop' + (a === current ? ' cur' : '') + (passed.includes(a) ? ' done' : ''),
    }, h('span', { class: 'tl-dot' }), h('span', { class: 'tl-age' }, a)))),
    h('div', { class: 'tl-legend muted small' },
      h('span', null, '← детство'),
      h('span', null, dir === 'down' ? 'движемся вглубь ←' : 'возвращаемся →'),
      h('span', null, 'сейчас →')));
}

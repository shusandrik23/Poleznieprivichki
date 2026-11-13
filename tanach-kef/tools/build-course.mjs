#!/usr/bin/env node
// Builds content/course.json from content-src/*.json, pulling verse text from the
// Westminster Leningrad Codex (OpenScriptures "morphhb" package, public domain).
//
//   npm pack morphhb@2.0.2 && tar -xzf morphhb-2.0.2.tgz      # once, anywhere
//   node tools/build-course.mjs path/to/package/wlc
//   node tools/build-course.mjs path/to/package/wlc --show Gen.1.1 Gen.1.2   # print verses
//
// Verse text keeps nikud and drops cantillation; ketiv is replaced by qere so children read
// what is pronounced; the divine name is written ה׳.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [wlcDir, ...rest] = process.argv.slice(2);
if (!wlcDir) { console.error('usage: build-course.mjs <wlc dir> [--show refs...]'); process.exit(1); }

const BOOKS = { Gen: 'בְּרֵאשִׁית', Exod: 'שְׁמוֹת', Num: 'בְּמִדְבַּר', Deut: 'דְּבָרִים', Josh: 'יְהוֹשֻׁעַ', Judg: 'שׁוֹפְטִים',
  '1Sam': 'שְׁמוּאֵל א', '2Sam': 'שְׁמוּאֵל ב', '1Kgs': 'מְלָכִים א', '2Kgs': 'מְלָכִים ב', Jonah: 'יוֹנָה', Ruth: 'רוּת', Esth: 'אֶסְתֵּר' };

/* ---------- WLC parsing ---------- */
const bookCache = {};
const CANT = /[֑-ֽֿ֯׀׃-׆]/g;   // accents, meteg, rafe, paseq, dots
const cons = s => s.replace(/[֑-ׇ\/]/g, '').replace(/[^א-ת ]/g, '');

function loadBook(book) {
  if (bookCache[book]) return bookCache[book];
  let xml = fs.readFileSync(path.join(wlcDir, `${book}.xml`), 'utf8');
  // ketiv + qere note -> qere words
  xml = xml.replace(/<w[^>]*>[^<]*<\/w>\s*<note type="variant"><catchWord>[^<]*<\/catchWord><rdg type="x-qere">([\s\S]*?)<\/rdg><\/note>/g, '$1');
  xml = xml.replace(/<note\b[^>]*\/>/g, '').replace(/<note\b[^>]*>[\s\S]*?<\/note>/g, '');
  const verses = {};
  for (const m of xml.matchAll(/<verse osisID="([^"]+)">([\s\S]*?)<\/verse>/g)) {
    const units = [];
    for (const t of m[2].matchAll(/<w[^>]*>([^<]*)<\/w>|<seg type="x-maqqef">/g)) {
      if (t[1] === undefined) { if (units.length) units[units.length - 1].join = '־'; continue; }
      const parts = t[1].split('/').map(p => cons(p) === 'יהוה' ? 'ה׳' : p);
      const text = parts.join('').replace(CANT, '');
      units.push({ text, cons: cons(text), join: ' ' });
    }
    verses[m[1]] = units;
  }
  return (bookCache[book] = verses);
}

// "Gen.12.1" or "Gen.12.1:1-6" (1-based unit range, inclusive)
function getVerse(ref) {
  const [osis, range] = ref.split(':');
  const [book, ch, vs] = osis.split('.');
  const all = loadBook(book)[osis];
  if (!all) throw new Error(`verse not found: ${ref}`);
  let a = 1, b = all.length;
  if (range) { [a, b] = range.split('-').map(Number); b = b || a; }
  return { units: all.slice(a - 1, b).map(u => ({ ...u })), partialStart: a > 1, partialEnd: b < all.length,
           heRef: `${BOOKS[book] || book} ${gem(+ch)}, ${gem(+vs)}`, osis };
}
function gem(n) {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'], tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'], hund = ['', 'ק', 'ר', 'ש', 'ת'];
  let s = hund[Math.floor(n / 100)] || ''; n %= 100;
  if (n === 15) return s + 'טו'; if (n === 16) return s + 'טז';
  return s + tens[Math.floor(n / 10)] + ones[n % 10];
}
const unitsText = us => us.map((u, i) => u.text + (i < us.length - 1 ? u.join : '')).join('');
// find consecutive units whose consonants equal the space-separated consonant string
function findSeq(units, needle) {
  const want = needle.split(' ');
  for (let i = 0; i + want.length <= units.length; i++) {
    if (want.every((w, k) => units[i + k].cons === w && !units[i + k].mark)) return i;
  }
  return -1;
}

if (rest[0] === '--show') {
  for (const r of rest.slice(1)) {
    const v = getVerse(r);
    console.log(`${r}\t${v.units.map((u, i) => `${i + 1}:${u.text}`).join(' ')}`);
  }
  process.exit(0);
}

/* ---------- build ---------- */
const srcDir = path.join(ROOT, 'content-src');
const meta = JSON.parse(fs.readFileSync(path.join(srcDir, '_meta.json'), 'utf8'));
const files = meta.order.filter(f => fs.existsSync(path.join(srcDir, f)) || (console.warn('missing ' + f), false));
const out = { version: 3, characters: meta.characters, names: meta.names || [], books: [] };
// Russian helper layer: content-src/ru/<same file name>, keyed by ids, arrays in the same order as the Hebrew
const ruOf = f => { const p = path.join(srcDir, 'ru', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const errors = [];
const seenIds = new Set();

for (const f of files) {
  const src = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8'));
  const RU = ruOf(f);
  if (!RU) errors.push(`${f}: no Russian file content-src/ru/${f}`);
  const ruL = id => RU?.lessons?.[id];
  const book = { id: src.id, title: src.title, subtitle: src.grade, ru: RU?.books?.[src.id], stories: [] };
  for (const st of src.stories) {
    if (st.soon) { book.stories.push({ id: st.id, title: st.title, soon: true }); continue; }
    const story = { id: st.id, title: st.title, ru: RU?.stories?.[st.id], lessons: [] };
    if (RU && !story.ru) errors.push(`${st.id}: no Russian story title`);
    for (const L of st.lessons) {
      const where = `${L.id}`;
      if (seenIds.has(L.id)) errors.push(`${where}: duplicate lesson id`); seenIds.add(L.id);
      const verses = L.v.map(getVerse);
      const words = [];
      // mark lesson words (first occurrence in each verse) and glosses
      for (const [needle, modern, note] of L.w) {
        let found = null;
        for (const v of verses) {
          const i = findSeq(v.units, needle);
          if (i < 0) continue;
          const n = needle.split(' ').length;
          if (!found) found = unitsText(v.units.slice(i, i + n));
          v.units[i].mark = { start: true, n, ref: needle.replace(/ /g, '_') };
          for (let k = 1; k < n; k++) v.units[i + k].mark = { cont: true };
        }
        if (!found) { errors.push(`${where}: word "${needle}" not in ${L.v.join(', ')}`); continue; }
        words.push({ id: needle.replace(/ /g, '_'), t: found, m: modern, ...(note ? { note } : {}) });
      }
      for (const [needle, gloss] of (L.g || [])) {
        let ok = false;
        for (const v of verses) {
          const i = findSeq(v.units, needle);
          if (i < 0) continue;
          const n = needle.split(' ').length;
          v.units[i].mark = { start: true, n, ref: '=' + gloss };
          for (let k = 1; k < n; k++) v.units[i + k].mark = { cont: true };
          ok = true; break;
        }
        if (!ok) errors.push(`${where}: gloss "${needle}" not found`);
      }
      const vOut = verses.map(v => {
        let s = '';
        for (let i = 0; i < v.units.length; i++) {
          const u = v.units[i];
          if (u.mark?.start) {
            const span = v.units.slice(i, i + u.mark.n);
            const last = span[span.length - 1];
            s += `{${unitsText(span)}|${u.mark.ref}}` + (i + u.mark.n < v.units.length ? last.join : '');
            i += u.mark.n - 1;
          } else s += u.text + (i < v.units.length - 1 ? u.join : '');
        }
        return { ref: v.heRef, text: (v.partialStart ? '…' : '') + s + (v.partialEnd ? '…' : '׃') };
      });

      const tasks = [{ type: 'match' }];
      // order: given ref, or first verse (whole if short, else first 6 units)
      const oRef = L.order || (getVerse(L.v[0]).units.length <= 8 ? L.v[0] : `${L.v[0].split(':')[0]}:1-6`);
      const oUnits = getVerse(oRef).units;
      const tiles = []; let cur = '';
      oUnits.forEach((u, i) => { cur += u.text; if (u.join === ' ' || i === oUnits.length - 1) { tiles.push(cur); cur = ''; } else cur += '־'; });
      tasks.push({ type: 'order', text: tiles.join(' '), ...(L.extra ? { extra: L.extra } : {}) });
      if (L.who) {
        const [qref, ans, others] = L.who;
        const qt = qref.includes('.') ? unitsText(getVerse(qref).units) : qref;
        for (const c of [ans, ...others]) if (!meta.characters[c]) errors.push(`${where}: unknown character ${c}`);
        tasks.push({ type: 'who', quote: qt, answer: ans, options: [ans, ...others] });
      }
      for (const [kind, q, opts, explain] of (L.q || [])) {
        tasks.push({ type: 'choice', kind: kind === 'd' ? 'detective' : 'meaning', q, options: opts, answer: 0, ...(explain ? { explain } : {}) });
      }
      const R = ruL(L.id);
      if (RU && !R) errors.push(`${where}: no Russian`);
      if (R) {
        const chk = (name, a, b) => { if ((a || []).length !== (b || []).length) errors.push(`${where}: ru.${name} has ${(a || []).length}, expected ${(b || []).length}`); };
        chk('s', R.s, L.story); chk('w', R.w, L.w); chk('v', R.v, L.v); chk('q', R.q, L.q || []);
        words.forEach((w, i) => { w.ru = R.w?.[i]; });
        vOut.forEach((v, i) => { v.ru = R.v?.[i]; });
        // order / who: show the Russian translation of the verse the fragment comes from
        const osisIdx = ref => L.v.findIndex(v => v.split(':')[0] === ref.split(':')[0]);
        const oi = osisIdx(oRef);
        if (oi >= 0 && R.v?.[oi]) tasks.find(t => t.type === 'order').ru = { hint: R.v[oi] };
        else errors.push(`${where}: order verse ${oRef} is not among the lesson verses`);
        if (L.who && L.who[0].includes('.')) {
          const wi = osisIdx(L.who[0]);
          if (wi >= 0 && R.v?.[wi]) tasks.find(t => t.type === 'who').ru = { hint: R.v[wi] };
        }
        const qTasks = tasks.filter(t => t.type === 'choice');
        qTasks.forEach((t, i) => {
          const [q, opts, ex] = R.q?.[i] || [];
          if (opts && opts.length !== t.options.length) errors.push(`${where}: ru.q[${i}] options ${opts.length} vs ${t.options.length}`);
          t.ru = { q, options: opts, ...(ex ? { explain: ex } : {}) };
          if (t.explain && !ex) errors.push(`${where}: ru.q[${i}] missing explanation`);
        });
      }
      story.lessons.push({ id: L.id, title: L.title, icon: L.icon, story: L.story, words, verses: vOut, tasks,
        ...(R ? { ru: { title: R.t, story: R.s } } : {}) });
    }
    book.stories.push(story);
  }
  out.books.push(book);
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
fs.writeFileSync(path.join(ROOT, 'content', 'course.json'), JSON.stringify(out));
const n = out.books.flatMap(b => b.stories).filter(s => !s.soon);
console.log(`ok: ${out.books.length} books, ${n.length} stories, ${n.reduce((a, s) => a + s.lessons.length, 0)} lessons, ` +
  `${n.flatMap(s => s.lessons).reduce((a, l) => a + l.words.length, 0)} words`);

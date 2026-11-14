// Вкладка «Дети»: связь YouBoost с детским приложением YouBoost Kids.
// Взрослый видит прогресс детей, посылает им задачи, подтверждает дела и награды,
// принимает вызовы от детей и участвует в них своей привычкой из YouBoost.
// Данные — те же, что у YouBoost Kids (kidsFamilies/…), правила — раздел «YouBoost Kids» в firestore.rules.
import * as cloud from './cloud.js';
import { social } from './cloud.js';
import * as G from '../kids/js/logic.js';
import * as F from '../kids/js/friends.js';
import { AVATARS, COLORS, REWARDS, HABITS as KID_HABITS, CATEGORIES as KID_CATS, HABIT_EMOJI, REWARD_EMOJI, starterFor } from '../kids/js/catalog.js';
import { t, pw, lang } from './i18n.js';
import { habitKey, escapeHtml as e } from './core.js';
import { isNative, nativeShare, openExternal } from './native.js';

export const KIDS_URL = 'https://shusandrik23.github.io/Poleznieprivichki/kids/';

const fam = {
  loading: false,
  fid: null,
  family: null,
  kids: {},
  members: [],
  friendships: {},    // дружбы детей с детьми из других семей
  error: null,
  flash: {},          // ключ → { text, error }
  code: null,         // { code, title, text }
  taskFor: null,      // ребёнок с открытой формой задачи
  addKid: false,
  busy: false,
  setupKid: null,     // ребёнок с открытыми настройками (привычки, профиль, телефон)
  habitEdit: null,    // { kid, hid | null } — форма привычки
  catalogFor: null,   // ребёнок с открытым каталогом привычек
  rewardForm: false,
  chForm: false,
  confirmDelete: false,
};

let onChange = () => {};
let watchedUid;
let userUnsub = null;
let famUnsubs = [];
let ensureHabitFn = () => {};

export function initFamily({ changed, ensureHabit }) {
  onChange = changed;
  ensureHabitFn = ensureHabit;
}

const h = () => cloud.handles();
const myUid = () => social.user?.uid || null;
const myPid = () => 'p:' + myUid();
const kidsList = () => Object.values(fam.kids).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
const myName = () => fam.family?.parents?.[myUid()] || social.user?.displayName?.split(' ')[0] || t('fam.parent');

// ---------- Подписки ----------

// Вызывается при каждой отрисовке: подписка следует за вошедшим пользователем.
export function syncFamilyUser() {
  const uid = social.ready ? myUid() : undefined;
  if (uid === watchedUid) return;
  watchedUid = uid;
  stopAll();
  Object.assign(fam, { fid: null, family: null, kids: {}, members: [], error: null, code: null, loading: !!uid });
  if (!uid) return;
  const { fb, db } = h();
  userUnsub = fb.onSnapshot(fb.doc(db, 'kidsUsers', uid), { includeMetadataChanges: true }, snap => {
    // Ждём подтверждения сервера: пока семья не записана, правила не дадут её читать.
    if (snap.metadata.hasPendingWrites) return;
    const fid = snap.exists() ? snap.data().fid : null;
    if (fid !== fam.fid) {
      stopFamily();
      Object.assign(fam, { fid, family: null, kids: {}, members: [] });
      if (fid) listenFamily(fid);
    }
    fam.loading = !!fid && !fam.family;
    onChange();
  }, err => { console.error(err); fam.loading = false; fam.error = err.code || 'error'; onChange(); });
}

function listenFamily(fid) {
  const { fb, db } = h();
  const lost = err => {
    console.error(err);
    if (err.code === 'permission-denied') { stopFamily(); Object.assign(fam, { fid: null, family: null, kids: {}, members: [], loading: false }); }
    onChange();
  };
  famUnsubs.push(fb.onSnapshot(fb.doc(db, 'kidsFamilies', fid), snap => {
    if (!snap.exists()) { stopFamily(); Object.assign(fam, { fid: null, family: null, kids: {}, loading: false }); onChange(); return; }
    fam.family = snap.data();
    fam.loading = false;
    onChange();
  }, lost));
  famUnsubs.push(fb.onSnapshot(fb.collection(db, 'kidsFamilies', fid, 'kids'), snap => {
    const kids = {};
    snap.forEach(d => { kids[d.id] = { ...d.data(), id: d.id }; });
    fam.kids = kids;
    onChange();
  }, lost));
  famUnsubs.push(F.listenFriendships({ fb, db }, fid, map => { fam.friendships = map; onChange(); }, err => console.error(err)));
  famUnsubs.push(fb.onSnapshot(fb.collection(db, 'kidsFamilies', fid, 'members'), snap => {
    fam.members = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    if (!snap.docs.some(d => d.id === myUid())) { stopFamily(); Object.assign(fam, { fid: null, family: null, kids: {}, members: [] }); }
    onChange();
  }, lost));
}

function stopFamily() { famUnsubs.forEach(u => u()); famUnsubs = []; }
function stopAll() { stopFamily(); if (userUnsub) userUnsub(); userUnsub = null; }

// ---------- Счётчик для вкладки ----------

export function familyBadge() {
  if (!fam.fid) return 0;
  return kidsList().reduce((n, k) => n + G.pendingList(k).length
    + (k.requests || []).filter(r => G.requestStatus(k, r) === 'pending').length
    + G.pendingProposals(k, myPid()).length, 0)
    + Object.values(fam.friendships).filter(fr => F.needsApproval(fr, fam.fid)).length;
}

// ---------- Запись ----------

function updateKid(id, patch) {
  const { fb, db } = h();
  fam.kids[id] = { ...fam.kids[id], ...patch };
  onChange();
  return fb.updateDoc(fb.doc(db, 'kidsFamilies', fam.fid, 'kids', id), patch);
}
function updateFamily(patch) {
  const { fb, db } = h();
  fam.family = { ...fam.family, ...patch };
  onChange();
  return fb.updateDoc(fb.doc(db, 'kidsFamilies', fam.fid), patch);
}

async function createFamily() {
  const { fb, db } = h();
  const uid = myUid();
  const fid = fb.doc(fb.collection(db, 'kidsFamilies')).id;
  const batch = fb.writeBatch(db);
  batch.set(fb.doc(db, 'kidsFamilies', fid), {
    name: '', owner: uid, parents: { [uid]: social.user.displayName?.split(' ')[0] || '' }, challenges: [],
    rewards: REWARDS.slice(0, 4).map(r => ({ id: G.newId(), name: r[lang] || r.en, emoji: r.emoji, cost: r.cost })),
    createdAt: new Date().toISOString(),
  });
  batch.set(fb.doc(db, 'kidsFamilies', fid, 'members', uid), { role: 'parent', name: social.user.displayName || '' });
  batch.set(fb.doc(db, 'kidsUsers', uid), { fid });
  await batch.commit();
  fam.addKid = true;
}

async function joinFamily(raw) {
  const { fb, db } = h();
  const code = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const snap = code.length === 6 ? await fb.getDoc(fb.doc(db, 'kidsCodes', code)).catch(() => null) : null;
  if (!snap || !snap.exists()) throw new Error(t('fam.badCode'));
  const c = snap.data();
  if ((c.expires?.toMillis?.() || 0) < Date.now()) throw new Error(t('fam.expiredCode'));
  if (c.role !== 'parent') throw new Error(t('fam.childCode'));
  const uid = myUid();
  await fb.setDoc(fb.doc(db, 'kidsFamilies', c.fid, 'members', uid), { role: 'parent', code, name: social.user.displayName || '' });
  await fb.setDoc(fb.doc(db, 'kidsUsers', uid), { fid: c.fid });
  await fb.updateDoc(fb.doc(db, 'kidsFamilies', c.fid), { [`parents.${uid}`]: social.user.displayName?.split(' ')[0] || '' });
}

async function addKid(name, age) {
  const { fb, db } = h();
  const id = G.newId();
  const n = kidsList().length;
  const habits = starterFor(age).map(code => {
    const c = KID_HABITS.find(x => x.code === code);
    return { id: G.newId(), code, name: c[lang] || c.en, emoji: c.emoji, stars: c.stars, days: c.days ? [...c.days] : [], approval: !!c.approval, since: G.today() };
  });
  await fb.setDoc(fb.doc(db, 'kidsFamilies', fam.fid, 'kids', id), {
    name, age, avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], color: COLORS[n % COLORS.length],
    habits, marks: {}, approved: {}, requests: [], decisions: {}, bonus: [], chMarks: {}, pet: null,
    order: n, createdAt: new Date().toISOString(),
  });
  return id;
}

async function createCode(role, kidId = null) {
  const { fb, db } = h();
  const code = G.makeCode(6);
  await fb.setDoc(fb.doc(db, 'kidsCodes', code), {
    fid: fam.fid, role, kidId, by: myUid(), expires: fb.Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000),
  });
  return code;
}

async function sendTask(kidId, d) {
  const k = fam.kids[kidId];
  const today = G.today();
  const task = {
    id: G.newId(), name: d.name, emoji: d.emoji || '📬', stars: d.stars, days: [], approval: d.approval,
    from: myName(), since: today,
  };
  if (d.when === 'today') task.once = today;
  else if (d.when === 'tomorrow') task.once = G.addDays(today, 1);
  await updateKid(kidId, { habits: G.dropOldTasks([...(k.habits || []), task]) });
}

// Отметка привычки во взрослом YouBoost засчитывается в семейном вызове с такой же привычкой.
export function onHabitToggled(name, day, done) {
  if (!fam.fid || !fam.family) return;
  const pid = myPid();
  const key = habitKey(name);
  let changed = false;
  const list = (fam.family.challenges || []).map(ch => {
    if (!ch.participants?.includes(pid) || habitKey(ch.name) !== key) return ch;
    if (day < ch.start || day > G.challengeEnd(ch)) return ch;
    const m = { ...(ch.marks?.[pid] || {}) };
    if (!!m[day] === done) return ch;
    if (done) m[day] = true; else delete m[day];
    changed = true;
    return { ...ch, marks: { ...(ch.marks || {}), [pid]: m } };
  });
  if (changed) updateFamily({ challenges: list }).catch(err => console.error(err));
}

// ---------- Отрисовка ----------

function flashHtml(key) {
  const f = fam.flash[key];
  return f ? `<p class="flash${f.error ? ' error' : ''}">${e(f.text)}</p>` : '';
}

const pName = pid => {
  if (pid.startsWith('k:')) { const k = fam.kids[pid.slice(2)]; return k ? `${k.avatar} ${k.name}` : '—'; }
  return pid === myPid() ? t('fam.you') : '👤 ' + G.parentName(fam.family, pid.slice(2), t('fam.parent'));
};

function statusIcon(st) { return st === 'done' ? '✅' : st === 'pending' ? '⏳' : st === 'rejected' ? '✖️' : '⚪'; }

function kidCard(k) {
  const day = G.today();
  const list = G.todayList(k, day);
  const done = list.filter(x => G.isDone(k, x, day)).length;
  const xp = G.lifetimeStars(k, fam.family);
  const lvl = G.petLevel(xp).level;
  const pet = k.pet ? `${lvl === 0 ? '🥚' : G.petById(k.pet.type).emoji} ${e(k.pet.name)}${lvl ? ` · ${t('fam.level', { n: lvl })}` : ''}` : '';
  const best = (k.habits || []).reduce((m, x) => Math.max(m, G.streak(k, x)), 0);
  const pending = G.pendingList(k);
  const requests = (k.requests || []).filter(r => G.requestStatus(k, r) === 'pending');
  const proposals = G.pendingProposals(k, myPid());
  const devices = fam.members.filter(m => m.role === 'child' && m.kidId === k.id).length;

  let html = `<div class="card fam-kid" style="border-left: 5px solid ${k.color}">
    <div class="row-between"><div class="row"><span class="fam-avatar" style="background:${k.color}">${e(k.avatar)}</span>
      <div><b class="fam-name">${e(k.name)}</b><div class="small">${pet}${pet && best > 1 ? ' · ' : ''}${best > 1 ? `🔥 ${best}` : ''}</div></div></div>
      <span class="fam-stars">⭐ ${G.balance(k, fam.family)}</span></div>
    <div class="small fam-today">${list.length ? t('fam.today', { done, total: list.length }) : t('fam.nothingToday')}</div>
    ${list.length ? `<div class="bar"><div class="fill" style="width:${Math.round(done / list.length * 100)}%"></div></div>
      <div class="fam-tasks">${list.map(x => `<span class="fam-task" title="${e(x.name)}">${statusIcon(G.status(k, x.id, day, x))} ${e(x.emoji)} ${e(x.name)}${x.from ? ' 📬' : ''}</span>`).join('')}</div>` : ''}`;

  if (proposals.length) {
    html += proposals.map(p => `<div class="fam-alert">⚔️ ${t('fam.proposal', { name: e(k.name) })}: <b>${e(p.emoji)} ${e(p.name)}</b> · ${p.days} ${pw(p.days, 'day')}
      <div class="row"><button class="btn primary small-btn" data-fam="proposal" data-kid="${k.id}" data-id="${p.id}" data-v="accepted">💪 ${t('fam.accept')}</button>
      <button class="btn small-btn" data-fam="proposal" data-kid="${k.id}" data-id="${p.id}" data-v="declined">${t('fam.notNow')}</button></div></div>`).join('');
  }
  if (pending.length) {
    html += `<div class="fam-sub">${t('fam.approvals')}</div>` + pending.map(a => `<div class="row-between fam-line">
      <span>${e(a.habit.emoji)} ${e(a.habit.name)} <span class="small">· ${a.day === day ? t('fam.todayWord') : a.day === G.addDays(day, -1) ? t('fam.yesterday') : a.day} · ⭐${a.stars}</span></span>
      <span class="row"><button class="btn primary small-btn" data-fam="approve" data-kid="${k.id}" data-hid="${a.habit.id}" data-day="${a.day}" data-v="1">✓</button>
      <button class="btn small-btn" data-fam="approve" data-kid="${k.id}" data-hid="${a.habit.id}" data-day="${a.day}" data-v="0">✕</button></span></div>`).join('');
  }
  if (requests.length) {
    html += `<div class="fam-sub">${t('fam.requests')}</div>` + requests.map(r => `<div class="row-between fam-line">
      <span>${e(r.emoji)} ${e(r.name)} <span class="small">· ⭐${r.cost}</span></span>
      <span class="row"><button class="btn primary small-btn" data-fam="decide" data-kid="${k.id}" data-id="${r.id}" data-v="given">🎁 ${t('fam.give')}</button>
      <button class="btn small-btn" data-fam="decide" data-kid="${k.id}" data-id="${r.id}" data-v="rejected">✕</button></span></div>`).join('');
  }

  const frs = Object.values(fam.friendships).filter(fr => F.involves(fr, k.id) && !F.isDeclined(fr));
  const frAsk = frs.filter(fr => F.needsApproval(fr, fam.fid));
  if (frAsk.length) {
    html += `<div class="fam-sub">${t('fam.friendAsk')}</div>` + frAsk.map(fr => { const o = F.other(fr, k.id); return `<div class="row-between fam-line">
      <span>${e(o.card.avatar)} ${e(o.card.name)}${o.card.pet ? ` <span class="small">· ${e(o.card.pet.emoji)} ${e(o.card.pet.name)}</span>` : ''}</span>
      <span class="row"><button class="btn primary small-btn" data-fam="fr-approve" data-pair="${fr.id}" data-v="1">✓ ${t('fam.allow')}</button>
      <button class="btn small-btn" data-fam="fr-approve" data-pair="${fr.id}" data-v="0">✕</button></span></div>`; }).join('');
  }
  const frOk = frs.filter(F.isActive);
  if (frOk.length) {
    html += `<div class="fam-sub">${t('fam.friends')}</div><div class="fam-tasks">${frOk.map(fr => { const o = F.other(fr, k.id); return `<span class="fam-task">${e(o.card.avatar)} ${e(o.card.name)}${fr.via === 'contact' ? ' 📇' : ''} <button class="link-btn" data-fam="fr-remove" data-pair="${fr.id}" title="${t('fam.removeFriend')}">✕</button></span>`; }).join('')}</div>`;
  }

  html += `<div class="row fam-actions">
      <button class="btn small-btn ${fam.taskFor === k.id ? 'primary' : ''}" data-fam="task-toggle" data-kid="${k.id}">📬 ${t('fam.sendTask')}</button>
      <button class="btn small-btn" data-fam="praise" data-kid="${k.id}">👏 ${t('fam.praise')}</button>
      <button class="btn small-btn" data-fam="kid-code" data-kid="${k.id}">📲 ${devices ? t('fam.phoneLinked') : t('fam.inviteKid')}</button>
      <button class="btn small-btn ${fam.setupKid === k.id ? 'primary' : ''}" data-fam="setup-toggle" data-kid="${k.id}">⚙️ ${t('fam.setup')}</button>
    </div>`;
  if (fam.taskFor === k.id) {
    html += `<form class="stack fam-form" data-form="famTask" data-id="${k.id}">
      <input name="name" maxlength="40" placeholder="${t('fam.taskPh')}" required autocomplete="off">
      <div class="row">
        <select name="when"><option value="today">${t('fam.whenToday')}</option><option value="tomorrow">${t('fam.whenTomorrow')}</option><option value="daily">${t('fam.whenDaily')}</option></select>
        <select name="stars"><option value="1">⭐ 1</option><option value="2" selected>⭐ 2</option><option value="3">⭐ 3</option><option value="5">⭐ 5</option></select>
        <select name="emoji">${['📬', '🧹', '📚', '🍽️', '🛒', '🐕', '🪴', '🎹', '⚽', '📖', '🧺', '💌'].map(x => `<option>${x}</option>`).join('')}</select>
      </div>
      <label class="row small"><input type="checkbox" name="approval"> ${t('fam.needApproval')}</label>
      <button class="btn primary" type="submit">${t('fam.send')}</button>
      ${flashHtml('task' + k.id)}
    </form>`;
  }
  if (fam.code?.kid === k.id) html += codeBox();
  if (fam.setupKid === k.id) html += kidSetup(k);
  return html + '</div>';
}

// ---------- Настройки ребёнка: профиль, привычки, история, бонус, телефон ----------
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const dayName = n => t('fam.days').split(',')[n];
function daysText(days) {
  if (!days || !days.length || days.length === 7) return t('fam.everyDay');
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return t('fam.weekdays');
  return DAY_ORDER.filter(d => days.includes(d)).map(dayName).join(', ');
}
const opts = (list, sel) => list.map(([v, label]) => `<option value="${e(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${e(label)}</option>`).join('');

function habitForm(k, h) {
  const d = h || { name: '', emoji: '⭐', stars: 1, days: [], approval: false };
  const all = !d.days || !d.days.length;
  return `<form class="stack fam-form" data-form="famHabit" data-id="${k.id}" data-hid="${h ? h.id : ''}">
    <input name="name" maxlength="40" value="${e(d.name)}" placeholder="${t('fam.habitPh')}" required autocomplete="off">
    <div class="row">
      <select name="emoji">${opts(HABIT_EMOJI.map(x => [x, x]), d.emoji)}</select>
      <select name="stars">${opts([[1, '⭐ 1'], [2, '⭐ 2'], [3, '⭐ 3'], [5, '⭐ 5']], d.stars)}</select>
    </div>
    <div class="fam-days">${DAY_ORDER.map(n => `<label><input type="checkbox" name="day${n}" ${all || d.days.includes(n) ? 'checked' : ''}> ${dayName(n)}</label>`).join('')}</div>
    <label class="row small"><input type="checkbox" name="approval" ${d.approval ? 'checked' : ''}> ${t('fam.needApproval')}</label>
    <div class="row"><button class="btn primary" type="submit">${t('fam.save')}</button><button class="btn" type="button" data-fam="habit-cancel">${t('fam.cancel')}</button></div>
  </form>`;
}

function kidSetup(k) {
  const habits = k.habits || [];
  const days = [...Array(7)].map((_, i) => G.addDays(G.today(), i - 6));
  const have = new Set(habits.map(h => h.code).filter(Boolean));
  const devices = fam.members.filter(m => m.role === 'child' && m.kidId === k.id);
  let html = `<div class="fam-setup">
    <div class="fam-sub">${t('fam.profile')}</div>
    <form class="row" data-form="famKidEdit" data-id="${k.id}">
      <input name="name" maxlength="24" value="${e(k.name)}" required autocomplete="off">
      <select name="age">${opts([5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(a => [a, a]), k.age || 8)}</select>
      <select name="avatar">${opts(AVATARS.map(a => [a, a]), k.avatar)}</select>
      <select name="color">${opts(COLORS.map((c, i) => [c, ['🟠', '🟣', '🟢', '🩷', '🔵', '🟡', '🩵', '🔴'][i] || '⚪']), k.color)}</select>
      <button class="btn small-btn" type="submit">${t('fam.save')}</button>
    </form>${flashHtml('kidEdit' + k.id)}

    <div class="fam-sub">${t('fam.habits')}</div>
    ${habits.map(h => fam.habitEdit?.kid === k.id && fam.habitEdit.hid === h.id ? habitForm(k, h) : `<div class="row-between fam-line">
      <span>${e(h.emoji)} ${e(h.name)} <span class="small">· ${'⭐'.repeat(Math.min(h.stars, 3))} · ${h.once ? (h.once === G.today() ? t('fam.todayWord') : h.once) : daysText(h.days)}${h.approval ? ' · 👀' : ''}${h.from ? ' · 📬' : ''}</span></span>
      <span class="row"><button class="btn small-btn" data-fam="habit-edit" data-kid="${k.id}" data-hid="${h.id}">✏️</button>
      <button class="btn small-btn" data-fam="habit-del" data-kid="${k.id}" data-hid="${h.id}">✕</button></span></div>`).join('') || `<p class="small">${t('fam.noHabits')}</p>`}
    ${fam.habitEdit?.kid === k.id && !fam.habitEdit.hid ? habitForm(k, null) : ''}
    <div class="row fam-actions"><button class="btn small-btn" data-fam="habit-new" data-kid="${k.id}">✏️ ${t('fam.customHabit')}</button>
      <button class="btn small-btn ${fam.catalogFor === k.id ? 'primary' : ''}" data-fam="catalog-toggle" data-kid="${k.id}">📋 ${t('fam.catalog')}</button></div>
    ${fam.catalogFor === k.id ? `<div class="fam-form">${KID_CATS.map(c => `<div class="small" style="margin-top:6px">${c.emoji} ${e(c.name[lang] || c.name.en)}</div><div class="chips">${KID_HABITS.filter(h => h.cat === c.id).map(h => `<button class="chip ${have.has(h.code) ? 'added' : ''}" data-fam="habit-add" data-kid="${k.id}" data-code="${h.code}" ${have.has(h.code) ? 'disabled' : ''}>${h.emoji} ${e(h[lang] || h.en)}</button>`).join('')}</div>`).join('')}</div>` : ''}

    ${habits.length ? `<div class="fam-sub">${t('fam.history')}</div>
    <div class="fam-grid"><span></span>${days.map(d => `<span class="small">${dayName(G.weekday(d))}<br>${d.slice(8)}</span>`).join('')}
      ${habits.filter(h => !h.once).map(h => `<span>${e(h.emoji)}</span>${days.map(d => {
        if (!G.scheduledOn(h, d)) return '<span class="fam-cell off"></span>';
        const st = G.status(k, h.id, d, h);
        return `<button class="fam-cell ${st}" data-fam="mark" data-kid="${k.id}" data-hid="${h.id}" data-day="${d}">${st === 'done' ? '✓' : st === 'pending' ? '⏳' : st === 'rejected' ? '✕' : ''}</button>`;
      }).join('')}`).join('')}</div><p class="small">${t('fam.markHint')}</p>` : ''}

    <div class="fam-sub">${t('fam.bonus')}</div>
    <form class="row" data-form="famBonus" data-id="${k.id}">
      <select name="stars">${opts([[1, '⭐ 1'], [3, '⭐ 3'], [5, '⭐ 5'], [10, '⭐ 10']], 3)}</select>
      <input name="reason" maxlength="60" placeholder="${t('fam.bonusPh')}" autocomplete="off">
      <button class="btn small-btn" type="submit">${t('fam.give')}</button>
    </form>${flashHtml('bonus' + k.id)}

    <div class="fam-sub">${t('fam.phone')}</div>
    ${devices.map(m => `<div class="row-between fam-line"><span>📱 ${e(m.name || t('fam.device'))}</span><button class="btn small-btn" data-fam="unlink" data-uid="${m.uid}">${t('fam.unlink')}</button></div>`).join('') || `<p class="small">${t('fam.noPhone')}</p>`}

    <button class="link-btn danger" data-fam="kid-del" data-kid="${k.id}">${t('fam.removeKid')}</button>
  </div>`;
  return html;
}

// ---------- Награды ----------
function rewardsHtml() {
  const rewards = fam.family?.rewards || [];
  const names = new Set(rewards.map(r => r.name));
  const history = kidsList().flatMap(k => (k.requests || []).map(r => ({ r, k }))).sort((a, b) => String(b.r.at).localeCompare(String(a.r.at))).slice(0, 8);
  return `<h2 class="section">${t('fam.rewards')}</h2><div class="card stack">
    <p class="small">${t('fam.rewardsText')}</p>
    ${rewards.map(r => `<div class="row-between fam-line"><span>${e(r.emoji)} ${e(r.name)}</span><span class="row"><span class="fam-stars">⭐ ${r.cost}</span><button class="btn small-btn" data-fam="reward-del" data-id="${r.id}">✕</button></span></div>`).join('') || `<p class="small">${t('fam.noRewards')}</p>`}
    ${fam.rewardForm ? `<form class="row fam-form" data-form="famReward">
        <select name="emoji">${opts(REWARD_EMOJI.map(x => [x, x]), '🎁')}</select>
        <input name="name" maxlength="40" placeholder="${t('fam.rewardPh')}" required autocomplete="off">
        <input name="cost" type="number" min="1" max="9999" value="10" style="width:80px">
        <button class="btn primary small-btn" type="submit">${t('fam.add')}</button></form>`
      : `<button class="btn" data-fam="reward-new">＋ ${t('fam.addReward')}</button>`}
    <div class="chips">${REWARDS.filter(r => !names.has(r[lang] || r.en)).map(r => `<button class="chip" data-fam="reward-idea" data-i="${REWARDS.indexOf(r)}">${r.emoji} ${e(r[lang] || r.en)} · ⭐${r.cost}</button>`).join('')}</div>
    ${history.length ? `<div class="fam-sub">${t('fam.rewardHistory')}</div>${history.map(({ r, k }) => {
      const st = G.requestStatus(k, r);
      return `<div class="row-between fam-line small"><span>${e(k.avatar)} ${e(k.name)} · ${e(r.emoji)} ${e(r.name)} · ⭐${r.cost}</span><span>${t('fam.req_' + st)}</span></div>`;
    }).join('')}` : ''}
  </div>`;
}

// ---------- Новый семейный вызов ----------
function challengeForm() {
  const people = [...kidsList().map(k => ['k:' + k.id, `${k.avatar} ${k.name}`]),
    ...Object.entries(fam.family?.parents || {}).map(([uid, n]) => ['p:' + uid, uid === myUid() ? t('fam.you') : '👤 ' + (n || t('fam.parent'))])];
  return `<form class="stack fam-form" data-form="famChallenge">
    <input name="name" maxlength="40" placeholder="${t('fam.chPh')}" required autocomplete="off">
    <div class="row">
      <select name="emoji">${opts(HABIT_EMOJI.slice(0, 24).map(x => [x, x]), '📖')}</select>
      <select name="days">${opts([3, 7, 14, 21, 30].map(n => [n, `${n} ${pw(n, 'day')}`]), 7)}</select>
      <select name="bonus">${opts([5, 10, 20, 30].map(n => [n, `⭐ ${n}`]), 10)}</select>
      <select name="start">${opts([[0, t('fam.startToday')], [1, t('fam.startTomorrow')]], 1)}</select>
    </div>
    <div class="fam-days">${people.map(([pid, name]) => `<label><input type="checkbox" name="p_${pid}" checked> ${e(name)}</label>`).join('')}</div>
    <button class="btn primary" type="submit">${t('fam.chStart')} 🏁</button>${flashHtml('ch')}
  </form>`;
}

function codeBox() {
  return `<div class="fam-code"><div class="small">${e(fam.code.text)}</div><div class="fam-code-num">${e(fam.code.code)}</div>
    <div class="row" style="justify-content:center">
      ${fam.code.share ? `<button class="btn primary small-btn" data-fam="share-code">📤 ${t('fam.share')}</button><button class="btn small-btn" data-fam="wa-code">WhatsApp</button>` : ''}
      <button class="btn small-btn" data-fam="copy-code">${t('fam.copy')}</button></div></div>`;
}

function challengesHtml() {
  const pid = myPid();
  const list = (fam.family?.challenges || []).filter(ch => G.challengeState(ch) !== 'finished' || G.challengeEnd(ch) >= G.addDays(G.today(), -7));
  const today = G.today();
  const head = `<h2 class="section">${t('fam.challenges')}</h2>
    ${fam.chForm ? challengeForm() : `<button class="btn" data-fam="ch-new" ${kidsList().length ? '' : 'disabled'}>＋ ${t('fam.chNew')}</button>`}`;
  return head + list.map(ch => {
    const st = G.challengeState(ch);
    const board = G.challengeBoard(ch, fam.kids);
    const winners = st === 'finished' ? G.challengeWinners(ch, fam.kids) : [];
    const mine = ch.marks?.[pid] || {};
    const dayN = Math.min(ch.days, G.dayNumber(today) - G.dayNumber(ch.start) + 1);
    return `<div class="card">
      <div class="row-between"><b>${e(ch.emoji)} ${e(ch.name)}</b><span class="small">${st === 'active' ? t('fam.dayOf', { n: dayN, total: ch.days }) : st === 'upcoming' ? t('fam.startsOn', { date: ch.start === G.addDays(today, 1) ? t('fam.tomorrow') : ch.start }) : t('fam.finished')}</span></div>
      ${ch.fromKid && fam.kids[ch.fromKid] ? `<div class="small">${t('fam.fromKid', { name: e(fam.kids[ch.fromKid].name) })}</div>` : ''}
      ${board.map(r => `<div class="prow ${winners.includes(r.pid) ? 'win' : ''}"><div class="row-between"><span>${winners.includes(r.pid) ? '🥇 ' : ''}${e(pName(r.pid))}</span><b>${r.count}/${ch.days}</b></div>
        <div class="bar"><div class="fill" style="width:${Math.round(r.count / ch.days * 100)}%"></div></div></div>`).join('')}
      ${st === 'active' && ch.participants?.includes(pid) ? `<button class="btn ${mine[today] ? '' : 'primary'}" data-fam="ch-mark" data-id="${ch.id}" style="margin-top:10px">${mine[today] ? '✓ ' + t('fam.doneToday') : t('fam.markToday')}</button>
        <p class="small">${t('fam.syncHint')}</p>` : ''}
      <button class="link-btn danger" data-fam="ch-del" data-id="${ch.id}">${t('fam.chDelete')}</button>
    </div>`;
  }).join('');
}

export function familyView() {
  if (fam.error && !fam.fid) return `<div class="card center"><p>${t('err.generic')}</p></div>`;
  if (fam.loading) return `<div class="card center"><p class="small">${t('gate.connecting')}</p></div>`;
  const kidsLink = `<a class="btn" href="${KIDS_URL}" target="_blank" rel="noopener" data-fam="open-kids">⭐ ${t('fam.openKids')}</a>`;
  if (!fam.fid) {
    return `<div class="card center fam-intro">
        <div class="fam-hero">👨‍👩‍👧‍👦</div>
        <h2>${t('fam.introTitle')}</h2>
        <p>${t('fam.introText')}</p>
        <ul class="fam-list"><li>${t('fam.intro1')}</li><li>${t('fam.intro2')}</li><li>${t('fam.intro3')}</li><li>${t('fam.intro4')}</li></ul>
        <button class="btn primary" data-fam="create" ${fam.busy ? 'disabled' : ''}>${t('fam.create')}</button>
        ${flashHtml('create')}
      </div>
      <div class="card"><h2>${t('fam.haveCode')}</h2><p class="small">${t('fam.haveCodeText')}</p>
        <form class="row" data-form="famJoin"><input name="code" maxlength="8" placeholder="K7M2QX" autocomplete="off" autocapitalize="characters" required>
        <button class="btn primary" type="submit">${t('fam.join')}</button></form>${flashHtml('join')}</div>
      <p class="center">${kidsLink}</p>`;
  }
  const kids = kidsList();
  let html = kids.length ? kids.map(kidCard).join('') : `<div class="card center"><p>${t('fam.noKids')}</p></div>`;
  html += challengesHtml();
  html += rewardsHtml();
  const owner = fam.family?.owner === myUid();
  html += `<h2 class="section">${t('fam.family')}</h2><div class="card stack">
    <form class="row" data-form="famFamName"><span class="small">${t('fam.familyName')}</span>
      <input name="fname" maxlength="30" value="${e(fam.family?.name || '')}" placeholder="${t('fam.familyNamePh')}">
      <button class="btn small-btn" type="submit">${t('fam.save')}</button></form>
    ${fam.addKid || !kids.length ? `<form class="row" data-form="famKid"><input name="name" maxlength="24" placeholder="${t('fam.kidNamePh')}" required autocomplete="off">
      <select name="age">${[5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(a => `<option ${a === 8 ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <button class="btn primary" type="submit">${t('fam.addKid')}</button></form>${flashHtml('kid')}`
      : `<button class="btn" data-fam="add-kid">＋ ${t('fam.addKidBtn')}</button>`}
    <form class="row" data-form="famName"><span class="small">${t('fam.callMe')}</span>
      <input name="label" maxlength="20" value="${e(fam.family?.parents?.[myUid()] || '')}" placeholder="${t('fam.callMePh')}">
      <button class="btn small-btn" type="submit">${t('fam.save')}</button></form>${flashHtml('name')}
    <div class="small">${t('fam.parents')}:</div>
    ${Object.entries(fam.family?.parents || {}).map(([uid, n]) => `<div class="row-between fam-line"><span>${uid === myUid() ? t('fam.you') : '👤 ' + e(n || t('fam.parent'))}${uid === fam.family.owner ? ' ⭐' : ''}</span>${owner && uid !== myUid() ? `<button class="btn small-btn" data-fam="unlink" data-uid="${uid}">${t('fam.unlink')}</button>` : ''}</div>`).join('')}
    <button class="btn" data-fam="parent-code">👤 ${t('fam.inviteParent')}</button>
    ${fam.code?.kid === 'parent' ? codeBox() : ''}
    ${kidsLink}
    ${fam.confirmDelete ? `<div class="fam-alert">${owner ? t('fam.deleteConfirm') : t('fam.leaveConfirm')}
        <div class="row"><button class="btn small-btn" data-fam="${owner ? 'family-del' : 'family-leave'}" style="color:var(--danger)">${owner ? t('fam.deleteYes') : t('fam.leaveYes')}</button>
        <button class="btn small-btn" data-fam="del-cancel">${t('fam.cancel')}</button></div></div>`
      : `<button class="link-btn danger" data-fam="del-ask">${owner ? t('fam.deleteFamily') : t('fam.leaveFamily')}</button>`}
    ${flashHtml('family')}
  </div>`;
  return html;
}

// ---------- Действия ----------

async function act(key, fn) {
  fam.busy = true; fam.flash[key] = null; onChange();
  try { await fn(); } catch (err) { console.error(err); fam.flash[key] = { text: err.message && !err.code ? err.message : t('err.generic'), error: true }; }
  fam.busy = false; onChange();
}

export function familyClick(el) {
  const d = el.dataset;
  const k = d.kid ? fam.kids[d.kid] : null;
  switch (d.fam) {
    case 'create': return act('create', createFamily);
    case 'add-kid': fam.addKid = true; return onChange();
    case 'task-toggle': fam.taskFor = fam.taskFor === d.kid ? null : d.kid; return onChange();
    case 'approve': {
      const approved = { ...(k.approved || {}) };
      approved[d.day] = { ...(approved[d.day] || {}), [d.hid]: d.v === '1' };
      return updateKid(k.id, { approved }).catch(console.error);
    }
    case 'decide': return updateKid(k.id, { decisions: { ...(k.decisions || {}), [d.id]: d.v } }).catch(console.error);
    case 'praise':
      return updateKid(k.id, { bonus: [...(k.bonus || []), { id: G.newId(), stars: 2, reason: t('fam.praiseReason', { name: myName() }), at: new Date().toISOString() }] }).catch(console.error);
    case 'proposal': {
      const p = (k.proposals || []).find(x => x.id === d.id);
      if (!p) return;
      return act('proposal', async () => {
        await updateKid(k.id, { proposalAnswers: { ...(k.proposalAnswers || {}), [p.id]: d.v } });
        if (d.v === 'accepted') {
          await updateFamily({ challenges: [...(fam.family.challenges || []), G.challengeFromProposal(k, p)] });
          ensureHabitFn(p.name);   // привычка появится в «Моих привычках» — её отметка засчитается в вызове
        }
      });
    }
    case 'kid-code':
      return act('code', async () => {
        const code = await createCode('child', k.id);
        fam.code = { kid: k.id, code, text: t('fam.kidCodeText', { name: k.name }), share: t('fam.kidInviteMsg', { name: k.name, url: `${KIDS_URL}?join=${code}`, code }) };
      });
    case 'parent-code':
      return act('code', async () => {
        const code = await createCode('parent');
        fam.code = { kid: 'parent', code, text: t('fam.parentCodeText') };
      });
    case 'copy-code':
      navigator.clipboard?.writeText(fam.code.share || fam.code.code).catch(() => {});
      return;
    case 'share-code':
      if (isNative) nativeShare({ text: fam.code.share }).catch(() => {});
      else if (navigator.share) navigator.share({ text: fam.code.share }).catch(() => {});
      else navigator.clipboard?.writeText(fam.code.share).catch(() => {});
      return;
    case 'wa-code':
      openExternal('https://wa.me/?text=' + encodeURIComponent(fam.code.share));
      return;
    case 'fr-approve':
      return F.updateFriendship(h(), d.pair, { [`approvals.${fam.fid}`]: d.v === '1' }).catch(console.error);
    case 'fr-remove':
      if (confirm(t('fam.removeFriend') + '?')) F.removeFriendship(h(), d.pair).catch(console.error);
      return;
    case 'ch-mark': {
      const today = G.today(), pid = myPid();
      const list = fam.family.challenges.map(ch => {
        if (ch.id !== d.id) return ch;
        const m = { ...(ch.marks?.[pid] || {}) };
        if (m[today]) delete m[today]; else m[today] = true;
        return { ...ch, marks: { ...(ch.marks || {}), [pid]: m } };
      });
      return updateFamily({ challenges: list }).catch(console.error);
    }
    case 'setup-toggle': fam.setupKid = fam.setupKid === d.kid ? null : d.kid; fam.habitEdit = null; fam.catalogFor = null; return onChange();
    case 'habit-new': fam.habitEdit = { kid: d.kid, hid: null }; return onChange();
    case 'habit-edit': fam.habitEdit = { kid: d.kid, hid: d.hid }; return onChange();
    case 'habit-cancel': fam.habitEdit = null; return onChange();
    case 'habit-del':
      if (!confirm(t('fam.habitDelConfirm'))) return;
      return updateKid(k.id, { habits: (k.habits || []).filter(h => h.id !== d.hid) }).catch(console.error);
    case 'catalog-toggle': fam.catalogFor = fam.catalogFor === d.kid ? null : d.kid; return onChange();
    case 'habit-add': {
      const c = KID_HABITS.find(x => x.code === d.code);
      const h = { id: G.newId(), code: c.code, name: c[lang] || c.en, emoji: c.emoji, stars: c.stars, days: c.days ? [...c.days] : [], approval: !!c.approval, since: G.today() };
      return updateKid(k.id, { habits: [...(k.habits || []), h] }).catch(console.error);
    }
    case 'mark': {
      const h = (k.habits || []).find(x => x.id === d.hid);
      if (!h) return;
      const marks = { ...(k.marks || {}) }, dm = { ...(marks[d.day] || {}) };
      const approved = { ...(k.approved || {}) }, da = { ...(approved[d.day] || {}) };
      if (dm[h.id]) { delete dm[h.id]; delete da[h.id]; } else { dm[h.id] = h.stars; da[h.id] = true; }
      if (Object.keys(dm).length) marks[d.day] = dm; else delete marks[d.day];
      if (Object.keys(da).length) approved[d.day] = da; else delete approved[d.day];
      return updateKid(k.id, { marks, approved }).catch(console.error);
    }
    case 'unlink':
      if (!confirm(t('fam.unlinkConfirm'))) return;
      return act('family', async () => {
        const { fb, db } = h();
        await fb.deleteDoc(fb.doc(db, 'kidsFamilies', fam.fid, 'members', d.uid));
        if (fam.family?.parents?.[d.uid] !== undefined) await fb.updateDoc(fb.doc(db, 'kidsFamilies', fam.fid), { [`parents.${d.uid}`]: fb.deleteField() });
      });
    case 'kid-del':
      if (!confirm(t('fam.removeKidConfirm', { name: k.name }))) return;
      return act('family', async () => {
        const { fb, db } = h();
        for (const fr of Object.values(fam.friendships).filter(f => F.involves(f, k.id))) await F.removeFriendship(h(), fr.id).catch(() => {});
        for (const m of fam.members.filter(m => m.kidId === k.id)) await fb.deleteDoc(fb.doc(db, 'kidsFamilies', fam.fid, 'members', m.uid)).catch(() => {});
        await fb.deleteDoc(fb.doc(db, 'kidsFamilies', fam.fid, 'kids', k.id));
        fam.setupKid = null;
      });
    case 'reward-new': fam.rewardForm = true; return onChange();
    case 'reward-del':
      return updateFamily({ rewards: (fam.family.rewards || []).filter(r => r.id !== d.id) }).catch(console.error);
    case 'reward-idea': {
      const r = REWARDS[Number(d.i)];
      return updateFamily({ rewards: [...(fam.family.rewards || []), { id: G.newId(), name: r[lang] || r.en, emoji: r.emoji, cost: r.cost }] }).catch(console.error);
    }
    case 'ch-new': fam.chForm = true; return onChange();
    case 'ch-del':
      if (!confirm(t('fam.chDelete') + '?')) return;
      return updateFamily({ challenges: (fam.family.challenges || []).filter(c => c.id !== d.id) }).catch(console.error);
    case 'del-ask': fam.confirmDelete = true; return onChange();
    case 'del-cancel': fam.confirmDelete = false; return onChange();
    case 'family-leave':
      return act('family', async () => {
        const { fb, db } = h();
        await fb.updateDoc(fb.doc(db, 'kidsFamilies', fam.fid), { [`parents.${myUid()}`]: fb.deleteField() }).catch(() => {});
        await fb.deleteDoc(fb.doc(db, 'kidsFamilies', fam.fid, 'members', myUid()));
        await fb.deleteDoc(fb.doc(db, 'kidsUsers', myUid())).catch(() => {});
        fam.confirmDelete = false;
      });
    case 'family-del':
      return act('family', async () => {
        const { fb, db } = h();
        const fid = fam.fid, uid = myUid();
        for (const fr of Object.values(fam.friendships)) await F.removeFriendship(h(), fr.id).catch(() => {});
        stopFamily();
        const kids = await fb.getDocs(fb.collection(db, 'kidsFamilies', fid, 'kids'));
        for (const x of kids.docs) await fb.deleteDoc(x.ref);
        try {
          const codes = await fb.getDocs(fb.query(fb.collection(db, 'kidsCodes'), fb.where('fid', '==', fid)));
          for (const x of codes.docs) await fb.deleteDoc(x.ref).catch(() => {});
        } catch (err) { console.error(err); }
        const members = await fb.getDocs(fb.collection(db, 'kidsFamilies', fid, 'members'));
        for (const x of members.docs) if (x.id !== uid) await fb.deleteDoc(x.ref);
        await fb.deleteDoc(fb.doc(db, 'kidsFamilies', fid));
        await fb.deleteDoc(fb.doc(db, 'kidsFamilies', fid, 'members', uid)).catch(() => {});
        await fb.deleteDoc(fb.doc(db, 'kidsUsers', uid)).catch(() => {});
        Object.assign(fam, { fid: null, family: null, kids: {}, members: [], friendships: {}, confirmDelete: false });
      });
    case 'open-kids':
      if (isNative) { location.href = KIDS_URL; return true; }
      return false;
  }
}

export function familySubmit(form) {
  const fd = new FormData(form);
  const kind = form.dataset.form;
  if (kind === 'famJoin') return act('join', () => joinFamily(fd.get('code')));
  if (kind === 'famKid') {
    const name = String(fd.get('name') || '').trim();
    if (!name) return;
    return act('kid', async () => { await addKid(name, Number(fd.get('age')) || 8); fam.addKid = false; form.reset(); });
  }
  if (kind === 'famName') {
    const label = String(fd.get('label') || '').trim();
    return act('name', () => updateFamily({ [`parents.${myUid()}`]: label }).then(() => {
      fam.family = { ...fam.family, parents: { ...(fam.family.parents || {}), [myUid()]: label } };
      fam.flash.name = { text: t('fam.saved') };
    }));
  }
  if (kind === 'famKidEdit') {
    const id = form.dataset.id;
    const name = String(fd.get('name') || '').trim();
    if (!name) return;
    return act('kidEdit' + id, async () => {
      await updateKid(id, { name, age: Number(fd.get('age')) || 8, avatar: fd.get('avatar'), color: fd.get('color') });
      fam.flash['kidEdit' + id] = { text: t('fam.saved') };
    });
  }
  if (kind === 'famHabit') {
    const id = form.dataset.id, hid = form.dataset.hid;
    const name = String(fd.get('name') || '').trim();
    if (!name) return;
    const days = DAY_ORDER.filter(n => fd.get('day' + n) === 'on');
    const data = { name, emoji: fd.get('emoji'), stars: Number(fd.get('stars')) || 1, days: days.length === 7 ? [] : days, approval: fd.get('approval') === 'on' };
    const k = fam.kids[id];
    const habits = hid ? k.habits.map(h => (h.id === hid ? { ...h, ...data } : h)) : [...(k.habits || []), { ...data, id: G.newId(), since: G.today() }];
    fam.habitEdit = null;
    return updateKid(id, { habits }).catch(console.error);
  }
  if (kind === 'famBonus') {
    const id = form.dataset.id, k = fam.kids[id];
    const stars = Number(fd.get('stars')) || 1;
    return act('bonus' + id, async () => {
      await updateKid(id, { bonus: [...(k.bonus || []), { id: G.newId(), stars, reason: String(fd.get('reason') || '').trim(), at: new Date().toISOString() }] });
      form.reset();
      fam.flash['bonus' + id] = { text: t('fam.bonusGiven', { n: stars, name: k.name }) };
    });
  }
  if (kind === 'famReward') {
    const name = String(fd.get('name') || '').trim();
    const cost = Math.max(1, Math.min(9999, Math.round(Number(fd.get('cost')) || 1)));
    if (!name) return;
    fam.rewardForm = false;
    return updateFamily({ rewards: [...(fam.family.rewards || []), { id: G.newId(), name, emoji: fd.get('emoji'), cost }] }).catch(console.error);
  }
  if (kind === 'famChallenge') {
    const name = String(fd.get('name') || '').trim();
    if (!name) return;
    const participants = [...form.querySelectorAll('input[type=checkbox]')].filter(i => i.checked).map(i => i.name.slice(2));
    if (participants.length < 2) { fam.flash.ch = { text: t('fam.chNeedTwo'), error: true }; return onChange(); }
    const ch = { id: G.newId(), name, emoji: fd.get('emoji'), days: Number(fd.get('days')) || 7, bonus: Number(fd.get('bonus')) || 10,
      start: G.addDays(G.today(), Number(fd.get('start')) || 0), participants, marks: {}, createdAt: new Date().toISOString() };
    fam.chForm = false; fam.flash.ch = null;
    if (participants.includes(myPid())) ensureHabitFn(name);
    return updateFamily({ challenges: [...(fam.family.challenges || []), ch] }).catch(console.error);
  }
  if (kind === 'famFamName') {
    return act('family', () => updateFamily({ name: String(fd.get('fname') || '').trim() }).then(() => { fam.flash.family = { text: t('fam.saved') }; }));
  }
  if (kind === 'famTask') {
    const kidId = form.dataset.id;
    const name = String(fd.get('name') || '').trim();
    if (!name) return;
    return act('task' + kidId, async () => {
      await sendTask(kidId, { name, when: fd.get('when'), stars: Number(fd.get('stars')) || 1, emoji: fd.get('emoji'), approval: fd.get('approval') === 'on' });
      form.reset();
      fam.flash['task' + kidId] = { text: t('fam.taskSent', { name: fam.kids[kidId].name }) };
    });
  }
}

export const isFamilyForm = kind => kind.startsWith('fam');

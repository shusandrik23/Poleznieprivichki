// Вкладка «Дети»: связь YouBoost с детским приложением YouBoost Kids.
// Взрослый видит прогресс детей, посылает им задачи, подтверждает дела и награды,
// принимает вызовы от детей и участвует в них своей привычкой из YouBoost.
// Данные — те же, что у YouBoost Kids (kidsFamilies/…), правила — раздел «YouBoost Kids» в firestore.rules.
import * as cloud from './cloud.js';
import { social } from './cloud.js';
import * as G from '../kids/js/logic.js';
import { AVATARS, COLORS, REWARDS, HABITS as KID_HABITS, starterFor } from '../kids/js/catalog.js';
import { t, pw, lang } from './i18n.js';
import { habitKey, escapeHtml as e } from './core.js';
import { isNative } from './native.js';

export const KIDS_URL = 'https://shusandrik23.github.io/Poleznieprivichki/kids/';

const fam = {
  loading: false,
  fid: null,
  family: null,
  kids: {},
  members: [],
  error: null,
  flash: {},          // ключ → { text, error }
  code: null,         // { code, title, text }
  taskFor: null,      // ребёнок с открытой формой задачи
  addKid: false,
  busy: false,
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
    + G.pendingProposals(k, myPid()).length, 0);
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

  html += `<div class="row fam-actions">
      <button class="btn small-btn ${fam.taskFor === k.id ? 'primary' : ''}" data-fam="task-toggle" data-kid="${k.id}">📬 ${t('fam.sendTask')}</button>
      <button class="btn small-btn" data-fam="praise" data-kid="${k.id}">👏 ${t('fam.praise')}</button>
      <button class="btn small-btn" data-fam="kid-code" data-kid="${k.id}">📱 ${devices ? t('fam.phoneLinked') : t('fam.linkPhone')}</button>
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
  return html + '</div>';
}

function codeBox() {
  return `<div class="fam-code"><div class="small">${e(fam.code.text)}</div><div class="fam-code-num">${e(fam.code.code)}</div>
    <button class="btn small-btn" data-fam="copy-code">${t('fam.copy')}</button></div>`;
}

function challengesHtml() {
  const pid = myPid();
  const list = (fam.family?.challenges || []).filter(ch => ch.participants?.includes(pid) && G.challengeState(ch) !== 'finished'
    || (ch.participants?.includes(pid) && G.challengeState(ch) === 'finished' && G.challengeEnd(ch) >= G.addDays(G.today(), -7)));
  if (!list.length) return '';
  const today = G.today();
  return `<h2 class="section">${t('fam.challenges')}</h2>` + list.map(ch => {
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
      ${st === 'active' ? `<button class="btn ${mine[today] ? '' : 'primary'}" data-fam="ch-mark" data-id="${ch.id}" style="margin-top:10px">${mine[today] ? '✓ ' + t('fam.doneToday') : t('fam.markToday')}</button>
        <p class="small">${t('fam.syncHint')}</p>` : ''}
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
  html += `<h2 class="section">${t('fam.family')}</h2><div class="card stack">
    ${fam.addKid || !kids.length ? `<form class="row" data-form="famKid"><input name="name" maxlength="24" placeholder="${t('fam.kidNamePh')}" required autocomplete="off">
      <select name="age">${[5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(a => `<option ${a === 8 ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <button class="btn primary" type="submit">${t('fam.addKid')}</button></form>${flashHtml('kid')}`
      : `<button class="btn" data-fam="add-kid">＋ ${t('fam.addKidBtn')}</button>`}
    <form class="row" data-form="famName"><span class="small">${t('fam.callMe')}</span>
      <input name="label" maxlength="20" value="${e(fam.family?.parents?.[myUid()] || '')}" placeholder="${t('fam.callMePh')}">
      <button class="btn small-btn" type="submit">${t('fam.save')}</button></form>${flashHtml('name')}
    <div class="small">${t('fam.parents')}: ${Object.entries(fam.family?.parents || {}).map(([uid, n]) => uid === myUid() ? t('fam.you') : e(n || t('fam.parent'))).join(', ')}</div>
    <button class="btn" data-fam="parent-code">👤 ${t('fam.inviteParent')}</button>
    ${fam.code?.kid === 'parent' ? codeBox() : ''}
    ${kidsLink}
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
        fam.code = { kid: k.id, code, text: t('fam.kidCodeText', { name: k.name }) };
      });
    case 'parent-code':
      return act('code', async () => {
        const code = await createCode('parent');
        fam.code = { kid: 'parent', code, text: t('fam.parentCodeText') };
      });
    case 'copy-code':
      navigator.clipboard?.writeText(fam.code.code).catch(() => {});
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

export const isFamilyForm = kind => kind === 'famJoin' || kind === 'famKid' || kind === 'famName' || kind === 'famTask';

// Друзья детей из разных семей и вызовы между ними. Общий модуль для YouBoost Kids и вкладки «Дети» в YouBoost.
//
// kidsFriendInvites/{код}   — приглашение: чей ребёнок зовёт, его карточка, способ (contact | code), срок 7 дней
// kidsFriendships/{A_B}     — дружба: дети A (пригласил) и B, их семьи, карточки, одобрения родителей,
//                             вызовы ch: { id → { from, name, emoji, days, start, status } }, отметки m: { kid → { вызов → { день: true } } }
//
// Друг из контактов телефона добавляется сразу. Дружба по коду начинается, когда её одобрят родители обоих детей.
// У друга видно только имя, аватар, питомца и общие вызовы.
import * as G from './logic.js';

export const INVITE_DAYS = 7;

export function kidCard(kid, family) {
  const xp = G.lifetimeStars(kid, family);
  const lvl = G.petLevel(xp).level;
  return {
    name: kid.name || '', avatar: kid.avatar || '🙂', color: kid.color || '#ff8a3d',
    pet: kid.pet ? { emoji: lvl === 0 ? '🥚' : G.petById(kid.pet.type).emoji, name: kid.pet.name || '', level: lvl } : null,
  };
}
const sameCard = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);

// ---------- Состояние дружбы ----------

export const isDeclined = fr => Object.values(fr.approvals || {}).some(v => v === false);
export function isActive(fr) {
  if (isDeclined(fr)) return false;
  return fr.via === 'contact' || (fr.approvals?.[fr.fidA] === true && fr.approvals?.[fr.fidB] === true);
}
// Нужно ли одобрение от родителя семьи fid
export const needsApproval = (fr, fid) => fr.via === 'code' && !isDeclined(fr) && fr.approvals?.[fid] === undefined && (fr.fidA === fid || fr.fidB === fid);

export const involves = (fr, kidId) => fr.kidA === kidId || fr.kidB === kidId;
export function other(fr, kidId) {
  const b = fr.kidA === kidId;
  return { kidId: b ? fr.kidB : fr.kidA, fid: b ? fr.fidB : fr.fidA, card: fr.cards?.[b ? fr.kidB : fr.kidA] || {} };
}
export const myKidIn = (fr, fid) => (fr.fidA === fid ? fr.kidA : fr.kidB);

// ---------- Вызовы между друзьями ----------

export function challenges(fr) {
  return Object.entries(fr.ch || {}).map(([id, c]) => ({ ...c, id })).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
export function chState(c, key = G.today()) {
  if (c.status !== 'active') return c.status;   // pending | declined
  return G.challengeState(c, key);              // upcoming | active | finished
}
export function chCount(fr, kidId, c) {
  const m = fr.m?.[kidId]?.[c.id] || {};
  let n = 0;
  for (let i = 0; i < c.days; i++) if (m[G.addDays(c.start, i)]) n++;
  return n;
}

// Привычка с тем же названием, отмеченная ребёнком, засчитывается в вызове с другом.
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function marksAfterHabit(fr, kidId, habitName, day, done) {
  let changed = false;
  const mine = { ...(fr.m?.[kidId] || {}) };
  for (const c of challenges(fr)) {
    if (chState(c, day) !== 'active' || norm(c.name) !== norm(habitName)) continue;
    const cm = { ...(mine[c.id] || {}) };
    if (!!cm[day] === done) continue;
    if (done) cm[day] = true; else delete cm[day];
    mine[c.id] = cm;
    changed = true;
  }
  return changed ? { [`m.${kidId}`]: mine } : null;
}

// ---------- Firestore (fb — модули Firebase, db — база) ----------

export async function createInvite({ fb, db }, { fid, kidId, card, via, uid }) {
  const code = G.makeCode(8);
  await fb.setDoc(fb.doc(db, 'kidsFriendInvites', code), {
    fid, kidId, card, via, by: uid, expires: fb.Timestamp.fromMillis(Date.now() + INVITE_DAYS * 86400000),
  });
  return code;
}

export function cleanCode(raw) { return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); }

export async function getInvite({ fb, db }, raw) {
  const code = cleanCode(raw);
  if (code.length !== 8) throw new Error('bad-friend-code');
  const snap = await fb.getDoc(fb.doc(db, 'kidsFriendInvites', code)).catch(() => null);
  if (!snap || !snap.exists()) throw new Error('bad-friend-code');
  const inv = { ...snap.data(), code };
  if ((inv.expires?.toMillis?.() || 0) < Date.now()) throw new Error('expired-code');
  return inv;
}

// Принять приглашение за ребёнка kidB из семьи fidB. Если принимает родитель, его одобрение ставится сразу.
export async function acceptInvite({ fb, db }, inv, { fidB, kidB, cardB, asParent }) {
  if (inv.fid === fidB) throw new Error('same-family');
  const pair = `${inv.kidId}_${kidB}`;
  const back = await fb.getDoc(fb.doc(db, 'kidsFriendships', `${kidB}_${inv.kidId}`)).catch(() => null);
  if (back?.exists()) return back.id;
  await fb.setDoc(fb.doc(db, 'kidsFriendships', pair), {
    kidA: inv.kidId, kidB, fidA: inv.fid, fidB, via: inv.via, code: inv.code,
    cards: { [inv.kidId]: inv.card, [kidB]: cardB },
    approvals: asParent && inv.via === 'code' ? { [fidB]: true } : {},
    ch: {}, m: {}, createdAt: new Date().toISOString(),
  });
  return pair;
}

// Подписка на все дружбы детей семьи. cb(map pair → friendship)
export function listenFriendships({ fb, db }, fid, cb, onError = console.error) {
  const parts = { a: {}, b: {} };
  const emit = () => cb({ ...parts.a, ...parts.b });
  const col = fb.collection(db, 'kidsFriendships');
  const u1 = fb.onSnapshot(fb.query(col, fb.where('fidA', '==', fid)), s => { parts.a = {}; s.forEach(d => { parts.a[d.id] = { ...d.data(), id: d.id }; }); emit(); }, onError);
  const u2 = fb.onSnapshot(fb.query(col, fb.where('fidB', '==', fid)), s => { parts.b = {}; s.forEach(d => { parts.b[d.id] = { ...d.data(), id: d.id }; }); emit(); }, onError);
  return () => { u1(); u2(); };
}

export function updateFriendship({ fb, db }, pair, patch) {
  return fb.updateDoc(fb.doc(db, 'kidsFriendships', pair), patch);
}
export function removeFriendship({ fb, db }, pair) {
  return fb.deleteDoc(fb.doc(db, 'kidsFriendships', pair));
}

// Обновить свою карточку у друзей (имя, аватар, питомец), если она изменилась.
export function refreshCards(h, friendships, kidsById, family) {
  for (const fr of Object.values(friendships)) {
    for (const kidId of [fr.kidA, fr.kidB]) {
      const kid = kidsById[kidId];
      if (!kid) continue;
      const card = kidCard(kid, family);
      if (!sameCard(card, fr.cards?.[kidId])) updateFriendship(h, fr.id, { [`cards.${kidId}`]: card }).catch(() => {});
    }
  }
}

export function newChallenge(fromKid, d) {
  return { from: fromKid, name: d.name, emoji: d.emoji || '⚔️', days: d.days || 7, start: null, status: 'pending', at: new Date().toISOString() };
}

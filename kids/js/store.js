// Данные семьи: на устройстве (без аккаунта) или в облаке Firebase (с аккаунтом родителя).
//
// Облако (Firestore):
//   kidsFamilies/{fid}               — семья: название, награды, семейные вызовы, родители (пишут только родители)
//   kidsFamilies/{fid}/kids/{kidId}  — ребёнок: привычки, отметки, запросы наград, питомец
//   kidsFamilies/{fid}/members/{uid} — кто подключён: родители (Google) и устройства детей (анонимный вход по коду)
//   kidsCodes/{code}                 — код подключения устройства или второго родителя (действует сутки)
//   kidsUsers/{uid}                  — в какой семье пользователь
import { firebaseConfig } from '../firebase-config.js';
import { newId, makeCode } from './logic.js';
import * as F from './friends.js';
import { isNative, hasNativeGoogle, nativeGoogleIdToken, nativeSignOut } from './native.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';
const DEVICE_KEY = 'ybk-device';
const LOCAL_KEY = 'ybk-local';
const useEmulator = new URLSearchParams(location.search).has('emulator');
const config = useEmulator ? { apiKey: 'demo-key', projectId: 'demo-habits', authDomain: 'localhost' } : firebaseConfig;

// Поля ребёнка, которые может менять устройство ребёнка (остальное — только родители; так же в firestore.rules).
export const CHILD_FIELDS = ['marks', 'requests', 'chMarks', 'pet', 'proposals'];

export const S = {
  ready: false,
  cloudAvailable: !!config,
  cloudReady: false,
  mode: null,       // 'local' | 'cloud' | null — ещё не настроено
  role: null,       // 'parent' | 'child'
  user: null,       // { uid, anonymous, name, email }
  fid: null,
  family: null,
  kids: {},
  kidId: null,      // на устройстве ребёнка — чей это телефон
  members: [],      // для родителя: подключённые устройства и родители
  error: null,
  unlinked: false,  // устройство ребёнка отключили
  friendships: {},  // дружбы детей семьи с детьми из других семей (friends.js)
  synced: false,    // данные семьи загружены (в облаке — пришёл первый ответ сервера)
};

let onChange = () => {};
const changed = () => onChange();
let fb = null, auth = null, db = null;
let unsubs = [];
let authResolved = null;

function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (err) { return null; } }
function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (err) {} }

function saveDevice() { writeJSON(DEVICE_KEY, { mode: S.mode, role: S.role, fid: S.fid, kidId: S.kidId }); }

export function kidsList() {
  return Object.values(S.kids).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function emptyFamily(name) {
  return { name: name || '', rewards: [], challenges: [], parents: {}, createdAt: new Date().toISOString() };
}

// ---------- Запуск ----------

export async function initStore(cb) {
  onChange = cb;
  const dev = readJSON(DEVICE_KEY) || {};
  if (dev.mode === 'local') {
    const data = readJSON(LOCAL_KEY);
    if (data?.family) {
      const solo = dev.role === 'child' && dev.kidId && data.kids?.[dev.kidId];
      Object.assign(S, { mode: 'local', role: solo ? 'child' : 'parent', kidId: solo ? dev.kidId : null, family: data.family, kids: data.kids || {}, fid: 'local', synced: true });
    }
  } else if (dev.mode === 'cloud') {
    Object.assign(S, { mode: 'cloud', role: dev.role, fid: dev.fid, kidId: dev.kidId || null });
  }
  S.ready = S.mode !== 'cloud';
  changed();
  if (config) await connect();
  if (S.mode === 'cloud') {
    await authResolved;
    if (!S.user) {
      // Вход потерян (вышли или очистили данные браузера) — начинаем заново.
      resetDevice(false);
    } else {
      listen();
    }
  }
  S.ready = true;
  changed();
}

async function connect() {
  try {
    const [app, authMod, fs] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    fb = { ...app, ...authMod, ...fs };
    const fapp = fb.initializeApp(config, 'kids');
    auth = fb.getAuth(fapp);
    db = fb.getFirestore(fapp);
    if (useEmulator) {
      fb.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      fb.connectFirestoreEmulator(db, '127.0.0.1', 8080);
      window.__kidsFb = { fb, db, auth };
      window.__testSignIn = (sub, email, name) =>
        fb.signInWithCredential(auth, fb.GoogleAuthProvider.credential(JSON.stringify({ sub, email, name, email_verified: true })));
    }
    authResolved = new Promise(resolve => {
      fb.onAuthStateChanged(auth, u => {
        S.user = u ? { uid: u.uid, anonymous: u.isAnonymous, name: u.displayName || '', email: u.email || '' } : null;
        resolve();
        changed();
      });
    });
    S.cloudReady = true;
  } catch (e) {
    console.error(e);
    S.error = 'connect';
    authResolved = Promise.resolve();
  }
}

function stopListening() { unsubs.forEach(u => u()); unsubs = []; }

let gotFamily = false, gotKids = false;
function listen() {
  stopListening();
  const fid = S.fid;
  gotFamily = gotKids = false;
  S.synced = false;
  const markSynced = () => { S.synced = gotFamily && gotKids; };
  const onErr = e => {
    console.error(e);
    if (e.code === 'permission-denied') {
      // Устройство отключили от семьи (или семью удалили).
      S.unlinked = true;
      resetDevice(false);
    }
    changed();
  };
  unsubs.push(fb.onSnapshot(fb.doc(db, 'kidsFamilies', fid), snap => {
    if (!snap.exists()) { S.unlinked = true; resetDevice(false); changed(); return; }
    S.family = snap.data();
    gotFamily = true; markSynced();
    changed();
  }, onErr));
  unsubs.push(fb.onSnapshot(fb.collection(db, 'kidsFamilies', fid, 'kids'), snap => {
    const kids = {};
    snap.forEach(d => { kids[d.id] = { ...d.data(), id: d.id }; });
    S.kids = kids;
    gotKids = true; markSynced();
    changed();
  }, onErr));
  unsubs.push(F.listenFriendships({ fb, db }, fid, map => { S.friendships = map; changed(); }, e => console.error(e)));
  // Своё членство: если родитель отключил устройство (или семью удалили) — сразу выходим.
  // Уже открытые подписки Firestore сами об этом не узнают, пока не изменятся их документы.
  unsubs.push(fb.onSnapshot(fb.doc(db, 'kidsFamilies', fid, 'members', S.user.uid), snap => {
    if (!snap.exists()) { S.unlinked = true; resetDevice(false); changed(); }
  }, onErr));
  if (S.role === 'parent') {
    unsubs.push(fb.onSnapshot(fb.collection(db, 'kidsFamilies', fid, 'members'), snap => {
      S.members = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      changed();
    }, e => console.error(e)));
  }
}

function persistLocal() { writeJSON(LOCAL_KEY, { family: S.family, kids: S.kids }); }

// ---------- Изменения ----------

export async function updateFamily(patch) {
  S.family = { ...S.family, ...patch };
  changed();
  if (S.mode === 'local') return persistLocal();
  await fb.updateDoc(fb.doc(db, 'kidsFamilies', S.fid), patch);
}

export async function updateKid(id, patch) {
  if (!S.kids[id]) return;
  S.kids[id] = { ...S.kids[id], ...patch };
  changed();
  if (S.mode === 'local') return persistLocal();
  await fb.updateDoc(fb.doc(db, 'kidsFamilies', S.fid, 'kids', id), patch);
}

export async function addKid(data) {
  const id = newId();
  const kid = { habits: [], marks: {}, approved: {}, requests: [], decisions: {}, bonus: [], chMarks: {}, pet: null, order: Object.keys(S.kids).length, createdAt: new Date().toISOString(), ...data };
  S.kids[id] = { ...kid, id };
  changed();
  if (S.mode === 'local') persistLocal();
  else await fb.setDoc(fb.doc(db, 'kidsFamilies', S.fid, 'kids', id), kid);
  return id;
}

export async function removeKid(id) {
  if (S.mode === 'cloud') {
    for (const fr of Object.values(S.friendships).filter(f => F.involves(f, id))) await F.removeFriendship({ fb, db }, fr.id).catch(() => {});
  }
  delete S.kids[id];
  changed();
  if (S.mode === 'local') return persistLocal();
  await fb.deleteDoc(fb.doc(db, 'kidsFamilies', S.fid, 'kids', id));
  for (const m of S.members.filter(m => m.kidId === id)) {
    try { await fb.deleteDoc(fb.doc(db, 'kidsFamilies', S.fid, 'members', m.uid)); } catch (err) {}
  }
}

// ---------- Настройка устройства ----------

export function setupLocal(familyName) {
  Object.assign(S, { mode: 'local', role: 'parent', fid: 'local', family: emptyFamily(familyName), kids: {}, synced: true });
  persistLocal();
  saveDevice();
  changed();
}

function assertCloud() {
  if (!S.cloudReady) throw new Error('offline');
}

async function googleSignIn() {
  assertCloud();
  if (S.user && !S.user.anonymous) return;
  if (isNative) {
    if (!hasNativeGoogle()) throw new Error('native-signin');
    const idToken = await nativeGoogleIdToken();
    if (!idToken) return;
    await fb.signInWithCredential(auth, fb.GoogleAuthProvider.credential(idToken));
  } else {
    try {
      await fb.signInWithPopup(auth, new fb.GoogleAuthProvider());
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      throw e;
    }
  }
  await waitUser(u => u && !u.anonymous);
}

function waitUser(test, ms = 15000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    (function poll() {
      if (test(S.user)) return resolve(S.user);
      if (Date.now() - started > ms) return reject(new Error('signin-timeout'));
      setTimeout(poll, 100);
    })();
  });
}

// Родитель входит через Google: находим его семью, переносим семью с устройства или создаём новую.
// Возвращает 'existing' | 'migrated' | 'created' | null (вход отменён).
export async function parentSignIn(familyName = '') {
  await googleSignIn();
  if (!S.user || S.user.anonymous) return null;
  const uid = S.user.uid;
  const userSnap = await fb.getDoc(fb.doc(db, 'kidsUsers', uid));
  let fid = userSnap.exists() ? userSnap.data().fid : null;
  if (fid) {
    const fam = await fb.getDoc(fb.doc(db, 'kidsFamilies', fid)).catch(() => null);
    if (!fam || !fam.exists()) fid = null;
  }
  let result = 'existing';
  if (!fid) {
    const local = S.mode === 'local' ? { family: S.family, kids: S.kids } : null;
    fid = fb.doc(fb.collection(db, 'kidsFamilies')).id;
    const batch = fb.writeBatch(db);
    const family = { ...(local?.family || emptyFamily(familyName)), owner: uid, parents: { [uid]: S.user.name || '' }, createdAt: new Date().toISOString() };
    batch.set(fb.doc(db, 'kidsFamilies', fid), family);
    batch.set(fb.doc(db, 'kidsFamilies', fid, 'members', uid), { role: 'parent', name: S.user.name || '' });
    batch.set(fb.doc(db, 'kidsUsers', uid), { fid });
    await batch.commit();
    if (local) {
      for (const [id, kid] of Object.entries(local.kids)) {
        const { id: _drop, ...data } = kid;
        await fb.setDoc(fb.doc(db, 'kidsFamilies', fid, 'kids', id), data);
      }
    }
    result = local ? 'migrated' : 'created';
  }
  Object.assign(S, { mode: 'cloud', role: 'parent', fid, kidId: null });
  saveDevice();
  try { localStorage.removeItem(LOCAL_KEY); } catch (err) {}
  listen();
  changed();
  return result;
}

// Ребёнок начинает сам, без родителя: всё хранится только на телефоне (без сервера и без друзей),
// пока родитель не подключит телефон ссылкой или кодом. Тогда звёзды, питомец и дела переедут в семью.
export const isSolo = () => S.mode === 'local' && S.role === 'child';
export function setupSolo(kid) {
  const id = newId();
  Object.assign(S, {
    mode: 'local', role: 'child', fid: 'local', kidId: id, synced: true, family: emptyFamily(''),
    kids: { [id]: { habits: [], marks: {}, approved: {}, requests: [], decisions: {}, bonus: [], chMarks: {}, pet: null, order: 0, createdAt: new Date().toISOString(), ...kid, id, solo: true } },
  });
  persistLocal();
  saveDevice();
  changed();
}

// Перенос самостоятельного прогресса в карточку ребёнка, которую создал родитель.
// Телефон ребёнка может менять только свои поля (marks, pet…) и заполнить привычки, если их ещё нет.
async function adoptSolo(fid, kidId, solo) {
  const ref = fb.doc(db, 'kidsFamilies', fid, 'kids', kidId);
  const snap = await fb.getDoc(ref);
  if (!snap.exists()) return;
  const target = snap.data();
  const patch = {};
  const targetHabits = target.habits || [];
  const idMap = {};
  if (!targetHabits.length) patch.habits = solo.habits || [];
  else {
    // одинаковые привычки из каталога — переносим отметки на привычки родителя
    for (const h of solo.habits || []) {
      const same = h.code && targetHabits.find(x => x.code === h.code);
      if (same) idMap[h.id] = same.id;
    }
  }
  const marks = { ...(target.marks || {}) };
  for (const [day, dm] of Object.entries(solo.marks || {})) {
    const out = { ...(marks[day] || {}) };
    for (const [hid, stars] of Object.entries(dm || {})) out[idMap[hid] || hid] = out[idMap[hid] || hid] || stars;
    marks[day] = out;
  }
  patch.marks = marks;
  if (!target.pet && solo.pet) patch.pet = solo.pet;
  await fb.updateDoc(ref, patch);
}

// Подключение по коду от родителя: устройство ребёнка (анонимный вход) или второй родитель (вход через Google).
export async function joinWithCode(rawCode, deviceName = '') {
  assertCloud();
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 6) throw new Error('bad-code');
  if (!S.user) {
    await fb.signInAnonymously(auth);
    await waitUser(u => !!u);
  }
  const snap = await fb.getDoc(fb.doc(db, 'kidsCodes', code)).catch(() => null);
  if (!snap || !snap.exists()) throw new Error('bad-code');
  const c = snap.data();
  if ((c.expires?.toMillis?.() || 0) < Date.now()) throw new Error('expired-code');
  if (c.role === 'parent' && S.user.anonymous) throw new Error('need-google');
  if (c.role === 'parent' && isSolo()) throw new Error('need-google');
  const uid = S.user.uid;
  const soloKid = isSolo() && c.role === 'child' ? S.kids[S.kidId] : null;
  const member = c.role === 'child'
    ? { role: 'child', kidId: c.kidId, code, name: deviceName }
    : { role: 'parent', code, name: S.user.name || '' };
  await fb.setDoc(fb.doc(db, 'kidsFamilies', c.fid, 'members', uid), member);
  await fb.setDoc(fb.doc(db, 'kidsUsers', uid), { fid: c.fid });
  if (c.role === 'parent') {
    await fb.updateDoc(fb.doc(db, 'kidsFamilies', c.fid), { [`parents.${uid}`]: S.user.name || '' });
  }
  if (soloKid) {
    try { await adoptSolo(c.fid, c.kidId, soloKid); } catch (err) { console.error(err); }
    try { localStorage.removeItem(LOCAL_KEY); } catch (err) {}
  }
  Object.assign(S, { mode: 'cloud', role: c.role, fid: c.fid, kidId: c.kidId || null, unlinked: false, kids: {}, family: null });
  saveDevice();
  listen();
  changed();
  return c.role;
}

// Второй родитель: сначала вход через Google, потом код.
export async function parentJoin(code) {
  await googleSignIn();
  if (!S.user || S.user.anonymous) return null;
  return joinWithCode(code);
}

export async function createCode(role, kidId = null) {
  const code = makeCode(6);
  await fb.setDoc(fb.doc(db, 'kidsCodes', code), {
    fid: S.fid, role, kidId, by: S.user.uid,
    expires: fb.Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000),
  });
  return code;
}

export async function removeMember(uid) {
  await fb.deleteDoc(fb.doc(db, 'kidsFamilies', S.fid, 'members', uid));
  if (S.family?.parents?.[uid] !== undefined) {
    await fb.updateDoc(fb.doc(db, 'kidsFamilies', S.fid), { [`parents.${uid}`]: fb.deleteField() });
  }
}

function resetDevice(clearLocal = true) {
  stopListening();
  Object.assign(S, { mode: null, role: null, fid: null, family: null, kids: {}, kidId: null, members: [], friendships: {}, synced: false });
  try {
    localStorage.removeItem(DEVICE_KEY);
    if (clearLocal) localStorage.removeItem(LOCAL_KEY);
  } catch (err) {}
}

// Выйти из аккаунта / отключить это устройство (данные семьи в облаке остаются).
export async function leaveDevice() {
  const wasChild = S.role === 'child' && S.mode === 'cloud';
  if (wasChild && S.user) {
    try { await fb.deleteDoc(fb.doc(db, 'kidsFamilies', S.fid, 'members', S.user.uid)); } catch (err) {}
    try { await fb.deleteDoc(fb.doc(db, 'kidsUsers', S.user.uid)); } catch (err) {}
  }
  resetDevice(S.mode !== 'local' || isSolo());
  if (auth?.currentUser) {
    try { if (wasChild) await fb.deleteUser(auth.currentUser); } catch (err) {}
    try { await fb.signOut(auth); } catch (err) {}
  }
  await nativeSignOut();
  changed();
}

// Удалить семью целиком: детей, подключения, коды и аккаунт-связки.
export async function deleteFamily() {
  if (S.mode === 'local') { resetDevice(true); changed(); return; }
  if (S.family?.owner !== S.user?.uid) throw new Error('not-owner');
  const fid = S.fid, uid = S.user.uid;
  for (const fr of Object.values(S.friendships)) await F.removeFriendship({ fb, db }, fr.id).catch(() => {});
  stopListening();
  const kids = await fb.getDocs(fb.collection(db, 'kidsFamilies', fid, 'kids'));
  for (const d of kids.docs) await fb.deleteDoc(d.ref);
  try {
    const codes = await fb.getDocs(fb.query(fb.collection(db, 'kidsCodes'), fb.where('fid', '==', fid)));
    for (const d of codes.docs) await fb.deleteDoc(d.ref).catch(() => {});
  } catch (err) { console.error(err); }   // коды и так перестают действовать через сутки
  const members = await fb.getDocs(fb.collection(db, 'kidsFamilies', fid, 'members'));
  for (const d of members.docs) if (d.id !== uid) await fb.deleteDoc(d.ref);
  await fb.deleteDoc(fb.doc(db, 'kidsFamilies', fid));
  await fb.deleteDoc(fb.doc(db, 'kidsFamilies', fid, 'members', uid)).catch(() => {});
  await fb.deleteDoc(fb.doc(db, 'kidsUsers', uid)).catch(() => {});
  resetDevice(true);
  try { await fb.signOut(auth); } catch (err) {}
  await nativeSignOut();
  changed();
}

export const isOwner = () => S.mode === 'local' || S.family?.owner === S.user?.uid;

// ---------- Друзья ----------
const H = () => ({ fb, db });
export const friendInvite = (kidId, via) => F.createInvite(H(), { fid: S.fid, kidId, via, uid: S.user.uid, card: F.kidCard(S.kids[kidId], S.family) });
export const friendGetInvite = code => F.getInvite(H(), code);
export const friendAccept = (inv, kidId) => F.acceptInvite(H(), inv, { fidB: S.fid, kidB: kidId, cardB: F.kidCard(S.kids[kidId], S.family), asParent: S.role === 'parent' });
export const friendUpdate = (pair, patch) => F.updateFriendship(H(), pair, patch);
export const friendRemove = pair => F.removeFriendship(H(), pair);
export const friendRefreshCards = () => { if (S.mode === 'cloud' && S.synced) F.refreshCards(H(), S.friendships, S.kids, S.family); };

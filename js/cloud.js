// Облачная часть: вход, синхронизация привычек, друзья и вызовы (Firebase).
import { firebaseConfig, appleSignInEnabled } from '../firebase-config.js';
import { streaks, habitKey, challengeProgress, todayNumber, dateKey } from './core.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';
const params = new URLSearchParams(location.search);
const useEmulator = params.has('emulator');

const config = useEmulator
  ? { apiKey: 'demo-key', projectId: 'demo-habits', authDomain: 'localhost' }
  : firebaseConfig;

export const cloudAvailable = !!config;
export const appleAvailable = appleSignInEnabled && !useEmulator;

// Состояние, которое показывает интерфейс.
export const social = {
  ready: false,        // Firebase загрузился
  user: null,          // { uid, email }
  profile: undefined,  // undefined — загружается, null — ника ещё нет
  incoming: [],        // входящие заявки в друзья
  outgoing: [],        // исходящие заявки
  friends: [],         // [{ uid, nickname, name }]
  friendStats: {},     // uid → { habits: [{ key, name, cur, end, best, goal }] }
  challenges: [],
  error: null,
};

let fb = null;      // модули Firebase
let auth, db;
let hooks = {};     // { onChange, getState, setState }
let unsubs = [];
let friendUnsubs = {};
const clientId = Math.random().toString(36).slice(2);
let pushTimer = null;
let remoteLoaded = false;

function changed() { hooks.onChange && hooks.onChange(); }

export async function initCloud(h) {
  hooks = h;
  if (!config) return;
  try {
    const [app, authMod, fs] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    fb = { ...app, ...authMod, ...fs };
    const fapp = fb.initializeApp(config);
    auth = fb.getAuth(fapp);
    db = fb.getFirestore(fapp);
    if (useEmulator) {
      fb.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      fb.connectFirestoreEmulator(db, '127.0.0.1', 8080);
      // Вход тестовым пользователем (только для проверки на эмуляторе).
      window.__testSignIn = (sub, email) =>
        fb.signInWithCredential(auth, fb.GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true })));
    }
    social.ready = true;
    fb.onAuthStateChanged(auth, onUser);
  } catch (e) {
    console.error(e);
    social.error = 'Не удалось подключиться к серверу. Проверьте интернет.';
  }
  changed();
}

// ---------- Вход и выход ----------

export async function signInGoogle() {
  await signInWith(new fb.GoogleAuthProvider());
}

export async function signInApple() {
  const p = new fb.OAuthProvider('apple.com');
  p.addScope('email'); p.addScope('name');
  await signInWith(p);
}

async function signInWith(provider) {
  try {
    await fb.signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await fb.signInWithRedirect(auth, provider);
    } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      throw e;
    }
  }
}

export async function signOut() {
  await fb.signOut(auth);
}

function stopListeners() {
  unsubs.forEach(u => u()); unsubs = [];
  Object.values(friendUnsubs).forEach(u => u()); friendUnsubs = {};
}

async function onUser(user) {
  stopListeners();
  remoteLoaded = false;
  Object.assign(social, { user: user ? { uid: user.uid, email: user.email } : null, profile: user ? undefined : null,
    incoming: [], outgoing: [], friends: [], friendStats: {}, challenges: [] });
  changed();
  if (!user) return;
  const uid = user.uid;

  unsubs.push(fb.onSnapshot(fb.doc(db, 'profiles', uid), snap => {
    social.profile = snap.exists() ? snap.data() : null;
    changed();
  }));

  // Личные привычки: при входе объединяем с тем, что уже есть на устройстве.
  const userRef = fb.doc(db, 'users', uid);
  const first = await fb.getDoc(userRef);
  const local = hooks.getState();
  const merged = first.exists() ? mergeStates(first.data(), local) : local;
  hooks.setState(merged);
  remoteLoaded = true;
  await pushNow();

  unsubs.push(fb.onSnapshot(userRef, snap => {
    if (snap.metadata.hasPendingWrites || !snap.exists()) return;
    const data = snap.data();
    if (data.client === clientId) return;
    hooks.setState({ habits: data.habits || [] });  // изменения с другого устройства
    syncChallenges();
  }));

  unsubs.push(fb.onSnapshot(fb.query(fb.collection(db, 'friendRequests'), fb.where('to', '==', uid)), snap => {
    social.incoming = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    changed();
  }));
  unsubs.push(fb.onSnapshot(fb.query(fb.collection(db, 'friendRequests'), fb.where('from', '==', uid)), snap => {
    social.outgoing = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    changed();
  }));
  unsubs.push(fb.onSnapshot(fb.collection(db, 'users', uid, 'friends'), snap => {
    social.friends = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => (a.name || a.nickname).localeCompare(b.name || b.nickname));
    watchFriendStats();
    changed();
  }));
  unsubs.push(fb.onSnapshot(fb.query(fb.collection(db, 'challenges'), fb.where('participants', 'array-contains', uid)), snap => {
    if (snap.metadata.hasPendingWrites) return; // ждём подтверждения сервера
    social.challenges = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    changed();
    syncChallenges();
  }));
}

function watchFriendStats() {
  const ids = new Set(social.friends.map(f => f.uid));
  for (const uid of Object.keys(friendUnsubs)) {
    if (!ids.has(uid)) { friendUnsubs[uid](); delete friendUnsubs[uid]; delete social.friendStats[uid]; }
  }
  for (const uid of ids) {
    if (friendUnsubs[uid]) continue;
    friendUnsubs[uid] = fb.onSnapshot(fb.doc(db, 'stats', uid), snap => {
      social.friendStats[uid] = snap.exists() ? snap.data() : { habits: [] };
      changed();
    }, () => {
      // Дружба могла ещё не дойти до сервера — пробуем снова чуть позже.
      delete friendUnsubs[uid];
      setTimeout(() => { if (social.friends.some(f => f.uid === uid)) watchFriendStats(); }, 1500);
    });
  }
}

// Объединение данных с устройства и из облака: привычки по названию, отметки — все.
function mergeStates(remote, local) {
  const out = (remote.habits || []).map(h => ({ ...h, done: { ...h.done } }));
  for (const lh of local.habits) {
    const rh = out.find(h => habitKey(h.name) === habitKey(lh.name));
    if (rh) {
      Object.assign(rh.done, lh.done);
      if (lh.goal && !rh.goal) rh.goal = lh.goal;
    } else {
      out.push({ ...lh, done: { ...lh.done } });
    }
  }
  return { habits: out };
}

// ---------- Сохранение ----------

// Вызывается после каждого изменения привычек.
export function scheduleSync() {
  if (!social.user || !remoteLoaded) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 600);
}

async function pushNow() {
  if (!social.user) return;
  const uid = social.user.uid;
  const state = hooks.getState();
  const today = dateKey(new Date());
  const stats = state.habits.map(h => {
    const s = streaks(h, today);
    return { key: habitKey(h.name), name: h.name, cur: s.current, end: s.end, best: s.best, goal: h.goal || null };
  });
  try {
    const batch = fb.writeBatch(db);
    batch.set(fb.doc(db, 'users', uid), { habits: state.habits, client: clientId, updatedAt: fb.serverTimestamp() });
    batch.set(fb.doc(db, 'stats', uid), { habits: stats, updatedAt: fb.serverTimestamp() });
    await batch.commit();
    await syncChallenges();
  } catch (e) {
    console.error('sync failed', e);
  }
}

// Обновляем свой прогресс во всех активных вызовах.
async function syncChallenges() {
  if (!social.user || !remoteLoaded) return;
  const uid = social.user.uid;
  const state = hooks.getState();
  const today = todayNumber();
  for (const ch of social.challenges) {
    if (ch.status !== 'active') continue;
    const habit = state.habits.find(h => habitKey(h.name) === ch.habitKey);
    const p = challengeProgress(habit, ch.startDay, ch.days, today);
    const old = ch.progress?.[uid];
    if (old && old.count === p.count && old.completed === p.completed && old.failed === p.failed) continue;
    try {
      await fb.updateDoc(fb.doc(db, 'challenges', ch.id), { [`progress.${uid}`]: p });
    } catch (e) { console.error('challenge sync failed', e); }
  }
}

// ---------- Профиль ----------

export const NICK_RE = /^[a-z0-9_]{3,20}$/;

export async function claimNickname(nickname, name) {
  const uid = social.user.uid;
  nickname = nickname.trim().toLowerCase().replace(/^@/, '');
  name = (name || '').trim().slice(0, 40);
  if (!NICK_RE.test(nickname)) throw new Error('Ник: 3–20 символов, латинские буквы, цифры и «_».');
  const ref = fb.doc(db, 'usernames', nickname);
  const taken = await fb.getDoc(ref);
  if (taken.exists() && taken.data().uid !== uid) throw new Error(`Ник @${nickname} уже занят, выберите другой.`);
  const batch = fb.writeBatch(db);
  if (social.profile && social.profile.nickname !== nickname) batch.delete(fb.doc(db, 'usernames', social.profile.nickname));
  if (!taken.exists()) batch.set(ref, { uid });
  batch.set(fb.doc(db, 'profiles', uid), { nickname, name });
  await batch.commit();
}

// ---------- Друзья ----------

export async function sendFriendRequest(nickname) {
  const me = social.user.uid;
  nickname = nickname.trim().toLowerCase().replace(/^@/, '');
  if (!nickname) return;
  if (nickname === social.profile.nickname) throw new Error('Это ваш собственный ник 🙂');
  const u = await fb.getDoc(fb.doc(db, 'usernames', nickname));
  if (!u.exists()) throw new Error(`Пользователь @${nickname} не найден.`);
  const to = u.data().uid;
  if (social.friends.some(f => f.uid === to)) throw new Error(`@${nickname} уже у вас в друзьях.`);
  const reverse = social.incoming.find(r => r.from === to);
  if (reverse) { await respondFriendRequest(reverse, true); return 'accepted'; }
  const profile = (await fb.getDoc(fb.doc(db, 'profiles', to))).data();
  await fb.setDoc(fb.doc(db, 'friendRequests', `${me}_${to}`), {
    from: me, to,
    fromNick: social.profile.nickname, fromName: social.profile.name || '',
    toNick: profile.nickname, toName: profile.name || '',
    createdAt: fb.serverTimestamp(),
  });
  return 'sent';
}

export async function respondFriendRequest(req, accept) {
  const me = social.user.uid;
  const batch = fb.writeBatch(db);
  if (accept) {
    batch.set(fb.doc(db, 'users', me, 'friends', req.from), { nickname: req.fromNick, name: req.fromName || '', since: fb.serverTimestamp() });
    batch.set(fb.doc(db, 'users', req.from, 'friends', me), { nickname: social.profile.nickname, name: social.profile.name || '', since: fb.serverTimestamp() });
  }
  batch.delete(fb.doc(db, 'friendRequests', req.id));
  await batch.commit();
}

export async function cancelFriendRequest(req) {
  await fb.deleteDoc(fb.doc(db, 'friendRequests', req.id));
}

export async function removeFriend(uid) {
  const me = social.user.uid;
  const batch = fb.writeBatch(db);
  batch.delete(fb.doc(db, 'users', me, 'friends', uid));
  batch.delete(fb.doc(db, 'users', uid, 'friends', me));
  await batch.commit();
}

// ---------- Вызовы ----------

export async function createChallenge(friend, habitName, days) {
  const me = social.user.uid;
  await fb.addDoc(fb.collection(db, 'challenges'), {
    participants: [me, friend.uid],
    names: { [me]: social.profile.name || '@' + social.profile.nickname, [friend.uid]: friend.name || '@' + friend.nickname },
    habitName, habitKey: habitKey(habitName), days,
    status: 'pending', startDay: null, progress: {},
    createdAt: fb.serverTimestamp(),
  });
}

// ensureHabit(name) — добавляет привычку себе, если её ещё нет.
export async function respondChallenge(ch, accept, ensureHabit) {
  const me = social.user.uid;
  if (!accept) { await fb.updateDoc(fb.doc(db, 'challenges', ch.id), { status: 'declined' }); return; }
  ensureHabit(ch.habitName);
  const today = todayNumber();
  const habit = hooks.getState().habits.find(h => habitKey(h.name) === ch.habitKey);
  await fb.updateDoc(fb.doc(db, 'challenges', ch.id), {
    status: 'active', startDay: today,
    [`progress.${me}`]: challengeProgress(habit, today, ch.days, today),
  });
}

export async function deleteChallenge(ch) {
  await fb.deleteDoc(fb.doc(db, 'challenges', ch.id));
}

// ---------- Удаление аккаунта (обязательно для App Store) ----------

export async function deleteAccount() {
  const user = auth.currentUser;
  const uid = user.uid;
  const batch = fb.writeBatch(db);
  for (const f of social.friends) {
    batch.delete(fb.doc(db, 'users', uid, 'friends', f.uid));
    batch.delete(fb.doc(db, 'users', f.uid, 'friends', uid));
  }
  for (const r of [...social.incoming, ...social.outgoing]) batch.delete(fb.doc(db, 'friendRequests', r.id));
  for (const c of social.challenges) batch.delete(fb.doc(db, 'challenges', c.id));
  if (social.profile) batch.delete(fb.doc(db, 'usernames', social.profile.nickname));
  batch.delete(fb.doc(db, 'profiles', uid));
  batch.delete(fb.doc(db, 'stats', uid));
  batch.delete(fb.doc(db, 'users', uid));
  stopListeners();
  await batch.commit();
  try {
    await fb.deleteUser(user);
  } catch (e) {
    if (e.code === 'auth/requires-recent-login') {
      await fb.reauthenticateWithPopup(user, providerFor(user));
      await fb.deleteUser(user);
    } else throw e;
  }
}

function providerFor(user) {
  const id = user.providerData[0]?.providerId;
  return id === 'apple.com' ? new fb.OAuthProvider('apple.com') : new fb.GoogleAuthProvider();
}

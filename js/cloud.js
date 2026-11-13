// Облачная часть: вход, синхронизация привычек, друзья, поиск по привычкам, приглашения и вызовы (Firebase).
import { firebaseConfig, appleSignInEnabled } from '../firebase-config.js';
import { streaks, challengeProgress, todayNumber, dateKey } from './core.js';
import { keyOf, keyOfName, normKey } from './catalog.js';
import * as I from './i18n.js';
import { setServerPlus, PROMO } from './plans.js';
import { tournamentById, tourProgress, FLAG_LIMIT } from './tournaments.js';
import { isNative, hasNativeGoogle, nativeGoogleIdToken, nativeSignOut, appUrl, bridgeCheck, pluginHasMethod } from './native.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';
const params = new URLSearchParams(location.search);
const useEmulator = params.has('emulator');

const config = useEmulator
  ? { apiKey: 'demo-key', projectId: 'demo-habits', authDomain: 'localhost' }
  : firebaseConfig;

export const cloudAvailable = !!config;
export const appleAvailable = appleSignInEnabled && !useEmulator;

// Новых пользователей видно в подборе соперников (только ник и серии); отключается в настройках.
const DEFAULT_SETTINGS = { showName: false, realName: '', discoverable: true };

// Состояние, которое показывает интерфейс.
export const social = {
  ready: false,        // Firebase загрузился
  user: null,          // { uid, email, displayName }
  profile: undefined,  // { nickname } · undefined — загружается, null — ника ещё нет
  settings: { ...DEFAULT_SETTINGS },
  incoming: [],        // входящие заявки в друзья
  outgoing: [],        // исходящие заявки
  friends: [],         // [{ uid, nickname }]
  friendStats: {},     // uid → { habits: [{ key, name, cur, end, best, goal }], realName }
  challenges: [],
  joined: [],          // id турниров, в которых участвую
  referrals: 0,        // сколько друзей зарегистрировалось по моим ссылкам
  qualified: 0,        // из них засчитаны в акции (отмечали привычки 3 дня)
  promo: null,         // документ акции promo/invite2 (сколько мест занято)
  promoWon: null,      // я получил награду акции
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

// Доступ к Firebase для вкладки «Дети» (js/family.js).
export function handles() { return { fb, db }; }

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
      window.__fb = { fb, db };
      // Вход тестовым пользователем (только для проверки на эмуляторе).
      window.__testSignIn = (sub, email, name) =>
        fb.signInWithCredential(auth, fb.GoogleAuthProvider.credential(JSON.stringify({ sub, email, name, email_verified: true })));
    }
    social.ready = true;
    fb.onAuthStateChanged(auth, onUser);
  } catch (e) {
    console.error(e);
    social.error = 'connect';
  }
  changed();
}

// ---------- Вход и выход ----------

export async function signInGoogle() {
  if (isNative) {
    // В Android-приложении всплывающие окна не работают — входим через системный выбор аккаунта Google.
    if (!hasNativeGoogle()) throw new Error(I.t('err.nativeSignin'));
    let idToken;
    try {
      idToken = await Promise.race([
        nativeGoogleIdToken(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(I.t('err.signinTimeout'))), 60000)),
      ]);
    } catch (e) {
      // Показываем настоящую причину — по ней видно, что не так (отпечаток SHA-1, нет аккаунта и т. п.).
      const msg = e?.message || e?.code || String(e);
      if (/cancel/i.test(msg)) return;
      const diag = `[bridge: ${await bridgeCheck()}; plugin: ${pluginHasMethod('FirebaseAuthentication', 'signInWithGoogle') ? 'ok' : 'no'}]`;
      const err = new Error(`${I.t('err.signin')} ${msg} ${diag}`);
      err.native = true;
      throw err;
    }
    if (!idToken) throw new Error(`${I.t('err.signin')} no idToken`);
    await fb.signInWithCredential(auth, fb.GoogleAuthProvider.credential(idToken));
    return;
  }
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

// Вход по Google ID-токену, полученному через браузер (запасной вход в Android-приложении).
export async function signInWithIdToken(idToken) {
  await fb.signInWithCredential(auth, fb.GoogleAuthProvider.credential(idToken));
}

// На сайте: вход через Google для передачи в приложение — возвращает Google ID-токен.
export async function webSignInForApp() {
  const result = await fb.signInWithPopup(auth, new fb.GoogleAuthProvider());
  const cred = fb.GoogleAuthProvider.credentialFromResult(result);
  if (!cred?.idToken) throw new Error('no idToken');
  return cred.idToken;
}

export async function signOut() {
  await fb.signOut(auth);
  await nativeSignOut();
}

function stopListeners() {
  unsubs.forEach(u => u()); unsubs = [];
  Object.values(friendUnsubs).forEach(u => u()); friendUnsubs = {};
}

async function onUser(user) {
  stopListeners();
  remoteLoaded = false;
  Object.assign(social, {
    user: user ? { uid: user.uid, email: user.email, displayName: user.displayName || '' } : null,
    profile: user ? undefined : null, settings: { ...DEFAULT_SETTINGS },
    incoming: [], outgoing: [], friends: [], friendStats: {}, challenges: [], joined: [], referrals: 0, qualified: 0, promo: null, promoWon: null,
  });
  setServerPlus(0);
  changed();
  if (!user) return;
  const uid = user.uid;

  // Plus, выданный сервером (акции, позже — оплата). Писать в plus/{uid} может только сервер.
  unsubs.push(fb.onSnapshot(fb.doc(db, 'plus', uid), snap => {
    const until = snap.exists() ? snap.data().until : null;
    setServerPlus(until?.toMillis ? until.toMillis() : 0);
    changed();
  }, () => {}));

  unsubs.push(fb.onSnapshot(fb.query(fb.collection(db, 'referrals'), fb.where('by', '==', uid)), snap => {
    social.referrals = snap.size;
    social.qualified = snap.docs.filter(d => d.data().qualified).length;
    changed();
  }, () => {}));
  unsubs.push(fb.onSnapshot(fb.doc(db, 'promo', PROMO.id), snap => { social.promo = snap.exists() ? snap.data() : null; changed(); }, () => {}));
  unsubs.push(fb.onSnapshot(fb.doc(db, 'promoWinners', uid), snap => { social.promoWon = snap.exists() ? snap.data() : null; changed(); }, () => {}));
  unsubs.push(fb.onSnapshot(fb.doc(db, 'profiles', uid), snap => {
    const had = social.profile;
    social.profile = snap.exists() ? snap.data() : null;
    changed();
    if (!had && social.profile && remoteLoaded) scheduleSync(); // ник появился — обновим поиск
  }));

  // Личные привычки: при входе объединяем с тем, что уже есть на устройстве.
  const userRef = fb.doc(db, 'users', uid);
  let first;
  try { first = await fb.getDoc(userRef); } catch (err) {
    if (auth.currentUser?.uid !== uid) return;   // пока грузились, вошли в другой аккаунт
    throw err;
  }
  if (auth.currentUser?.uid !== uid) return;
  const local = hooks.getState();
  const merged = first.exists() ? mergeStates(first.data(), local) : local;
  social.settings = { ...DEFAULT_SETTINGS, realName: social.user.displayName, ...(first.data()?.settings || {}) };
  social.joined = first.data()?.tournaments || [];
  hooks.setState(merged);
  remoteLoaded = true;
  if (!first.data()?.settings) await fb.setDoc(userRef, { settings: social.settings }, { merge: true });
  await pushNow();

  unsubs.push(fb.onSnapshot(userRef, snap => {
    if (snap.metadata.hasPendingWrites || !snap.exists()) return;
    const data = snap.data();
    social.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    social.joined = data.tournaments || [];
    if (data.client !== clientId && data.habits) {
      hooks.setState({ habits: data.habits, rewards: data.rewards || hooks.getState().rewards });  // изменения с другого устройства
      syncChallenges();
    }
    changed();
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
      .sort((a, b) => a.nickname.localeCompare(b.nickname));
    watchFriendStats();
    changed();
  }));
  unsubs.push(fb.onSnapshot(fb.query(fb.collection(db, 'challenges'), fb.where('participants', 'array-contains', uid)), snap => {
    if (snap.metadata.hasPendingWrites) return; // ждём подтверждения сервера
    social.challenges = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    changed();
    syncChallenges();
    hooks.onIncomingChallenges?.(social.challenges.filter(c => c.status === 'pending' && c.participants[1] === uid));
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
    const rh = out.find(h => keyOf(h) === keyOf(lh));
    if (rh) {
      Object.assign(rh.done, lh.done);
      if (lh.goal && !rh.goal) rh.goal = lh.goal;
      if (lh.reminders?.length && !rh.reminders?.length) rh.reminders = lh.reminders;
      if (lh.created && (!rh.created || lh.created < rh.created)) rh.created = lh.created;
    } else {
      out.push({ ...lh, done: { ...lh.done } });
    }
  }
  // Пазл: берём ту копию, где собрано больше (заморозки × 7 + кусочки).
  const score = r => r ? (r.freezes || 0) * 7 + (r.pieces || 0) : -1;
  const rewards = score(remote.rewards) >= score(local.rewards) ? remote.rewards : local.rewards;
  return { habits: out, ...(rewards ? { rewards } : {}) };
}

// ---------- Сохранение ----------

// Вызывается после каждого изменения привычек.
export function scheduleSync() {
  if (!social.user || !remoteLoaded) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 600);
}

function statsList(state) {
  const today = dateKey(new Date());
  return state.habits.map(h => {
    const s = streaks(h, today);
    return { key: keyOf(h), name: h.name, cur: s.current, end: s.end, best: s.best, goal: h.goal || null };
  });
}

async function pushNow() {
  if (!social.user) return;
  const uid = social.user.uid;
  const state = hooks.getState();
  const stats = statsList(state);
  const { showName, realName, discoverable } = social.settings;
  try {
    const batch = fb.writeBatch(db);
    batch.set(fb.doc(db, 'users', uid), { habits: state.habits, rewards: state.rewards || null, client: clientId, updatedAt: fb.serverTimestamp() }, { merge: true });
    // Друзья видят серии и (если разрешено) настоящее имя.
    batch.set(fb.doc(db, 'stats', uid), { habits: stats, realName: showName ? realName : '', updatedAt: fb.serverTimestamp() });
    // Поиск единомышленников: только ник и серии, и только если человек согласился.
    if (discoverable && social.profile) {
      batch.set(fb.doc(db, 'discover', uid), {
        nickname: social.profile.nickname,
        keys: [...new Set(stats.map(s => s.key))].slice(0, 50),
        habits: stats.map(({ key, name, cur, end, best }) => ({ key, name, cur, end, best })),
        updatedAt: fb.serverTimestamp(),
      });
    } else {
      batch.delete(fb.doc(db, 'discover', uid));
    }
    await batch.commit();
    await syncChallenges();
    await syncTournaments();
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
    const habit = state.habits.find(h => keyOf(h) === normKey(ch.habitKey));
    const p = challengeProgress(habit, ch.startDay, ch.days, today);
    const old = ch.progress?.[uid];
    if (old && old.count === p.count && old.completed === p.completed && old.failed === p.failed) continue;
    try {
      await fb.updateDoc(fb.doc(db, 'challenges', ch.id), { [`progress.${uid}`]: p });
    } catch (e) { console.error('challenge sync failed', e); }
  }
}

// ---------- Пуш-уведомления: токены телефонов ----------
// pushTokens/{uid} = { tokens: [...], lang } — читает серверная функция, чтобы отправить пуш.

export async function savePushToken(token, lang) {
  if (!social.user || !token) return;
  await fb.setDoc(fb.doc(db, 'pushTokens', social.user.uid), { tokens: fb.arrayUnion(token), lang }, { merge: true });
}

export async function removePushToken(token) {
  if (!social.user || !token) return;
  try { await fb.updateDoc(fb.doc(db, 'pushTokens', social.user.uid), { tokens: fb.arrayRemove(token) }); } catch (e) {}
}

// ---------- Профиль и настройки ----------

export const NICK_RE = /^[a-z0-9_]{3,20}$/;

// inviteCode — код ссылки, по которой человек пришёл: пригласивший получает бонус за нового пользователя.
export async function claimNickname(nickname, inviteCode = null) {
  const uid = social.user.uid;
  nickname = nickname.trim().toLowerCase().replace(/^@/, '');
  if (!NICK_RE.test(nickname)) throw new Error(I.t('err.nick'));
  if (social.profile?.nickname === nickname) return;
  const ref = fb.doc(db, 'usernames', nickname);
  const taken = await fb.getDoc(ref);
  if (taken.exists() && taken.data().uid !== uid) throw new Error(I.t('err.nickTaken', { nick: nickname }));
  const batch = fb.writeBatch(db);
  if (social.profile) batch.delete(fb.doc(db, 'usernames', social.profile.nickname));
  if (!taken.exists()) batch.set(ref, { uid });
  batch.set(fb.doc(db, 'profiles', uid), { nickname });
  // у друзей обновляем ник в их списке
  for (const f of social.friends) batch.update(fb.doc(db, 'users', f.uid, 'friends', uid), { nickname });
  // Новый пользователь по ссылке-приглашению — засчитываем пригласившему.
  if (!social.profile && inviteCode) {
    try {
      const inv = await fb.getDoc(fb.doc(db, 'invites', inviteCode));
      if (inv.exists() && inv.data().from !== uid) {
        batch.set(fb.doc(db, 'referrals', uid), { by: inv.data().from, code: inviteCode, createdAt: fb.serverTimestamp() });
      }
    } catch (e) { console.error('referral check failed', e); }
  }
  await batch.commit();
  social.profile = { nickname };
  await pushNow();
}

export async function saveSettings(patch) {
  social.settings = { ...social.settings, ...patch };
  social.settings.realName = (social.settings.realName || '').trim().slice(0, 40);
  await fb.setDoc(fb.doc(db, 'users', social.user.uid), { settings: social.settings }, { merge: true });
  await pushNow();
}

// ---------- Друзья ----------

export async function sendFriendRequest(nickname) {
  const me = social.user.uid;
  nickname = nickname.trim().toLowerCase().replace(/^@/, '');
  if (!nickname) return;
  if (nickname === social.profile.nickname) throw new Error(I.t('err.ownNick'));
  const u = await fb.getDoc(fb.doc(db, 'usernames', nickname));
  if (!u.exists()) throw new Error(I.t('err.userNotFound', { nick: nickname }));
  return sendFriendRequestTo({ uid: u.data().uid, nickname });
}

export async function sendFriendRequestTo(person) {
  const me = social.user.uid;
  const to = person.uid;
  if (social.friends.some(f => f.uid === to)) throw new Error(I.t('err.alreadyFriend', { nick: person.nickname }));
  const reverse = social.incoming.find(r => r.from === to);
  if (reverse) { await respondFriendRequest(reverse, true); return 'accepted'; }
  await fb.setDoc(fb.doc(db, 'friendRequests', `${me}_${to}`), {
    from: me, to, fromNick: social.profile.nickname, toNick: person.nickname, createdAt: fb.serverTimestamp(),
  });
  return 'sent';
}

export async function respondFriendRequest(req, accept) {
  const me = social.user.uid;
  const batch = fb.writeBatch(db);
  if (accept) {
    batch.set(fb.doc(db, 'users', me, 'friends', req.from), { nickname: req.fromNick, since: fb.serverTimestamp() });
    batch.set(fb.doc(db, 'users', req.from, 'friends', me), { nickname: social.profile.nickname, since: fb.serverTimestamp() });
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

// ---------- Поиск людей с такими же привычками ----------

export async function findSimilar(perHabit = 15) {
  const me = social.user.uid;
  const mine = statsList(hooks.getState());
  const keys = [...new Set(mine.map(s => s.key))].slice(0, 10);
  const people = new Map();
  await Promise.all(keys.map(async key => {
    const snap = await fb.getDocs(fb.query(fb.collection(db, 'discover'), fb.where('keys', 'array-contains', key), fb.limit(perHabit)));
    for (const d of snap.docs) {
      if (d.id === me) continue;
      const data = d.data();
      if (!people.has(d.id)) people.set(d.id, { uid: d.id, nickname: data.nickname, habits: data.habits || [], updated: data.updatedAt?.toMillis?.() || 0 });
    }
  }));
  const myKeys = new Set(keys);
  return [...people.values()]
    .map(p => ({ ...p, common: p.habits.filter(h => myKeys.has(normKey(h.key))) }))
    .sort((a, b) => b.common.length - a.common.length || a.nickname.localeCompare(b.nickname))
    .slice(0, 30);
}

// Случайные соперники: люди с такими же привычками, которые недавно заходили.
export async function suggestOpponents(count = 5) {
  const all = await findSimilar(60);
  const friendIds = new Set(social.friends.map(f => f.uid));
  const weekAgo = Date.now() - 21 * 86400000;
  const fresh = all.filter(p => !friendIds.has(p.uid) && p.common.length && (!p.updated || p.updated > weekAgo));
  for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
  return fresh.slice(0, count);
}

// ---------- Турниры ----------
// Отметки турнира хранятся на сервере: checks[номер дня] = время сервера. Задним числом не отметить —
// правила принимают отметку только за «сегодня» (±1 день на часовые пояса) и только с временем сервера.

const lastTournamentWrite = {};

function myDoneToday(t) {
  const habit = hooks.getState().habits.find(h => keyOf(h) === t.habitKey);
  return !!habit?.done[dateKey(new Date())];
}

export async function joinTournament(t, ensureHabit) {
  const uid = social.user.uid;
  ensureHabit(t.habit);
  const batch = fb.writeBatch(db);
  batch.set(fb.doc(db, 'tournaments', t.id, 'participants', uid), {
    nickname: social.profile.nickname, count: 0, completed: false, failed: false, checks: {},
    joinedAt: fb.serverTimestamp(), updatedAt: fb.serverTimestamp(),
  });
  batch.set(fb.doc(db, 'users', uid), { tournaments: fb.arrayUnion(t.id) }, { merge: true });
  await batch.commit();
  social.joined = [...new Set([...social.joined, t.id])];
  delete lastTournamentWrite[t.id];
  await syncTournaments();   // если сегодня уже отмечено — сразу засчитываем
}

export async function leaveTournament(t) {
  const uid = social.user.uid;
  const batch = fb.writeBatch(db);
  batch.delete(fb.doc(db, 'tournaments', t.id, 'participants', uid));
  batch.set(fb.doc(db, 'users', uid), { tournaments: fb.arrayRemove(t.id) }, { merge: true });
  await batch.commit();
  social.joined = social.joined.filter(x => x !== t.id);
}

// Таблица лидеров считается по отметкам на сервере; дни с фото, которые участники сочли
// неправдоподобными (FLAG_LIMIT отметок), не засчитываются.
export async function loadLeaderboard(t) {
  const me = social.user?.uid;
  const [ps, phs] = await Promise.all([
    fb.getDocs(fb.query(fb.collection(db, 'tournaments', t.id, 'participants'), fb.limit(300))),
    fb.getDocs(fb.query(fb.collection(db, 'tournaments', t.id, 'photos'), fb.orderBy('createdAt', 'desc'), fb.limit(200))),
  ]);
  let photos = phs.docs.map(d => ({ id: d.id, ...d.data() }));
  // Турнир закончился — фото удаляем (правила разрешают это любому участнику после срока).
  const expired = photos.filter(p => p.expires !== undefined && todayNumber() > p.expires);
  if (expired.length) {
    try {
      const batch = fb.writeBatch(db);
      expired.forEach(p => batch.delete(fb.doc(db, 'tournaments', t.id, 'photos', p.id)));
      await batch.commit();
    } catch (e) { console.error('tournament photo cleanup failed', e); }
  }
  const rejected = {}, photoCount = {};
  for (const p of photos) {
    if ((p.flags || []).length >= FLAG_LIMIT) (rejected[p.uid] ||= new Set()).add(p.day);
    else photoCount[p.uid] = (photoCount[p.uid] || 0) + 1;
  }
  const today = todayNumber();
  const rows = ps.docs.map(d => {
    const data = d.data();
    return { uid: d.id, nickname: data.nickname, checks: data.checks || {}, photos: photoCount[d.id] || 0,
      ...tourProgress(data.checks || {}, t, today, rejected[d.id]) };
  }).sort((a, b) => b.count - a.count || b.photos - a.photos || a.nickname.localeCompare(b.nickname));
  const idx = rows.findIndex(r => r.uid === me);
  return { rows, top: rows.slice(0, 10), total: rows.length, myPlace: idx >= 0 ? idx + 1 : null, me: rows[idx] || null, photos };
}

// Сегодняшняя отметка привычки → отметка в турнире (или снятие отметки).
async function syncTournaments() {
  if (!social.user || !social.profile) return;
  const uid = social.user.uid;
  const today = todayNumber();
  for (const id of social.joined) {
    const t = tournamentById(id);
    if (t && today >= t.startDay + t.days) { cleanupOwnTournamentPhotos(t); continue; } // закончился — убираем свои фото
    if (!t || today < t.startDay) continue; // турнир ещё не начался
    const done = myDoneToday(t);
    const key = today + ':' + done;
    if (lastTournamentWrite[id] === key) continue;
    try {
      const ref = fb.doc(db, 'tournaments', id, 'participants', uid);
      const snap = await fb.getDoc(ref);
      if (!snap.exists()) continue;
      const checks = { ...(snap.data().checks || {}) };
      const has = !!checks[String(today)];
      if (has !== done) {
        if (done) checks[String(today)] = true; else delete checks[String(today)];
        const p = tourProgress(checks, t, today);
        await fb.updateDoc(ref, {
          [`checks.${today}`]: done ? fb.serverTimestamp() : fb.deleteField(),
          count: p.count, completed: p.completed, failed: p.failed, updatedAt: fb.serverTimestamp(),
        });
        hooks.onTournament?.(id);
      }
      lastTournamentWrite[id] = key;
    } catch (e) { console.error('tournament sync failed', e); }
  }
}

const cleanedTournaments = new Set();
async function cleanupOwnTournamentPhotos(t) {
  if (cleanedTournaments.has(t.id)) return;
  cleanedTournaments.add(t.id);
  try {
    const mine = await fb.getDocs(fb.query(fb.collection(db, 'tournaments', t.id, 'photos'), fb.where('uid', '==', social.user.uid)));
    for (const d of mine.docs) await fb.deleteDoc(d.ref);
  } catch (e) { console.error(e); }
}

// Фото-подтверждение за сегодня (сжатое изображение, data URL).
export async function addTournamentPhoto(t, image) {
  const uid = social.user.uid;
  const day = String(todayNumber());
  await fb.setDoc(fb.doc(db, 'tournaments', t.id, 'photos', `${uid}_${day}`), {
    uid, nickname: social.profile.nickname, day, image, createdAt: fb.serverTimestamp(), flags: [],
    expires: t.startDay + t.days - 1,   // на следующий день после конца турнира фото удаляются
  });
}

export async function flagPhoto(t, photo) {
  await fb.updateDoc(fb.doc(db, 'tournaments', t.id, 'photos', photo.id), { flags: fb.arrayUnion(social.user.uid) });
}

// ---------- Вызовы ----------

// target — друг или человек из поиска: { uid, nickname }
export async function createChallenge(target, habitName, days, photoRequired = false) {
  const me = social.user.uid;
  await fb.addDoc(fb.collection(db, 'challenges'), {
    participants: [me, target.uid],
    names: { [me]: social.profile.nickname, [target.uid]: target.nickname },
    habitName, habitKey: keyOfName(habitName), days, photoRequired: !!photoRequired,
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
  const habit = hooks.getState().habits.find(h => keyOf(h) === normKey(ch.habitKey));
  await fb.updateDoc(fb.doc(db, 'challenges', ch.id), {
    status: 'active', startDay: today,
    [`progress.${me}`]: challengeProgress(habit, today, ch.days, today),
  });
}

export async function deleteChallenge(ch) {
  await cleanupChallengePhotos(ch);   // сначала фото — пока вызов существует, правила разрешают их удалить
  await fb.deleteDoc(fb.doc(db, 'challenges', ch.id));
}

// ---------- Фото в вызовах с обязательным подтверждением ----------
// challenges/{id}/photos/{uid}_{день}. Засчитываются только дни с фото, добавленным в тот же день.

export async function loadChallengePhotos(ch) {
  const snap = await fb.getDocs(fb.collection(db, 'challenges', ch.id, 'photos'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addChallengePhoto(ch, image) {
  const uid = social.user.uid;
  const day = String(todayNumber());
  await fb.setDoc(fb.doc(db, 'challenges', ch.id, 'photos', `${uid}_${day}`), {
    uid, day, image, createdAt: fb.serverTimestamp(), expires: ch.startDay + ch.days - 1,
  });
}

// Вызов закончился или удаляется — фото больше не нужны.
export async function cleanupChallengePhotos(ch) {
  try {
    const snap = await fb.getDocs(fb.collection(db, 'challenges', ch.id, 'photos'));
    if (!snap.size) return;
    const batch = fb.writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (e) { console.error('challenge photo cleanup failed', e); }
}

// ---------- Приглашения по ссылке (WhatsApp и т. п.) ----------

function randomCode() {
  const a = new Uint8Array(15);
  crypto.getRandomValues(a);
  return [...a].map(b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}

// Возвращает ссылку сразу (чтобы можно было открыть WhatsApp без задержки), а запись идёт в фоне.
export function createInvite(habitName = null, days = null, photoRequired = false) {
  const code = randomCode();
  const url = `${appUrl()}?invite=${code}`;
  const saved = fb.setDoc(fb.doc(db, 'invites', code), {
    from: social.user.uid, nickname: social.profile.nickname,
    habitName, habitKey: habitName ? keyOfName(habitName) : null, days, photoRequired: !!(habitName && photoRequired),
    createdAt: fb.serverTimestamp(),
  });
  return { code, url, saved };
}

export async function getInvite(code) {
  const snap = await fb.getDoc(fb.doc(db, 'invites', code));
  return snap.exists() ? { code, ...snap.data() } : null;
}

export async function acceptInvite(inv, ensureHabit) {
  const me = social.user.uid;
  if (inv.from === me) throw new Error(I.t('err.ownInvite'));
  const batch = fb.writeBatch(db);
  if (!social.friends.some(f => f.uid === inv.from)) {
    batch.set(fb.doc(db, 'users', me, 'friends', inv.from), { nickname: inv.nickname, since: fb.serverTimestamp(), invite: inv.code });
    batch.set(fb.doc(db, 'users', inv.from, 'friends', me), { nickname: social.profile.nickname, since: fb.serverTimestamp(), invite: inv.code });
  }
  if (inv.habitName) {
    ensureHabit(inv.habitName);
    const today = todayNumber();
    const habit = hooks.getState().habits.find(h => keyOf(h) === normKey(inv.habitKey));
    batch.set(fb.doc(fb.collection(db, 'challenges')), {
      participants: [inv.from, me],
      names: { [inv.from]: inv.nickname, [me]: social.profile.nickname },
      habitName: inv.habitName, habitKey: inv.habitKey, days: inv.days, photoRequired: !!inv.photoRequired,
      status: 'active', startDay: today, progress: { [me]: challengeProgress(habit, today, inv.days, today) },
      invite: inv.code, createdAt: fb.serverTimestamp(),
    });
  }
  await batch.commit();
}

// ---------- Удаление аккаунта (обязательно для App Store) ----------

export async function deleteAccount() {
  const user = auth.currentUser;
  const uid = user.uid;
  const myInvites = await fb.getDocs(fb.query(fb.collection(db, 'invites'), fb.where('from', '==', uid)));
  const batch = fb.writeBatch(db);
  for (const f of social.friends) {
    batch.delete(fb.doc(db, 'users', uid, 'friends', f.uid));
    batch.delete(fb.doc(db, 'users', f.uid, 'friends', uid));
  }
  for (const r of [...social.incoming, ...social.outgoing]) batch.delete(fb.doc(db, 'friendRequests', r.id));
  for (const c of social.challenges) {
    await cleanupChallengePhotos(c);
    batch.delete(fb.doc(db, 'challenges', c.id));
  }
  for (const d of myInvites.docs) batch.delete(d.ref);
  for (const id of social.joined) batch.delete(fb.doc(db, 'tournaments', id, 'participants', uid));
  for (const id of social.joined) {
    try {
      const mine = await fb.getDocs(fb.query(fb.collection(db, 'tournaments', id, 'photos'), fb.where('uid', '==', uid)));
      for (const d of mine.docs) batch.delete(d.ref);
    } catch (e) {}
  }
  if (social.profile) batch.delete(fb.doc(db, 'usernames', social.profile.nickname));
  for (const col of ['profiles', 'stats', 'discover', 'users', 'referrals', 'pushTokens']) batch.delete(fb.doc(db, col, uid));
  stopListeners();
  await batch.commit();
  try {
    await fb.deleteUser(user);
  } catch (e) {
    if (e.code === 'auth/requires-recent-login') {
      if (isNative) await fb.reauthenticateWithCredential(user, fb.GoogleAuthProvider.credential(await nativeGoogleIdToken()));
      else await fb.reauthenticateWithPopup(user, providerFor(user));
      await fb.deleteUser(user);
    } else throw e;
  }
}

function providerFor(user) {
  const id = user.providerData[0]?.providerId;
  return id === 'apple.com' ? new fb.OAuthProvider('apple.com') : new fb.GoogleAuthProvider();
}

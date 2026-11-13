// YouBoost — серверные функции Firebase.
// Пуш-уведомления (Firebase Cloud Messaging), когда пользователю бросают вызов или присылают заявку в друзья.
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 5 });   // база в мультирегионе eur3 → функции в europe-west1

const TEXT = {
  ru: {
    challenge: (from, habit, days) => ({ title: '⚔️ Вам бросили вызов!', body: `@${from}: «${habit}» — ${days} дн. подряд. Принимаете?` }),
    friend: (from) => ({ title: '👋 Заявка в друзья', body: `@${from} хочет добавить вас в друзья` }),
    promo: (days) => ({ title: '🎁 Вам подарок — YouBoost Plus!', body: `Двое ваших друзей уже с нами. Plus включён на ${days} дней.` }),
  },
  en: {
    challenge: (from, habit, days) => ({ title: '⚔️ You’ve been challenged!', body: `@${from}: "${habit}" — ${days} days in a row. Accept?` }),
    friend: (from) => ({ title: '👋 Friend request', body: `@${from} wants to be your friend` }),
    promo: (days) => ({ title: '🎁 A gift for you — YouBoost Plus!', body: `Two of your friends have joined. Plus is on for ${days} days.` }),
  },
};

// Отправить пуш на все телефоны пользователя; недействительные токены — удалить.
async function sendTo(uid, build, data) {
  const ref = getFirestore().doc(`pushTokens/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const { tokens = [], lang = 'ru' } = snap.data();
  if (!tokens.length) return;
  const { title, body } = build(TEXT[lang] || TEXT.en);
  if (process.env.FUNCTIONS_EMULATOR === 'true') {   // в эмуляторе не отправляем, только пишем в журнал
    console.log('PUSH ' + JSON.stringify({ uid, title, body, tokens, data }));
    return;
  }
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    android: { priority: 'high', notification: { channelId: 'default', sound: 'default' } },
  });
  const bad = tokens.filter((_, i) => {
    const code = res.responses[i].error?.code || '';
    return code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument');
  });
  if (bad.length) await ref.update({ tokens: FieldValue.arrayRemove(...bad) });
}

// Новый вызов → пуш тому, кому его бросили.
exports.onChallengeCreated = onDocumentCreated('challenges/{id}', async (event) => {
  const ch = event.data?.data();
  if (!ch || ch.status !== 'pending' || !Array.isArray(ch.participants)) return;
  const [from, to] = ch.participants;
  const name = ch.names?.[from] || '';
  await sendTo(to, t => t.challenge(name, ch.habitName, ch.days), { type: 'challenge', id: event.params.id });
});

// Новая заявка в друзья → пуш получателю.
exports.onFriendRequestCreated = onDocumentCreated('friendRequests/{id}', async (event) => {
  const r = event.data?.data();
  if (!r?.to) return;
  await sendTo(r.to, t => t.friend(r.fromNick || ''), { type: 'friend', id: event.params.id });
});

// ---------- Акция «Пригласите 2 друзей — 3 месяца Plus» ----------
// Друг засчитывается, когда зарегистрировался по ссылке (referrals/{друг}) и отметил привычки
// в 3 разных дня после регистрации. Первые LIMIT пригласивших по NEED засчитанных друзей получают
// Plus на DAYS дней (документ plus/{uid}). Настройки акции должны совпадать с PROMO в js/plans.js.
const PROMO = { id: 'invite2', limit: 10, need: 2, activeDays: 3, days: 90 };
const DAY = 86400000;
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);

// Сколько разных дней друг отмечал привычки после регистрации (даты отметок — местные, поэтому запас ±12–14 ч).
function activeDays(habits, sinceMs, nowMs) {
  const from = isoDay(sinceMs - 12 * 3600000), to = isoDay(nowMs + 14 * 3600000);
  const days = new Set();
  for (const h of Array.isArray(habits) ? habits : []) {
    for (const [k, v] of Object.entries(h?.done || {})) if (v && /^\d{4}-\d\d-\d\d$/.test(k) && k >= from && k <= to) days.add(k);
  }
  return days.size;
}

async function maybeReward(inviter) {
  const db = getFirestore();
  const promoRef = db.doc(`promo/${PROMO.id}`);
  const winRef = db.doc(`promoWinners/${inviter}`);
  const plusRef = db.doc(`plus/${inviter}`);
  return db.runTransaction(async tx => {
    const [promo, win, plus, qualified] = await Promise.all([
      tx.get(promoRef), tx.get(winRef), tx.get(plusRef),
      tx.get(db.collection('referrals').where('by', '==', inviter).where('qualified', '==', true)),
    ]);
    const count = promo.exists ? promo.data().count || 0 : 0;
    const limit = promo.exists && promo.data().limit ? promo.data().limit : PROMO.limit;
    if (win.exists || qualified.size < PROMO.need || count >= limit || (promo.exists && promo.data().active === false)) return false;
    const now = Date.now();
    const base = Math.max(now, plus.exists && plus.data().until ? plus.data().until.toMillis() : 0);
    const until = Timestamp.fromMillis(base + PROMO.days * DAY);
    tx.set(plusRef, { until, source: PROMO.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(winRef, { promo: PROMO.id, place: count + 1, until, at: FieldValue.serverTimestamp() });
    tx.set(promoRef, { count: count + 1, limit, need: PROMO.need, activeDays: PROMO.activeDays, days: PROMO.days, active: count + 1 < limit }, { merge: true });
    return true;
  });
}

// Любое изменение привычек пользователя: если он приглашённый и ещё не засчитан — проверяем 3 дня.
exports.onUserWritten = onDocumentWritten('users/{uid}', async (event) => {
  const after = event.data?.after?.data();
  if (!after) return;
  const uid = event.params.uid;
  const ref = getFirestore().doc(`referrals/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const r = snap.data();
  if (!r.qualified) {
    const since = r.createdAt?.toMillis?.();
    if (!since || activeDays(after.habits, since, Date.now()) < PROMO.activeDays) return;
    await ref.update({ qualified: true, qualifiedAt: FieldValue.serverTimestamp() });
  }
  const won = await maybeReward(r.by);
  if (won) await sendTo(r.by, t => t.promo(PROMO.days), { type: 'promo' }).catch(() => {});
});

// Удалён аккаунт → удаляем то, что приложение само удалить не может (пишет только сервер).
const functionsV1 = require('firebase-functions/v1');
exports.onAccountDeleted = functionsV1.region('europe-west1').auth.user().onDelete(async (user) => {
  const db = getFirestore();
  await Promise.all([db.doc(`plus/${user.uid}`).delete(), db.doc(`promoWinners/${user.uid}`).delete()]);
});

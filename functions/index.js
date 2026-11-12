// YouBoost — серверные функции Firebase.
// Пуш-уведомления (Firebase Cloud Messaging), когда пользователю бросают вызов или присылают заявку в друзья.
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 5 });   // база в мультирегионе eur3 → функции в europe-west1

const TEXT = {
  ru: {
    challenge: (from, habit, days) => ({ title: '⚔️ Вам бросили вызов!', body: `@${from}: «${habit}» — ${days} дн. подряд. Принимаете?` }),
    friend: (from) => ({ title: '👋 Заявка в друзья', body: `@${from} хочет добавить вас в друзья` }),
  },
  en: {
    challenge: (from, habit, days) => ({ title: '⚔️ You’ve been challenged!', body: `@${from}: "${habit}" — ${days} days in a row. Accept?` }),
    friend: (from) => ({ title: '👋 Friend request', body: `@${from} wants to be your friend` }),
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

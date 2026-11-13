// Бесплатный тариф, бонусы и подписка YouBoost Plus. Поменять лимиты — здесь.
export const PLANS = {
  limitsEnabled: true,   // false — без ограничений для всех
  freeGoals: 3,          // активных целей бесплатно
  bonusPerReferral: 1,   // +целей за каждого друга, зарегистрировавшегося по вашей ссылке
  // Привычки, вызовы и турниры — без ограничений.

  // Пока оплата через Google Play не подключена — в настройках есть кнопка «Попробовать Plus»
  // (включает Plus на этом устройстве на trialDays дней). Перед публикацией в Play — false.
  testTrial: true,
  trialDays: 7,
};

// Акция «Пригласите 2 друзей — 3 месяца Plus». Награду выдаёт сервер (functions/index.js, те же числа).
// Выключить показ — enabled: false; закончить досрочно — поле active: false в документе promo/invite2.
export const PROMO = { enabled: true, id: 'invite2', limit: 10, need: 2, activeDays: 3, months: 3 };

// Что входит в Plus (порядок = порядок в карточке настроек)
export const PLUS_FEATURES = ['goals', 'stats', 'tips', 'reminders', 'risk'];

const TRIAL_KEY = 'youboost-plus-trial';
let serverUntil = 0;   // мс; выдаёт сервер (акции, позже — оплата), документ plus/{uid}

export function setServerPlus(untilMs) { serverUntil = untilMs || 0; }

function trialUntil() {
  try { return Number(localStorage.getItem(TRIAL_KEY)) || 0; } catch (err) { return 0; }
}

export function startTrial() {
  const until = Date.now() + PLANS.trialDays * 86400000;
  try { localStorage.setItem(TRIAL_KEY, String(until)); } catch (err) {}
}

export function trialUsed() { return trialUntil() > 0; }

// До какого момента действует Plus (мс) или 0
export function plusUntil() {
  const until = Math.max(serverUntil, PLANS.testTrial ? trialUntil() : 0);
  return until > Date.now() ? until : 0;
}

export function hasPlus() { return plusUntil() > 0; }

export function goalLimit(referrals = 0) {
  if (!PLANS.limitsEnabled || hasPlus()) return Infinity;
  return PLANS.freeGoals + referrals * PLANS.bonusPerReferral;
}

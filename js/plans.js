// Бесплатный тариф и бонусы. Поменять лимиты — здесь.
export const PLANS = {
  limitsEnabled: true,   // false — без ограничений для всех
  freeGoals: 2,          // активных целей бесплатно
  bonusPerReferral: 1,   // +целей за каждого друга, зарегистрировавшегося по вашей ссылке
  // Привычки, вызовы и турниры — без ограничений.
};

// Подписка YouBoost Plus появится вместе с оплатой (Google Play); пока ни у кого её нет.
export function hasPlus() { return false; }

export function goalLimit(referrals = 0) {
  if (!PLANS.limitsEnabled || hasPlus()) return Infinity;
  return PLANS.freeGoals + referrals * PLANS.bonusPerReferral;
}

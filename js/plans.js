// Бесплатный тариф и бонусы. Поменять лимиты — здесь.
export const PLANS = {
  limitsEnabled: true,   // false — без ограничений для всех
  freeHabits: 5,         // привычек бесплатно
  bonusPerReferral: 1,   // +привычек за каждого друга, зарегистрировавшегося по вашей ссылке
  freeGoals: 2,          // активных целей бесплатно
};

// Подписка YouBoost Plus появится вместе с оплатой; пока ни у кого её нет.
export function hasPlus() { return false; }

export function habitLimit(referrals = 0) {
  if (!PLANS.limitsEnabled || hasPlus()) return Infinity;
  return PLANS.freeHabits + referrals * PLANS.bonusPerReferral;
}

export function goalLimit() {
  if (!PLANS.limitsEnabled || hasPlus()) return Infinity;
  return PLANS.freeGoals;
}

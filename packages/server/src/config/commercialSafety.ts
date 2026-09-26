/** Phase 7A: configuration contracts only. There is no real-money adapter or rail. */
export const COMMERCIAL_SWITCHES = {
  money: 'REAL_MONEY_ENABLED',
  deposits: 'REAL_MONEY_DEPOSITS_ENABLED',
  withdrawals: 'REAL_MONEY_WITHDRAWALS_ENABLED',
  competitions: 'REAL_MONEY_COMPETITIONS_ENABLED',
} as const;

export type CommercialAction = 'deposits' | 'withdrawals' | 'competitions';

export function commercialGate(action: CommercialAction, env: NodeJS.ProcessEnv = process.env) {
  if (env[COMMERCIAL_SWITCHES.money] !== 'true') return { allowed: false, reason: 'MONEY_DISABLED' } as const;
  if (env[COMMERCIAL_SWITCHES[action]] !== 'true') return { allowed: false, reason: 'ACTION_DISABLED' } as const;
  // Deliberately cannot be enabled by environment configuration in this release.
  return { allowed: false, reason: 'COMMERCIAL_IMPLEMENTATION_NOT_ACCEPTED' } as const;
}

export function getCommercialSafety(env: NodeJS.ProcessEnv = process.env) {
  return {
    implementation: 'unavailable' as const,
    moneyEnabled: false,
    deposits: commercialGate('deposits', env),
    withdrawals: commercialGate('withdrawals', env),
    competitions: commercialGate('competitions', env),
  };
}

export function validateCommercialSafety(env: NodeJS.ProcessEnv): string[] {
  const errors: string[] = [];
  for (const key of Object.values(COMMERCIAL_SWITCHES)) {
    if (env[key] !== undefined && env[key] !== 'false') {
      errors.push(`${key} must be false or absent: commercial money is unavailable in this release.`);
    }
  }
  // Reserved provider-independent names. Future integrations must extend this
  // contract and use separate provider accounts/secret stores, not just flags.
  for (const key of ['PAYMENT_PROVIDER_SECRET', 'PAYMENT_WEBHOOK_SECRET', 'PAYOUT_PROVIDER_SECRET']) {
    if (env[key]) errors.push(`${key} must be absent until a commercial integration is accepted.`);
  }
  return errors;
}

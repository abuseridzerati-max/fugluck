import type { RiskSignal } from './eligibility';

/** Facts must come from trusted server/provider history, never browser declarations. */
export type RiskFacts = {
  accountsOnDevice:number;financialOperationsInWindow:number;failedPaymentsInWindow:number;
  depositToWithdrawalElapsedMs:number|null;withdrawalDestinationChanged:boolean;
  repeatedPromotionClaims:number;recentCredentialReset:boolean;
  intentionalDisconnectCount:number;apiAbuseCount:number;
};
export type RiskThresholds = {
  maxAccountsOnDevice?:number;maxFinancialOperationsInWindow?:number;
  maxFailedPaymentsInWindow?:number;minDepositToWithdrawalElapsedMs?:number;
  maxPromotionClaims?:number;maxIntentionalDisconnects?:number;maxApiAbuseCount?:number;
};
export function deriveRiskSignals(facts:RiskFacts,limits:RiskThresholds):RiskSignal[] {
  const signals:RiskSignal[]=[];
  const over=(value:number,limit:number|undefined)=>limit!==undefined&&Number.isSafeInteger(limit)&&limit>=0&&value>limit;
  if(over(facts.accountsOnDevice,limits.maxAccountsOnDevice)) signals.push('MULTI_ACCOUNT');
  if(over(facts.financialOperationsInWindow,limits.maxFinancialOperationsInWindow)) signals.push('FINANCIAL_VELOCITY');
  if(over(facts.failedPaymentsInWindow,limits.maxFailedPaymentsInWindow)) signals.push('FAILED_PAYMENTS');
  if(limits.minDepositToWithdrawalElapsedMs!==undefined&&facts.depositToWithdrawalElapsedMs!==null&&
     facts.depositToWithdrawalElapsedMs<limits.minDepositToWithdrawalElapsedMs) signals.push('RAPID_FUNDS_CYCLE');
  if(facts.withdrawalDestinationChanged) signals.push('SUSPICIOUS_WITHDRAWAL');
  if(over(facts.repeatedPromotionClaims,limits.maxPromotionClaims)) signals.push('PROMOTION_ABUSE');
  if(facts.recentCredentialReset) signals.push('ACCOUNT_TAKEOVER');
  if(over(facts.intentionalDisconnectCount,limits.maxIntentionalDisconnects)) signals.push('INTENTIONAL_DISCONNECTS');
  if(over(facts.apiAbuseCount,limits.maxApiAbuseCount)) signals.push('API_ABUSE');
  return signals;
}

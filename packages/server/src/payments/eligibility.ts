/** Policy values are operator inputs; no legal threshold or jurisdiction is implied. */
export type FinancialAction = 'DEPOSIT'|'COMPETITION'|'WITHDRAWAL';
export type EligibilityReason = 'ACTION_DISABLED'|'ACCOUNT_INACTIVE'|'IDENTITY_UNVERIFIED'|
  'JURISDICTION_UNAPPROVED'|'LIMIT_EXCEEDED'|'RISK_REVIEW_REQUIRED';
export type RiskSignal = 'MULTI_ACCOUNT'|'FINANCIAL_VELOCITY'|'FAILED_PAYMENTS'|
  'RAPID_FUNDS_CYCLE'|'SUSPICIOUS_WITHDRAWAL'|'PROMOTION_ABUSE'|
  'ACCOUNT_TAKEOVER'|'INTENTIONAL_DISCONNECTS'|'API_ABUSE';
export type EligibilityPolicy = {
  enabled:Record<FinancialAction,boolean>;
  maxSingleMinor:Partial<Record<FinancialAction,number>>;
  requireVerifiedIdentity:Partial<Record<FinancialAction,boolean>>;
  allowedJurisdictions:Partial<Record<FinancialAction,readonly string[]>>;
};
export type EligibilityContext = {
  action:FinancialAction; amountMinor:number; accountActive:boolean;
  identityVerified:boolean; jurisdiction:string; riskSignals:readonly RiskSignal[];
};
export type EligibilityDecision = {allowed:boolean;reasons:EligibilityReason[];reviewSignals:RiskSignal[]};

export const DEFAULT_ELIGIBILITY_POLICY:EligibilityPolicy={
  enabled:{DEPOSIT:false,COMPETITION:false,WITHDRAWAL:false},
  maxSingleMinor:{},requireVerifiedIdentity:{},allowedJurisdictions:{},
};
export function evaluateEligibility(policy:EligibilityPolicy,context:EligibilityContext):EligibilityDecision {
  const reasons:EligibilityReason[]=[];
  if(!policy.enabled[context.action]) reasons.push('ACTION_DISABLED');
  if(!context.accountActive) reasons.push('ACCOUNT_INACTIVE');
  if(policy.requireVerifiedIdentity[context.action]&&!context.identityVerified) reasons.push('IDENTITY_UNVERIFIED');
  const jurisdictions=policy.allowedJurisdictions[context.action];
  if(!jurisdictions||!jurisdictions.includes(context.jurisdiction)) reasons.push('JURISDICTION_UNAPPROVED');
  const max=policy.maxSingleMinor[context.action];
  if(max===undefined||!Number.isSafeInteger(max)||max<=0||context.amountMinor>max) reasons.push('LIMIT_EXCEEDED');
  if(context.riskSignals.length) reasons.push('RISK_REVIEW_REQUIRED');
  return {allowed:reasons.length===0,reasons,reviewSignals:[...context.riskSignals]};
}

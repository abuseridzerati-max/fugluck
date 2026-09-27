import type { ISO4217Currency } from '@fugluck/shared';

export type ProviderStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';
export type ProviderOperation = 'DEPOSIT' | 'PAYOUT' | 'REFUND';
export type ProviderRecord = {
  reference: string;
  operation: ProviderOperation;
  amountMinor: number;
  currency: ISO4217Currency;
  status: ProviderStatus;
  idempotencyKey: string;
};
export type ProviderEvent = ProviderRecord & { eventId: string; occurredAt: string };
export class ProviderError extends Error {
  constructor(public readonly code: 'TIMEOUT'|'UNAVAILABLE'|'REJECTED'|'INVALID_SIGNATURE'|'NOT_FOUND', message:string) { super(message); }
}
export interface PaymentProvider {
  createDeposit(request:{amountMinor:number;currency:ISO4217Currency;idempotencyKey:string}):Promise<ProviderRecord>;
  getDeposit(reference:string):Promise<ProviderRecord>;
  createPayout(request:{amountMinor:number;currency:ISO4217Currency;idempotencyKey:string}):Promise<ProviderRecord>;
  getPayout(reference:string):Promise<ProviderRecord>;
  refund(request:{reference:string;amountMinor:number;currency:ISO4217Currency;idempotencyKey:string}):Promise<ProviderRecord>;
  verifyWebhook(rawBody:string,signature:string):ProviderEvent;
  listRecords():Promise<ProviderRecord[]>;
}

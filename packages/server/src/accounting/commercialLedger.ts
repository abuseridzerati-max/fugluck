/** Candidate financial core. It is deliberately unavailable in hosted runtimes. */
import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { ISO4217Currency } from '@fugluck/shared';
import { isHostedEnvironment } from '../config/deploymentIdentity';
import { stagingMockMode } from '../config/stagingMockCommercial';

export type CommercialAccountKind =
  | 'USER_AVAILABLE' | 'USER_ENTRY_RESERVED' | 'USER_WITHDRAWAL_RESERVED'
  | 'ENTRY_CAPTURED' | 'PLATFORM_MARGIN' | 'PRIZE_OBLIGATION'
  | 'PROMOTIONAL_SUBSIDY' | 'PROVIDER_CLEARING' | 'PROCESSING_FEES'
  | 'FINANCIAL_ADJUSTMENTS' | 'CHARGEBACKS';
export type CommercialAccount = { kind: CommercialAccountKind; userId?: string };
export type FinancialPosting = { account: CommercialAccount; amountMinor: number };
export type FinancialEvent = {
  idempotencyKey: string;
  eventType: string;
  currency: ISO4217Currency;
  actorId: string;
  source: string;
  reason: string;
  referenceId?: string;
  providerReference?: string;
  auditReference?: string;
  postings: FinancialPosting[];
};
export type FinancialReceipt = { transactionId: string; duplicate: boolean; createdAt: Date };

const MAX_MINOR = 9_000_000_000_000_000;
const USER_KINDS = new Set<CommercialAccountKind>(['USER_AVAILABLE','USER_ENTRY_RESERVED','USER_WITHDRAWAL_RESERVED']);
const CURRENCIES = new Set(['GEL','USD','EUR']);

export function assertFinancialAmount(amount: number, allowZero = false): void {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_MINOR || (!allowZero && amount === 0)) {
    throw new Error('Financial amount must be a positive safe integer minor-unit value within bounds');
  }
}
export function assertFinancialCurrency(currency: string): asserts currency is ISO4217Currency {
  if (!CURRENCIES.has(currency)) throw new Error('Unsupported financial currency');
}
function accountId(account: CommercialAccount, currency: ISO4217Currency): string {
  const isUser = USER_KINDS.has(account.kind);
  if (isUser !== Boolean(account.userId) || (account.userId && !/^[a-zA-Z0-9_-]{1,128}$/.test(account.userId))) {
    throw new Error('Invalid financial account owner');
  }
  return isUser ? `user:${account.userId}:${account.kind}:${currency}` : `platform:${account.kind}:${currency}`;
}
function eventHash(event: FinancialEvent): string {
  return createHash('sha256').update(JSON.stringify(event)).digest('hex');
}

export class CommercialLedger {
  constructor(private readonly pool: Pool) {
    if (isHostedEnvironment() && !stagingMockMode()) throw new Error('Commercial ledger is unavailable outside the authorized staging mock mode');
  }

  /** One transaction, one idempotency key, at least two balanced immutable postings. */
  async post(event: FinancialEvent, client?: PoolClient): Promise<FinancialReceipt> {
    if (!client) {
      const acquired = await this.pool.connect();
      try {
        await acquired.query('BEGIN');
        const receipt = await this.post(event, acquired);
        await acquired.query('COMMIT');
        return receipt;
      } catch (error) {
        await acquired.query('ROLLBACK');
        throw error;
      } finally { acquired.release(); }
    }
    assertFinancialCurrency(event.currency);
    if (!event.idempotencyKey || event.idempotencyKey.length > 160 || !event.actorId || !event.source || !event.reason?.trim() || event.postings.length < 2) {
      throw new Error('Financial event metadata or postings missing');
    }
    let sum = 0n;
    for (const posting of event.postings) {
      assertFinancialAmount(Math.abs(posting.amountMinor));
      accountId(posting.account, event.currency);
      sum += BigInt(posting.amountMinor);
    }
    if (sum !== 0n) throw new Error('Unbalanced financial transaction');
    const hash = eventHash(event);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`commercial:${event.idempotencyKey}`]);
    const existing = await client.query<{id:string;request_hash:string;created_at:Date}>(
      'SELECT id, request_hash, created_at FROM commercial_transactions WHERE idempotency_key=$1', [event.idempotencyKey]);
    if (existing.rows.length) {
      if (existing.rows[0].request_hash !== hash) throw new Error('Idempotency key reused with different financial request');
      return { transactionId: existing.rows[0].id, duplicate: true, createdAt: existing.rows[0].created_at };
    }
    const accounts = new Map<string, CommercialAccount>();
    for (const posting of event.postings) accounts.set(accountId(posting.account, event.currency), posting.account);
    for (const [id, account] of [...accounts].sort(([a],[b]) => a.localeCompare(b))) {
      await client.query(`INSERT INTO commercial_accounts(id,currency,kind,user_id) VALUES($1,$2,$3,$4)
        ON CONFLICT(id) DO NOTHING`, [id,event.currency,account.kind,account.userId ?? null]);
      const found = await client.query<{currency:string;kind:string;user_id:string|null}>(
        'SELECT currency,kind,user_id FROM commercial_accounts WHERE id=$1 FOR UPDATE', [id]);
      if (found.rows[0]?.currency !== event.currency || found.rows[0]?.kind !== account.kind || found.rows[0]?.user_id !== (account.userId ?? null)) {
        throw new Error('Financial account identity mismatch');
      }
    }
    const transactionId = `ctx_${randomUUID()}`;
    const created = await client.query<{created_at:Date}>(
      `INSERT INTO commercial_transactions(id,idempotency_key,request_hash,event_type,currency,actor_id,source,reason,reference_id,provider_reference,audit_reference)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING created_at`,
      [transactionId,event.idempotencyKey,hash,event.eventType,event.currency,event.actorId,event.source,event.reason,
       event.referenceId ?? null,event.providerReference ?? null,event.auditReference ?? null]);
    for (const posting of event.postings) {
      await client.query('INSERT INTO commercial_postings(transaction_id,account_id,currency,amount_minor) VALUES($1,$2,$3,$4)',
        [transactionId,accountId(posting.account,event.currency),event.currency,posting.amountMinor]);
    }
    return { transactionId, duplicate: false, createdAt: created.rows[0].created_at };
  }

  async balance(account: CommercialAccount, currency: ISO4217Currency, client?: PoolClient): Promise<number> {
    assertFinancialCurrency(currency);
    const executor = client ?? this.pool;
    const result = await executor.query<{balance:string}>(
      'SELECT COALESCE(SUM(amount_minor),0)::text AS balance FROM commercial_postings WHERE account_id=$1 AND currency=$2',
      [accountId(account,currency),currency]);
    const value = Number(result.rows[0].balance);
    if (!Number.isSafeInteger(value)) throw new Error('Financial balance exceeds safe integer range');
    return value;
  }

  /** Corrections are new counter-postings linked to an existing transaction. */
  async compensate(input:{originalTransactionId:string;userId:string;amountMinor:number;currency:ISO4217Currency;
    direction:'CREDIT_USER'|'DEBIT_USER';idempotencyKey:string;adminActorId:string;auditReference:string;reason:string}):Promise<FinancialReceipt> {
    assertFinancialAmount(input.amountMinor);assertFinancialCurrency(input.currency);
    if(!input.adminActorId||!input.auditReference||!input.reason?.trim()) throw new Error('Compensation requires admin actor, audit link, and reason');
    if(input.direction!=='CREDIT_USER'&&input.direction!=='DEBIT_USER') throw new Error('Invalid compensation direction');
    const original=await this.pool.query('SELECT currency FROM commercial_transactions WHERE id=$1',[input.originalTransactionId]);
    if(original.rows[0]?.currency!==input.currency) throw new Error('Original transaction/currency not found');
    const sign=input.direction==='CREDIT_USER'?1:-1;
    return this.post({idempotencyKey:input.idempotencyKey,eventType:'COMPENSATING_ADJUSTMENT',currency:input.currency,
      actorId:input.adminActorId,source:'financial_admin',reason:input.reason,referenceId:input.originalTransactionId,
      auditReference:input.auditReference,postings:[
        {account:{kind:'FINANCIAL_ADJUSTMENTS'},amountMinor:-sign*input.amountMinor},
        {account:{kind:'USER_AVAILABLE',userId:input.userId},amountMinor:sign*input.amountMinor}]});
  }

  async recordProcessingFee(input:{amountMinor:number;currency:ISO4217Currency;providerReference:string;
    idempotencyKey:string;reason:string}):Promise<FinancialReceipt> {
    assertFinancialAmount(input.amountMinor);assertFinancialCurrency(input.currency);
    if(!input.providerReference||!input.reason?.trim()) throw new Error('Processing fee requires provider reference and reason');
    return this.post({idempotencyKey:input.idempotencyKey,eventType:'PROCESSING_FEE',currency:input.currency,
      actorId:'provider',source:'provider_reconciliation',reason:input.reason,providerReference:input.providerReference,
      postings:[{account:{kind:'PROCESSING_FEES'},amountMinor:input.amountMinor},
        {account:{kind:'PROVIDER_CLEARING'},amountMinor:-input.amountMinor}]});
  }

  async recordChargeback(input:{amountMinor:number;currency:ISO4217Currency;providerReference:string;
    idempotencyKey:string;reason:string}):Promise<FinancialReceipt> {
    assertFinancialAmount(input.amountMinor);assertFinancialCurrency(input.currency);
    if(!input.providerReference||!input.reason?.trim()) throw new Error('Chargeback requires provider reference and reason');
    return this.post({idempotencyKey:input.idempotencyKey,eventType:'CHARGEBACK',currency:input.currency,
      actorId:'provider',source:'provider_reconciliation',reason:input.reason,providerReference:input.providerReference,
      postings:[{account:{kind:'CHARGEBACKS'},amountMinor:input.amountMinor},
        {account:{kind:'PROVIDER_CLEARING'},amountMinor:-input.amountMinor}]});
  }

  async reconcile(): Promise<{transactionCount:number; postingCount:number; unbalancedTransactions:number; totalMinor:string}> {
    const result = await this.pool.query<{transaction_count:string;posting_count:string;unbalanced_count:string;total:string}>(`
      SELECT (SELECT count(*) FROM commercial_transactions)::text transaction_count,
             (SELECT count(*) FROM commercial_postings)::text posting_count,
             (SELECT count(*) FROM (SELECT transaction_id FROM commercial_postings GROUP BY transaction_id HAVING sum(amount_minor)<>0 OR count(*)<2) bad)::text unbalanced_count,
             (SELECT COALESCE(sum(amount_minor),0)::text FROM commercial_postings) total`);
    const row = result.rows[0];
    return {transactionCount:Number(row.transaction_count),postingCount:Number(row.posting_count),
      unbalancedTransactions:Number(row.unbalanced_count),totalMinor:row.total};
  }
}

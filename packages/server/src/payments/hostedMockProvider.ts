/** Durable staging-only mock provider facade: no network calls or external funds. */
import { createHmac } from 'node:crypto';
import type { Pool } from 'pg';
import type { ISO4217Currency } from '@fugluck/shared';
import { stagingMockMode } from '../config/stagingMockCommercial';
import { assertFinancialAmount, assertFinancialCurrency } from '../accounting/commercialLedger';
import { MockPaymentProvider } from './mockProvider';
import { ProviderError, type PaymentProvider, type ProviderRecord, type ProviderEvent } from './provider';

type Row={id:string;kind:string;currency:ISO4217Currency;amount_minor:string;provider_reference:string|null;event_type:string|null};

export class HostedMockPaymentProvider implements PaymentProvider {
  private static readonly oneShotFaults=new Map<string,'TIMEOUT'|'UNAVAILABLE'|'REJECTED'>();
  static setOneShotFault(operation:'DEPOSIT'|'PAYOUT',idempotencyKey:string,fault:'TIMEOUT'|'UNAVAILABLE'|'REJECTED') {
    if(!stagingMockMode()||!idempotencyKey||idempotencyKey.length>120||
      (fault==='REJECTED'&&operation!=='PAYOUT')) throw new Error('Invalid staging mock fault');
    this.oneShotFaults.set(`${operation}:${idempotencyKey}`,fault);
  }
  private readonly verifier:MockPaymentProvider;
  constructor(private readonly pool:Pool,private readonly key:string) {
    if(!stagingMockMode()||!/^[a-f0-9]{64}$/i.test(key)) throw new Error('Hosted mock provider requires authorized staging mode');
    this.verifier=new MockPaymentProvider(key);
  }
  private reference(operation:'DEPOSIT'|'PAYOUT',idempotencyKey:string):string {
    return `mock_stage_${createHmac('sha256',this.key).update(`${operation}:${idempotencyKey}`).digest('hex').slice(0,40)}`;
  }
  private async create(operation:'DEPOSIT'|'PAYOUT',r:{amountMinor:number;currency:ISO4217Currency;idempotencyKey:string}):Promise<ProviderRecord> {
    assertFinancialAmount(r.amountMinor);assertFinancialCurrency(r.currency);
    if(!r.idempotencyKey) throw new Error('Mock provider idempotency key required');
    const faultKey=`${operation}:${r.idempotencyKey}`;
    const fault=HostedMockPaymentProvider.oneShotFaults.get(faultKey);
    if(fault) {
      HostedMockPaymentProvider.oneShotFaults.delete(faultKey);
      throw new ProviderError(fault,fault==='REJECTED'?'Mock payout rejected':'Mock provider did not complete the call');
    }
    return {reference:this.reference(operation,r.idempotencyKey),operation,amountMinor:r.amountMinor,
      currency:r.currency,status:'PENDING',idempotencyKey:r.idempotencyKey};
  }
  createDeposit(r:{amountMinor:number;currency:ISO4217Currency;idempotencyKey:string}) {return this.create('DEPOSIT',r);}
  createPayout(r:{amountMinor:number;currency:ISO4217Currency;idempotencyKey:string}) {return this.create('PAYOUT',r);}
  private async get(reference:string,kind:'DEPOSIT'|'WITHDRAWAL'):Promise<ProviderRecord> {
    const q=await this.pool.query<Row>(`SELECT o.id,o.kind,o.currency,o.amount_minor,o.provider_reference,
      (SELECT e.event_type FROM commercial_provider_events e WHERE e.operation_id=o.id AND e.status='APPLIED'
       ORDER BY e.received_at DESC,e.id DESC LIMIT 1) event_type
      FROM commercial_operations o WHERE o.provider_reference=$1 AND o.kind=$2`,[reference,kind]);
    const row=q.rows[0];if(!row) throw new ProviderError('NOT_FOUND','Mock provider record not found');
    return this.fromRow(row);
  }
  private fromRow(row:Row):ProviderRecord {
    const operation=row.kind==='DEPOSIT'?'DEPOSIT':'PAYOUT';
    return {reference:row.provider_reference!,operation,amountMinor:Number(row.amount_minor),currency:row.currency,
      idempotencyKey:row.id,status:row.event_type?.endsWith('_SUCCEEDED')?'SUCCEEDED':
        row.event_type?.endsWith('_FAILED')?'FAILED':'PENDING'};
  }
  getDeposit(reference:string) {return this.get(reference,'DEPOSIT');}
  getPayout(reference:string) {return this.get(reference,'WITHDRAWAL');}
  async refund(_r:{reference:string;amountMinor:number;currency:ISO4217Currency;idempotencyKey:string}):Promise<ProviderRecord> {
    throw new ProviderError('UNAVAILABLE','Mock refund requests use explicit ledger compensation');
  }
  verifyWebhook(rawBody:string,signature:string):ProviderEvent {return this.verifier.verifyWebhook(rawBody,signature);}
  async listRecords():Promise<ProviderRecord[]> {
    const q=await this.pool.query<Row>(`SELECT o.id,o.kind,o.currency,o.amount_minor,o.provider_reference,
      (SELECT e.event_type FROM commercial_provider_events e WHERE e.operation_id=o.id AND e.status='APPLIED'
       ORDER BY e.received_at DESC,e.id DESC LIMIT 1) event_type
      FROM commercial_operations o WHERE o.kind IN ('DEPOSIT','WITHDRAWAL') AND o.provider_reference IS NOT NULL`);
    return q.rows.map(row=>this.fromRow(row));
  }
}

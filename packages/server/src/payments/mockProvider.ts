/** Deterministic mock only. It has no network calls or real provider credentials. */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { assertFinancialAmount, assertFinancialCurrency } from '../accounting/commercialLedger';
import type { PaymentProvider, ProviderEvent, ProviderOperation, ProviderRecord, ProviderStatus } from './provider';
import { ProviderError } from './provider';

export type MockBehavior = 'PENDING'|'SUCCESS'|'FAILURE'|'TIMEOUT'|'UNAVAILABLE'|'PAYOUT_REJECTED';

export class MockPaymentProvider implements PaymentProvider {
  private records=new Map<string,ProviderRecord>();
  private keys=new Map<string,string>();
  private behavior:MockBehavior='PENDING';
  constructor(private readonly signingKey:string) {
    if(signingKey.length<16) throw new Error('Mock webhook signing key too short');
  }
  setBehavior(behavior:MockBehavior) { this.behavior=behavior; }
  private create(operation:ProviderOperation,amountMinor:number,currency:ProviderRecord['currency'],idempotencyKey:string):ProviderRecord {
    assertFinancialAmount(amountMinor); assertFinancialCurrency(currency);
    if(!idempotencyKey) throw new Error('Provider idempotency key required');
    const key=`${operation}:${idempotencyKey}`;
    const existing=this.keys.get(key);
    if(existing) {
      const record=this.records.get(existing)!;
      if(record.amountMinor!==amountMinor||record.currency!==currency) throw new Error('Provider idempotency key reused with different request');
      return {...record};
    }
    if(this.behavior==='TIMEOUT') throw new ProviderError('TIMEOUT','Mock provider timed out');
    if(this.behavior==='UNAVAILABLE') throw new ProviderError('UNAVAILABLE','Mock provider unavailable');
    if(this.behavior==='PAYOUT_REJECTED'&&operation==='PAYOUT') throw new ProviderError('REJECTED','Mock payout rejected');
    const status:ProviderStatus=this.behavior==='SUCCESS'?'SUCCEEDED':this.behavior==='FAILURE'?'FAILED':'PENDING';
    const record:ProviderRecord={reference:`mock_${randomUUID()}`,operation,amountMinor,currency,status,idempotencyKey};
    this.records.set(record.reference,record); this.keys.set(key,record.reference);
    return {...record};
  }
  async createDeposit(r:{amountMinor:number;currency:ProviderRecord['currency'];idempotencyKey:string}) {return this.create('DEPOSIT',r.amountMinor,r.currency,r.idempotencyKey)}
  async createPayout(r:{amountMinor:number;currency:ProviderRecord['currency'];idempotencyKey:string}) {return this.create('PAYOUT',r.amountMinor,r.currency,r.idempotencyKey)}
  async refund(r:{reference:string;amountMinor:number;currency:ProviderRecord['currency'];idempotencyKey:string}) {
    const original=this.records.get(r.reference);
    if(!original||original.operation!=='DEPOSIT') throw new ProviderError('NOT_FOUND','Original mock deposit not found');
    return this.create('REFUND',r.amountMinor,r.currency,r.idempotencyKey);
  }
  async getDeposit(reference:string) {return this.get(reference,'DEPOSIT')}
  async getPayout(reference:string) {return this.get(reference,'PAYOUT')}
  private get(reference:string,operation:ProviderOperation) {
    const record=this.records.get(reference);
    if(!record||record.operation!==operation) throw new ProviderError('NOT_FOUND','Mock provider reference not found');
    return {...record};
  }
  async listRecords() {return [...this.records.values()].map(record=>({...record}));}
  setStatus(reference:string,status:ProviderStatus) {
    const record=this.records.get(reference);
    if(!record) throw new ProviderError('NOT_FOUND','Mock provider reference not found');
    record.status=status;
  }
  makeWebhook(reference:string,options:{eventId?:string;status?:ProviderStatus;amountMinor?:number;currency?:ProviderRecord['currency']}={}) {
    const record=this.records.get(reference);
    if(!record) throw new ProviderError('NOT_FOUND','Mock provider reference not found');
    const event:ProviderEvent={...record,eventId:options.eventId??`evt_${randomUUID()}`,occurredAt:new Date().toISOString(),
      status:options.status??record.status,amountMinor:options.amountMinor??record.amountMinor,currency:options.currency??record.currency};
    const body=JSON.stringify(event);
    return {body,signature:createHmac('sha256',this.signingKey).update(body).digest('hex'),event};
  }
  verifyWebhook(rawBody:string,signature:string):ProviderEvent {
    const expected=createHmac('sha256',this.signingKey).update(rawBody).digest();
    let supplied:Buffer;
    try {supplied=Buffer.from(signature,'hex');} catch {throw new ProviderError('INVALID_SIGNATURE','Invalid mock webhook signature');}
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)) throw new ProviderError('INVALID_SIGNATURE','Invalid mock webhook signature');
    let event:ProviderEvent;
    try {event=JSON.parse(rawBody) as ProviderEvent;} catch {throw new ProviderError('INVALID_SIGNATURE','Invalid mock webhook payload');}
    if(!event||typeof event.eventId!=='string'||!event.eventId||typeof event.reference!=='string'||
       !['DEPOSIT','PAYOUT','REFUND'].includes(event.operation)||!['PENDING','SUCCEEDED','FAILED'].includes(event.status)||
       typeof event.occurredAt!=='string') throw new ProviderError('INVALID_SIGNATURE','Invalid mock webhook payload');
    assertFinancialAmount(event.amountMinor); assertFinancialCurrency(event.currency);
    return event;
  }
}

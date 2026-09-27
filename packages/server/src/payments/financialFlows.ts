/** Server-side mock flows. Never credit a redirect or browser-submitted status. */
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { ISO4217Currency } from '@fugluck/shared';
import { CommercialLedger, assertFinancialAmount, assertFinancialCurrency } from '../accounting/commercialLedger';
import type { PaymentProvider, ProviderEvent } from './provider';
import { ProviderError } from './provider';
import { evaluateEligibility, type EligibilityContext, type EligibilityPolicy } from './eligibility';

type Operation = {id:string;kind:'DEPOSIT'|'WITHDRAWAL';status:string;user_id:string;currency:ISO4217Currency;
  amount_minor:string;provider_reference:string|null;terminal_reference:string|null};
export type FinancialRequest = {userId:string;currency:ISO4217Currency;amountMinor:number;idempotencyKey:string;
  accountActive:boolean;identityVerified:boolean;jurisdiction:string;riskSignals:EligibilityContext['riskSignals']};
export type FlowReceipt = {operationId:string;status:string;providerReference?:string|null;duplicate:boolean};

export class FinancialFlows {
  readonly ledger:CommercialLedger;
  constructor(private readonly pool:Pool,private readonly provider:PaymentProvider,private readonly policy:EligibilityPolicy) {
    this.ledger=new CommercialLedger(pool);
  }
  private async tx<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T> {
    const client=await this.pool.connect();
    try {await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  private async find(client:PoolClient,id:string):Promise<Operation|null> {
    return (await client.query<Operation>('SELECT id,kind,status,user_id,currency,amount_minor,provider_reference,terminal_reference FROM commercial_operations WHERE id=$1 FOR UPDATE',[id])).rows[0]??null;
  }
  private async transition(client:PoolClient,op:Operation,status:string,reason:string,actor='system',providerReference?:string,terminalReference?:string) {
    await client.query('UPDATE commercial_operations SET status=$2,provider_reference=COALESCE($3,provider_reference),terminal_reference=COALESCE($4,terminal_reference),updated_at=now() WHERE id=$1',
      [op.id,status,providerReference??null,terminalReference??null]);
    await client.query(`INSERT INTO commercial_operation_events(operation_id,from_status,to_status,actor_id,source,reason,provider_reference)
      VALUES($1,$2,$3,$4,'financial_flow',$5,$6)`,[op.id,op.status,status,actor,reason,providerReference??op.provider_reference]);
    op.status=status;
    if(providerReference) op.provider_reference=providerReference;
    if(terminalReference) op.terminal_reference=terminalReference;
  }
  private assertEligible(action:EligibilityContext['action'],r:FinancialRequest) {
    assertFinancialAmount(r.amountMinor); assertFinancialCurrency(r.currency);
    const decision=evaluateEligibility(this.policy,{action,amountMinor:r.amountMinor,accountActive:r.accountActive,
      identityVerified:r.identityVerified,jurisdiction:r.jurisdiction,riskSignals:r.riskSignals});
    if(!decision.allowed) throw new Error(`Financial eligibility denied: ${decision.reasons.join(',')}`);
    if(!r.idempotencyKey||r.idempotencyKey.length>120) throw new Error('Invalid financial idempotency key');
  }
  private async assertNoEnforcementBlock(action:EligibilityContext['action'],userId:string) {
    const block=action==='DEPOSIT'?'BLOCK_DEPOSITS':action==='WITHDRAWAL'?'BLOCK_WITHDRAWALS':'BLOCK_COMPETITIONS';
    const result=await this.pool.query(`SELECT 1 FROM commercial_risk_cases WHERE user_id=$1 AND status='RESTRICTED'
      AND enforcement_action IN ('BLOCK_ALL',$2) LIMIT 1`,[userId,block]);
    if(result.rowCount) throw new Error('Financial action blocked by reviewed risk decision');
  }
  private receipt(op:Operation,duplicate:boolean):FlowReceipt {return {operationId:op.id,status:op.status,providerReference:op.provider_reference,duplicate};}

  async requestDeposit(r:FinancialRequest):Promise<FlowReceipt> {
    this.assertEligible('DEPOSIT',r);
    await this.assertNoEnforcementBlock('DEPOSIT',r.userId);
    const id=`deposit:${r.idempotencyKey}`;
    const initial=await this.tx(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`commercial-operation:${id}`]);
      const old=await this.find(client,id);
      if(old){if(old.user_id!==r.userId||old.currency!==r.currency||Number(old.amount_minor)!==r.amountMinor) throw new Error('Deposit idempotency conflict');return this.receipt(old,true);}
      await client.query(`INSERT INTO commercial_operations(id,kind,status,user_id,currency,amount_minor)
        VALUES($1,'DEPOSIT','REQUESTED',$2,$3,$4)`,[id,r.userId,r.currency,r.amountMinor]);
      await client.query(`INSERT INTO commercial_operation_events(operation_id,to_status,actor_id,source,reason)
        VALUES($1,'REQUESTED',$2,'financial_flow','Deposit request accepted')`,[id,r.userId]);
      return {operationId:id,status:'REQUESTED',duplicate:false};
    });
    if(initial.status!=='REQUESTED') return initial;
    return this.submitDeposit(id);
  }
  async submitDeposit(id:string):Promise<FlowReceipt> {
    const op=await this.tx(client=>this.find(client,id));
    if(!op||op.kind!=='DEPOSIT') throw new Error('Deposit operation not found');
    if(op.provider_reference) return this.receipt(op,true);
    const order=await this.provider.createDeposit({amountMinor:Number(op.amount_minor),currency:op.currency,idempotencyKey:op.id});
    return this.tx(async client=>{
      const current=(await this.find(client,id))!;
      if(!current.provider_reference) await this.transition(client,current,'EXTERNAL_PENDING','Provider deposit order created','system',order.reference);
      return this.receipt(current,false);
    });
  }
  async requestWithdrawal(r:FinancialRequest):Promise<FlowReceipt> {
    const reserved=await this.reserveWithdrawal(r);
    if(reserved.status!=='RESERVED'||reserved.duplicate) return reserved;
    return this.submitWithdrawal(reserved.operationId);
  }
  /** Explicit reservation permits a cancellation only before submission starts. */
  async reserveWithdrawal(r:FinancialRequest):Promise<FlowReceipt> {
    this.assertEligible('WITHDRAWAL',r);
    await this.assertNoEnforcementBlock('WITHDRAWAL',r.userId);
    const id=`withdrawal:${r.idempotencyKey}`;
    const reserved=await this.tx(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`commercial-operation:${id}`]);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`commercial-user:${r.userId}`]);
      const old=await this.find(client,id);
      if(old){if(old.user_id!==r.userId||old.currency!==r.currency||Number(old.amount_minor)!==r.amountMinor) throw new Error('Withdrawal idempotency conflict');return this.receipt(old,true);}
      if(await this.ledger.balance({kind:'USER_AVAILABLE',userId:r.userId},r.currency,client)<r.amountMinor) throw new Error('Insufficient withdrawal balance');
      await client.query(`INSERT INTO commercial_operations(id,kind,status,user_id,currency,amount_minor)
        VALUES($1,'WITHDRAWAL','RESERVED',$2,$3,$4)`,[id,r.userId,r.currency,r.amountMinor]);
      await this.ledger.post({idempotencyKey:`${id}:reserve`,eventType:'WITHDRAWAL_RESERVE',currency:r.currency,
        actorId:r.userId,source:'financial_flow',reason:'Reserve funds for payout',referenceId:id,
        postings:[{account:{kind:'USER_AVAILABLE',userId:r.userId},amountMinor:-r.amountMinor},
          {account:{kind:'USER_WITHDRAWAL_RESERVED',userId:r.userId},amountMinor:r.amountMinor}]},client);
      await client.query(`INSERT INTO commercial_operation_events(operation_id,to_status,actor_id,source,reason)
        VALUES($1,'RESERVED',$2,'financial_flow','Withdrawal funds reserved')`,[id,r.userId]);
      return {operationId:id,status:'RESERVED',duplicate:false};
    });
    return reserved;
  }
  async submitWithdrawal(id:string):Promise<FlowReceipt> {
    const start=await this.tx(async client=>{
      const op=await this.find(client,id);
      if(!op||op.kind!=='WITHDRAWAL') throw new Error('Withdrawal operation not found');
      if(op.provider_reference||!['RESERVED','SUBMISSION_UNCERTAIN'].includes(op.status)) return {op,submit:false};
      await this.transition(client,op,'SUBMITTING','Submitting idempotent payout order');
      return {op,submit:true};
    });
    if(!start.submit) return this.receipt(start.op,true);
    const op=start.op;
    let payout;
    try {payout=await this.provider.createPayout({amountMinor:Number(op.amount_minor),currency:op.currency,idempotencyKey:op.id});}
    catch(error){
      if(error instanceof ProviderError&&error.code==='REJECTED') {
        await this.failWithdrawal(id,'Provider payout rejected','SUBMITTING');
        return {operationId:id,status:'REVERSED',duplicate:false};
      }
      await this.tx(async client=>{
        const current=await this.find(client,id);
        if(current?.status==='SUBMITTING') await this.transition(client,current,'SUBMISSION_UNCERTAIN',
          'Provider call did not return a definitive payout result');
      });
      throw error;
    }
    return this.tx(async client=>{
      const current=(await this.find(client,id))!;
      if(current.status==='SUBMITTING'&&!current.provider_reference) await this.transition(client,current,'PROCESSING','Provider payout created','system',payout.reference);
      return this.receipt(current,false);
    });
  }
  private async failWithdrawal(id:string,reason:string,expectedStatus:'RESERVED'|'SUBMITTING'):Promise<void> {
    await this.tx(async client=>{
      const op=await this.find(client,id);
      if(!op||op.kind!=='WITHDRAWAL') throw new Error('Withdrawal not found');
      if(op.status==='REVERSED') return;
      if(op.status!==expectedStatus||op.provider_reference)
        throw new Error('Withdrawal cannot be reversed in its current provider state');
      const amount=Number(op.amount_minor);
      const receipt=await this.ledger.post({idempotencyKey:`${id}:reverse`,eventType:'WITHDRAWAL_REVERSAL',currency:op.currency,
        actorId:'system',source:'financial_flow',reason,referenceId:id,providerReference:op.provider_reference??undefined,
        postings:[{account:{kind:'USER_WITHDRAWAL_RESERVED',userId:op.user_id},amountMinor:-amount},
          {account:{kind:'USER_AVAILABLE',userId:op.user_id},amountMinor:amount}]},client);
      await this.transition(client,op,'REVERSED',reason,'system',undefined,receipt.transactionId);
    });
  }
  async cancelWithdrawal(id:string):Promise<void> {
    await this.failWithdrawal(id,'Withdrawal cancelled before provider submission','RESERVED');
  }
  async handleWebhook(rawBody:string,signature:string):Promise<{status:string;duplicate:boolean}> {
    const event=this.provider.verifyWebhook(rawBody,signature);
    const hash=createHash('sha256').update(rawBody).digest('hex');
    return this.tx(async client=>{
      const prior=await client.query<{payload_hash:string;status:string}>('SELECT payload_hash,status FROM commercial_provider_events WHERE id=$1',[event.eventId]);
      if(prior.rows.length) {
        if(prior.rows[0].payload_hash!==hash) throw new Error('Provider event ID reused with different payload');
        return {status:prior.rows[0].status,duplicate:true};
      }
      const op=(await client.query<Operation>(`SELECT id,kind,status,user_id,currency,amount_minor,provider_reference,terminal_reference
        FROM commercial_operations WHERE provider_reference=$1 FOR UPDATE`,[event.reference])).rows[0];
      let status:'APPLIED'|'OUT_OF_ORDER'|'MISMATCH'|'UNMATCHED'='UNMATCHED';
      if(op) {
        const match=op.currency===event.currency&&Number(op.amount_minor)===event.amountMinor&&
          ((op.kind==='DEPOSIT'&&event.operation==='DEPOSIT')||(op.kind==='WITHDRAWAL'&&event.operation==='PAYOUT'));
        if(!match) status='MISMATCH';
        else status=await this.applyProviderEvent(client,op,event);
      }
      await client.query(`INSERT INTO commercial_provider_events(id,provider_reference,operation_id,event_type,currency,amount_minor,payload_hash,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[event.eventId,event.reference,op?.id??null,`${event.operation}_${event.status}`,event.currency,event.amountMinor,hash,status]);
      return {status,duplicate:false};
    });
  }
  private async applyProviderEvent(client:PoolClient,op:Operation,event:ProviderEvent):Promise<'APPLIED'|'OUT_OF_ORDER'> {
    if(event.status==='PENDING') return 'APPLIED';
    if(op.kind==='DEPOSIT') {
      if(op.status==='CONFIRMED'||op.status==='FAILED') return 'OUT_OF_ORDER';
      if(event.status==='FAILED') {await this.transition(client,op,'FAILED','Verified provider deposit failure');return 'APPLIED';}
      const amount=Number(op.amount_minor);
      const receipt=await this.ledger.post({idempotencyKey:`${op.id}:confirm`,eventType:'DEPOSIT_CONFIRMED',currency:op.currency,
        actorId:'provider',source:'signed_webhook',reason:'Verified provider deposit success',referenceId:op.id,providerReference:event.reference,
        postings:[{account:{kind:'PROVIDER_CLEARING'},amountMinor:-amount},
          {account:{kind:'USER_AVAILABLE',userId:op.user_id},amountMinor:amount}]},client);
      await this.transition(client,op,'CONFIRMED','Verified provider deposit success','provider',undefined,receipt.transactionId);
      return 'APPLIED';
    }
    if(op.status==='COMPLETED'||op.status==='REVERSED') return 'OUT_OF_ORDER';
    const amount=Number(op.amount_minor);
    if(event.status==='FAILED') {
      const receipt=await this.ledger.post({idempotencyKey:`${op.id}:reverse`,eventType:'WITHDRAWAL_REVERSAL',currency:op.currency,
        actorId:'provider',source:'signed_webhook',reason:'Verified payout failure',referenceId:op.id,providerReference:event.reference,
        postings:[{account:{kind:'USER_WITHDRAWAL_RESERVED',userId:op.user_id},amountMinor:-amount},
          {account:{kind:'USER_AVAILABLE',userId:op.user_id},amountMinor:amount}]},client);
      await this.transition(client,op,'REVERSED','Verified payout failure','provider',undefined,receipt.transactionId);
      return 'APPLIED';
    }
    const receipt=await this.ledger.post({idempotencyKey:`${op.id}:complete`,eventType:'WITHDRAWAL_COMPLETED',currency:op.currency,
      actorId:'provider',source:'signed_webhook',reason:'Verified payout completion',referenceId:op.id,providerReference:event.reference,
      postings:[{account:{kind:'USER_WITHDRAWAL_RESERVED',userId:op.user_id},amountMinor:-amount},
        {account:{kind:'PROVIDER_CLEARING'},amountMinor:amount}]},client);
    await this.transition(client,op,'COMPLETED','Verified payout completion','provider',undefined,receipt.transactionId);
    return 'APPLIED';
  }
  async reconcile():Promise<{issues:string[];ledger:Awaited<ReturnType<CommercialLedger['reconcile']>>}> {
    const issues:string[]=[];
    const providerRecords=await this.provider.listRecords();
    for(const record of providerRecords) {
      const result=await this.pool.query<Operation>('SELECT id,kind,status,user_id,currency,amount_minor,provider_reference,terminal_reference FROM commercial_operations WHERE provider_reference=$1',[record.reference]);
      const op=result.rows[0];
      if(!op){issues.push(`PROVIDER_WITHOUT_OPERATION:${record.reference}`);continue;}
      if(op.currency!==record.currency||Number(op.amount_minor)!==record.amountMinor) issues.push(`AMOUNT_CURRENCY_MISMATCH:${op.id}`);
      if(record.status==='SUCCEEDED'&&!['CONFIRMED','COMPLETED'].includes(op.status)) issues.push(`PROVIDER_SUCCESS_WITHOUT_LEDGER:${op.id}`);
      if(record.status==='FAILED'&&['CONFIRMED','COMPLETED'].includes(op.status)) issues.push(`LEDGER_WITHOUT_PROVIDER_SUCCESS:${op.id}`);
    }
    const stuck=await this.pool.query<{id:string}>(`SELECT id FROM commercial_operations WHERE kind IN ('DEPOSIT','WITHDRAWAL')
      AND status IN ('REQUESTED','EXTERNAL_PENDING','RESERVED','SUBMITTING','SUBMISSION_UNCERTAIN','PROCESSING')
      AND created_at<now()-interval '1 hour'`);
    for(const row of stuck.rows) issues.push(`STUCK_PENDING:${row.id}`);
    const missingEvents=await this.pool.query<{id:string}>(`SELECT o.id FROM commercial_operations o
      WHERE o.kind IN ('DEPOSIT','WITHDRAWAL') AND o.status IN ('CONFIRMED','COMPLETED')
      AND NOT EXISTS (SELECT 1 FROM commercial_provider_events e WHERE e.operation_id=o.id AND e.status='APPLIED'
        AND e.event_type IN ('DEPOSIT_SUCCEEDED','PAYOUT_SUCCEEDED'))`);
    for(const row of missingEvents.rows) issues.push(`LEDGER_WITHOUT_PROVIDER_EVENT:${row.id}`);
    const duplicatePrizes=await this.pool.query<{reference_id:string}>(`SELECT reference_id FROM commercial_transactions
      WHERE event_type='PRIZE_SETTLEMENT' GROUP BY reference_id HAVING count(*)>1`);
    for(const row of duplicatePrizes.rows) issues.push(`DUPLICATE_PRIZE_SETTLEMENT:${row.reference_id}`);
    const anomaly=await this.pool.query<{id:string;status:string}>('SELECT id,status FROM commercial_provider_events WHERE status IN (\'MISMATCH\',\'UNMATCHED\',\'OUT_OF_ORDER\')');
    for(const row of anomaly.rows) issues.push(`PROVIDER_EVENT_${row.status}:${row.id}`);
    const ledger=await this.ledger.reconcile();
    if(ledger.unbalancedTransactions||ledger.totalMinor!=='0') issues.push('LEDGER_UNBALANCED');
    return {issues,ledger};
  }
}

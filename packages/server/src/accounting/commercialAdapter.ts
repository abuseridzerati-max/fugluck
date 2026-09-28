/** Commercial competition candidate, exercised only against disposable databases. */
import type { Pool, PoolClient } from 'pg';
import { createMoney, isTestGelCompetitionCertified, type ISO4217Currency } from '@fugluck/shared';
import type { CompetitionAccountingPort, ReserveEntryParams, ReserveEntryResult, ReleaseEntryParams,
  ReleaseEntryResult, CaptureEntryParams, CaptureEntryResult, SettleCompetitionParams,
  SettleCompetitionResult, RefundCompetitionParams, RefundCompetitionResult } from './port';
import { CommercialLedger, assertFinancialAmount, assertFinancialCurrency, type FinancialPosting } from './commercialLedger';

type Operation = { id:string;status:string;currency:ISO4217Currency;amount_minor:string;terminal_reference:string|null };
type Instance = { id:string;game_id:string;rules_version:string;entry_fee_minor:number;currency:ISO4217Currency;status:string;format?:string };

export class CommercialAccountingAdapter implements CompetitionAccountingPort {
  readonly ledger: CommercialLedger;
  constructor(private readonly pool: Pool) { this.ledger = new CommercialLedger(pool); }
  private async tx<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T> {
    const client=await this.pool.connect();
    try { await client.query('BEGIN'); const value=await fn(client); await client.query('COMMIT'); return value; }
    catch(error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  private async lock(client:PoolClient, instanceId:string) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`commercial-instance:${instanceId}`]);
  }
  private async instance(client:PoolClient,id:string):Promise<Instance> {
    const result=await client.query<Instance>("SELECT id,game_id,rules_version,entry_fee_minor,currency,status,to_jsonb(ci)->>'format' AS format FROM competition_instances ci WHERE id=$1",[id]);
    const instance=result.rows[0];
    if (!instance || !isTestGelCompetitionCertified(instance.game_id,instance.rules_version)) throw new Error('Commercial competition requires certified authority and immutable instance');
    assertFinancialCurrency(instance.currency);
    return instance;
  }
  private async operation(client:PoolClient,id:string):Promise<Operation|null> {
    return (await client.query<Operation>('SELECT id,status,currency,amount_minor,terminal_reference FROM commercial_operations WHERE id=$1 FOR UPDATE',[id])).rows[0]??null;
  }
  private async transition(client:PoolClient,id:string,from:string,to:string,actorId:string,source:string,reason:string,reference?:string) {
    await client.query('UPDATE commercial_operations SET status=$2,terminal_reference=$3,updated_at=now() WHERE id=$1 AND status=$4',
      [id,to,reference??null,from]);
    await client.query('INSERT INTO commercial_operation_events(operation_id,from_status,to_status,actor_id,source,reason) VALUES($1,$2,$3,$4,$5,$6)',
      [id,from,to,actorId,source,reason]);
  }
  private money(value:number,currency:ISO4217Currency) { return createMoney(value,currency); }

  async reserveEntry(params:ReserveEntryParams):Promise<ReserveEntryResult> {
    const {competitionInstanceId:id,userId,entryFee,idempotencyKey:key}=params;
    assertFinancialAmount(entryFee.amountMinor,true); assertFinancialCurrency(entryFee.currency);
    return this.tx(async client=>{
      await this.lock(client,id);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`commercial-user:${userId}`]);
      const instance=await this.instance(client,id);
      if (instance.entry_fee_minor!==entryFee.amountMinor || instance.currency!==entryFee.currency) throw new Error('Entry fee differs from immutable competition terms');
      const block=await client.query(`SELECT 1 FROM commercial_risk_cases WHERE user_id=$1 AND status='RESTRICTED'
        AND enforcement_action IN ('BLOCK_ALL','BLOCK_COMPETITIONS') LIMIT 1`,[userId]);
      if(block.rowCount) throw new Error('Competition entry blocked by reviewed risk decision');
      const opId=`entry:${id}:${userId}`;
      const existing=await this.operation(client,opId);
      if (existing) return {success:existing.status==='RESERVED',competitionInstanceId:id,userId,
        reservedAmount:entryFee,accountingReferenceId:existing.terminal_reference??undefined,
        ...existing.status!=='RESERVED'?{errorCode:'DUPLICATE_ENTRY' as const}:{} };
      if (entryFee.amountMinor>0 && await this.ledger.balance({kind:'USER_AVAILABLE',userId},entryFee.currency,client)<entryFee.amountMinor)
        return {success:false,competitionInstanceId:id,userId,reservedAmount:entryFee,errorCode:'INSUFFICIENT_FUNDS'};
      await client.query(`INSERT INTO commercial_operations(id,kind,status,user_id,competition_instance_id,currency,amount_minor)
        VALUES($1,'ENTRY','RESERVED',$2,$3,$4,$5)`, [opId,userId,id,entryFee.currency,entryFee.amountMinor]);
      let reference:string|undefined;
      if(entryFee.amountMinor>0) reference=(await this.ledger.post({idempotencyKey:key,eventType:'ENTRY_RESERVE',currency:entryFee.currency,
        actorId:userId,source:'competition',reason:'Immutable entry fee reservation',referenceId:id,
        postings:[{account:{kind:'USER_AVAILABLE',userId},amountMinor:-entryFee.amountMinor},
          {account:{kind:'USER_ENTRY_RESERVED',userId},amountMinor:entryFee.amountMinor}]},client)).transactionId;
      await client.query('UPDATE commercial_operations SET terminal_reference=$2 WHERE id=$1',[opId,reference??null]);
      await client.query(`INSERT INTO commercial_operation_events(operation_id,to_status,actor_id,source,reason)
        VALUES($1,'RESERVED',$2,'competition','Entry reserved')`,[opId,userId]);
      return {success:true,competitionInstanceId:id,userId,reservedAmount:entryFee,accountingReferenceId:reference};
    });
  }
  async releaseEntry(params:ReleaseEntryParams):Promise<ReleaseEntryResult> {
    const {competitionInstanceId:id,userId,idempotencyKey:key}=params;
    return this.tx(async client=>{
      await this.lock(client,id); const opId=`entry:${id}:${userId}`; const op=await this.operation(client,opId);
      if(!op) return {success:false,competitionInstanceId:id,userId,errorCode:'RESERVATION_NOT_FOUND'};
      if(op.status==='CAPTURED'||op.status==='REFUNDED') return {success:false,competitionInstanceId:id,userId,errorCode:'ALREADY_CAPTURED'};
      const amount=Number(op.amount_minor);
      if(op.status==='RELEASED') return {success:true,competitionInstanceId:id,userId,releasedAmount:this.money(amount,op.currency),accountingReferenceId:op.terminal_reference??undefined};
      let reference:string|undefined;
      if(amount>0) reference=(await this.ledger.post({idempotencyKey:key,eventType:'ENTRY_RELEASE',currency:op.currency,
        actorId:userId,source:'competition',reason:'Release entry before capture',referenceId:id,
        postings:[{account:{kind:'USER_ENTRY_RESERVED',userId},amountMinor:-amount},
          {account:{kind:'USER_AVAILABLE',userId},amountMinor:amount}]},client)).transactionId;
      await this.transition(client,opId,'RESERVED','RELEASED',userId,'competition','Entry release',reference);
      return {success:true,competitionInstanceId:id,userId,releasedAmount:this.money(amount,op.currency),accountingReferenceId:reference};
    });
  }
  async captureEntry(params:CaptureEntryParams):Promise<CaptureEntryResult> {
    const {competitionInstanceId:id,userId,idempotencyKey:key}=params;
    return this.tx(async client=>{
      await this.lock(client,id); const opId=`entry:${id}:${userId}`; const op=await this.operation(client,opId);
      if(!op) return {success:false,competitionInstanceId:id,userId,errorCode:'RESERVATION_NOT_FOUND'};
      if(op.status==='RELEASED') return {success:false,competitionInstanceId:id,userId,errorCode:'ALREADY_RELEASED'};
      const amount=Number(op.amount_minor);
      if(op.status==='CAPTURED') return {success:true,competitionInstanceId:id,userId,capturedAmount:this.money(amount,op.currency),accountingReferenceId:op.terminal_reference??undefined};
      if(op.status==='REFUNDED') return {success:false,competitionInstanceId:id,userId,errorCode:'ALREADY_RELEASED'};
      let reference:string|undefined;
      if(amount>0) reference=(await this.ledger.post({idempotencyKey:key,eventType:'ENTRY_CAPTURE',currency:op.currency,
        actorId:'authority',source:'competition',reason:'Capture reserved entry on authoritative lock',referenceId:id,
        postings:[{account:{kind:'USER_ENTRY_RESERVED',userId},amountMinor:-amount},
          {account:{kind:'ENTRY_CAPTURED'},amountMinor:amount}]},client)).transactionId;
      await this.transition(client,opId,'RESERVED','CAPTURED','authority','competition','Entry capture',reference);
      return {success:true,competitionInstanceId:id,userId,capturedAmount:this.money(amount,op.currency),accountingReferenceId:reference};
    });
  }
  async settleCompetition(params:SettleCompetitionParams):Promise<SettleCompetitionResult> {
    const {competitionInstanceId:id,prizes,idempotencyKey:key}=params;
    return this.tx(async client=>{
      await this.lock(client,id); const instance=await this.instance(client,id);
      const opId=`competition:${id}`; const previous=await this.operation(client,opId);
      const rows=(await client.query<{user_id:string;amount_minor:string}>(
        "SELECT user_id,amount_minor FROM commercial_operations WHERE kind='ENTRY' AND competition_instance_id=$1 AND status='CAPTURED' ORDER BY user_id",[id])).rows;
      const captured=rows.reduce((sum,row)=>sum+Number(row.amount_minor),0);
      if(!Number.isSafeInteger(captured)) throw new Error('Captured total overflow');
      const zero=this.money(0,instance.currency);
      if(previous?.status==='REFUNDED') return {success:false,competitionInstanceId:id,totalEntriesCaptured:zero,totalPrizesAwarded:zero,prizesAwarded:[],errorCode:'COMPETITION_ALREADY_REFUNDED'};
      const snap=(await client.query<{placement:number;amount_minor:number;currency:string}>(
        'SELECT placement,amount_minor,currency FROM competition_instance_prizes WHERE instance_id=$1 ORDER BY placement',[id])).rows;
      if(snap.length!==prizes.length || prizes.some((p,i)=>p.placement!==snap[i]?.placement || p.amount.amountMinor!==snap[i]?.amount_minor || p.amount.currency!==instance.currency || snap[i]?.currency!==instance.currency))
        return {success:false,competitionInstanceId:id,totalEntriesCaptured:this.money(captured,instance.currency),totalPrizesAwarded:zero,prizesAwarded:[],errorCode:'INVALID_PRIZE_AMOUNT'};
      const participantIds=new Set((await client.query<{user_id:string}>(
        'SELECT user_id FROM competition_participants WHERE instance_id=$1',[id])).rows.map(row=>row.user_id));
      if(prizes.some(p=>!participantIds.has(p.userId))) throw new Error('Prize recipient is not a participant');
      if(instance.entry_fee_minor>0 && (rows.length!==participantIds.size || rows.some(row=>!participantIds.has(row.user_id))))
        throw new Error('Commercial settlement requires every participant entry to be captured');
      // The lifecycle may pass a prize, but only a durable server authority
      // decision can authorize the recipient. A tournament requires its Final's
      // decision; a semifinal winner cannot authorize the whole prize.
      const tournament=instance.format==='TOURNAMENT_BRACKET'?(await client.query(`SELECT * FROM competition_tournaments WHERE instance_id=$1`,[id])).rows[0]:null;
      if(instance.format==='TOURNAMENT_BRACKET'&&(!tournament||!['FINALIZING','SETTLED'].includes(tournament.state)||tournament.winner_user_id!==prizes[0]?.userId||tournament.terms.prizeMinor!==prizes[0]?.amount.amountMinor||tournament.terms.scheduledEntryTotalMinor!==captured||tournament.terms.capacity!==participantIds.size))throw Error('Tournament settlement requires its frozen final result');
      const authority=(await client.query<{kind:string;winner_user_id:string|null}>(`
        SELECT d.kind,d.winner_user_id FROM competition_authority_decisions d
        JOIN competition_authority_runs r ON r.id=d.run_id WHERE r.instance_id=$1 AND ($2::text IS NULL OR r.id=$2)`,[id,tournament?.final_run_id??null])).rows[0];
      if(prizes.length!==1||prizes[0].placement!==1||!authority||
         !['WIN','FORFEIT'].includes(authority.kind)||authority.winner_user_id!==prizes[0].userId)
        throw new Error('Commercial settlement requires the matching durable server-authority winner');
      const awarded=prizes.reduce((sum,p)=>{assertFinancialAmount(p.amount.amountMinor,true);return sum+p.amount.amountMinor},0);
      if(!Number.isSafeInteger(awarded)) throw new Error('Prize total overflow');
      const margin=Math.max(captured-awarded,0),subsidy=Math.max(awarded-captured,0);
      if(previous?.status==='SETTLED') return {success:true,competitionInstanceId:id,totalEntriesCaptured:this.money(captured,instance.currency),
        totalPrizesAwarded:this.money(awarded,instance.currency),platformMarginRetained:this.money(margin,instance.currency),
        promotionalSubsidyInjected:this.money(subsidy,instance.currency),prizesAwarded:prizes,accountingReferenceId:previous.terminal_reference??undefined};
      const postings:FinancialPosting[]=[];
      if(captured) postings.push({account:{kind:'ENTRY_CAPTURED'},amountMinor:-captured});
      if(subsidy) postings.push({account:{kind:'PROMOTIONAL_SUBSIDY'},amountMinor:-subsidy});
      if(awarded) {
        postings.push({account:{kind:'PRIZE_OBLIGATION'},amountMinor:awarded});
        postings.push({account:{kind:'PRIZE_OBLIGATION'},amountMinor:-awarded});
        for(const prize of prizes) if(prize.amount.amountMinor) postings.push({account:{kind:'USER_AVAILABLE',userId:prize.userId},amountMinor:prize.amount.amountMinor});
      }
      if(margin) postings.push({account:{kind:'PLATFORM_MARGIN'},amountMinor:margin});
      let reference:string|undefined;
      if(postings.length) reference=(await this.ledger.post({idempotencyKey:key,eventType:'PRIZE_SETTLEMENT',currency:instance.currency,
        actorId:'authority',source:'competition',reason:'Predetermined immutable prize settlement',referenceId:id,postings},client)).transactionId;
      await client.query(`INSERT INTO commercial_operations(id,kind,status,competition_instance_id,currency,amount_minor,terminal_reference)
        VALUES($1,'COMPETITION','SETTLED',$2,$3,$4,$5)`,[opId,id,instance.currency,awarded,reference??null]);
      await client.query(`INSERT INTO commercial_operation_events(operation_id,to_status,actor_id,source,reason)
        VALUES($1,'SETTLED','authority','competition','Authoritative terminal settlement')`,[opId]);
      return {success:true,competitionInstanceId:id,totalEntriesCaptured:this.money(captured,instance.currency),totalPrizesAwarded:this.money(awarded,instance.currency),
        platformMarginRetained:this.money(margin,instance.currency),promotionalSubsidyInjected:this.money(subsidy,instance.currency),
        prizesAwarded:prizes,accountingReferenceId:reference};
    });
  }
  async refundCompetition(params:RefundCompetitionParams):Promise<RefundCompetitionResult> {
    const {competitionInstanceId:id,idempotencyKey:key,reason}=params;
    return this.tx(async client=>{
      await this.lock(client,id); const instance=await this.instance(client,id); const opId=`competition:${id}`;
      const previous=await this.operation(client,opId);
      if(previous?.status==='SETTLED') return {success:false,competitionInstanceId:id,totalRefunded:this.money(0,instance.currency),refundedUserIds:[],errorCode:'COMPETITION_ALREADY_SETTLED'};
      if(previous?.status==='REFUNDED') return {success:true,competitionInstanceId:id,totalRefunded:this.money(Number(previous.amount_minor),instance.currency),refundedUserIds:[],accountingReferenceId:previous.terminal_reference??undefined};
      const entries=(await client.query<{id:string;user_id:string;status:string;amount_minor:string}>(
        "SELECT id,user_id,status,amount_minor FROM commercial_operations WHERE kind='ENTRY' AND competition_instance_id=$1 ORDER BY user_id FOR UPDATE",[id])).rows;
      const postings:FinancialPosting[]=[]; const users:string[]=[]; let total=0;
      for(const entry of entries) {
        const amount=Number(entry.amount_minor);
        if(entry.status==='CAPTURED'||entry.status==='RESERVED') {
          if(amount) {postings.push({account:{kind:entry.status==='CAPTURED'?'ENTRY_CAPTURED':'USER_ENTRY_RESERVED',
            ...(entry.status==='RESERVED'?{userId:entry.user_id}:{})},amountMinor:-amount});
            postings.push({account:{kind:'USER_AVAILABLE',userId:entry.user_id},amountMinor:amount});}
          if(entry.status==='CAPTURED') {total+=amount;users.push(entry.user_id);}
          await this.transition(client,entry.id,entry.status,entry.status==='CAPTURED'?'REFUNDED':'RELEASED','authority','competition',reason);
        }
      }
      let reference:string|undefined;
      if(postings.length) reference=(await this.ledger.post({idempotencyKey:key,eventType:'ENTRY_REFUND',currency:instance.currency,
        actorId:'authority',source:'competition',reason,referenceId:id,postings},client)).transactionId;
      await client.query(`INSERT INTO commercial_operations(id,kind,status,competition_instance_id,currency,amount_minor,terminal_reference)
        VALUES($1,'COMPETITION','REFUNDED',$2,$3,$4,$5)`,[opId,id,instance.currency,total,reference??null]);
      await client.query(`INSERT INTO commercial_operation_events(operation_id,to_status,actor_id,source,reason)
        VALUES($1,'REFUNDED','authority','competition',$2)`,[opId,reason]);
      return {success:true,competitionInstanceId:id,totalRefunded:this.money(total,instance.currency),refundedUserIds:users,accountingReferenceId:reference};
    });
  }
}

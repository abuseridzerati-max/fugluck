import './require-disposable-test-database.ts';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { createMoney, GAME_COMPETITION_CERTIFICATIONS } from '../packages/shared/src/index';
import { CommercialAccountingAdapter } from '../packages/server/src/accounting/commercialAdapter';
import { CommercialLedger } from '../packages/server/src/accounting/commercialLedger';
import { MockPaymentProvider } from '../packages/server/src/payments/mockProvider';
import { FinancialFlows } from '../packages/server/src/payments/financialFlows';
import { DEFAULT_ELIGIBILITY_POLICY, evaluateEligibility, type EligibilityPolicy } from '../packages/server/src/payments/eligibility';
import { deriveRiskSignals } from '../packages/server/src/payments/risk';
import { RiskReviewStore } from '../packages/server/src/payments/riskReview';

const uri=process.env.DATABASE_URL!;
const tls=!['localhost','127.0.0.1'].includes(new URL(uri).hostname);
const stamp=Date.now().toString();
const testSchema=`commercial_check_${stamp}`;
const direct=new URL(uri);
if(direct.hostname.includes('-pooler.')) direct.hostname=direct.hostname.replace('-pooler.','.');
if(direct.pathname!==new URL(uri).pathname || !direct.hostname.endsWith('.neon.tech') && tls) throw new Error('Disposable direct-host routing check failed');
const connection={connectionString:direct.toString().replace(/[?&]sslmode=[^&]+/g,'').replace(/\?$/,''),ssl:tls?{rejectUnauthorized:false}:undefined};
const adminPool=new Pool(connection);
const pool=new Pool({...connection,options:`-c search_path=${testSchema},public`});
const ledger=new CommercialLedger(pool);
const accounting=new CommercialAccountingAdapter(pool);
const provider=new MockPaymentProvider('mock-only-test-signing-key-2026');
const policy:EligibilityPolicy={enabled:{DEPOSIT:true,COMPETITION:true,WITHDRAWAL:true},
  maxSingleMinor:{DEPOSIT:100000,COMPETITION:100000,WITHDRAWAL:100000},
  requireVerifiedIdentity:{WITHDRAWAL:true},allowedJurisdictions:{DEPOSIT:['GE'],COMPETITION:['GE'],WITHDRAWAL:['GE']}};
const flows=new FinancialFlows(pool,provider,policy);
const users=[`cfin_a_${stamp}`,`cfin_b_${stamp}`,`cfin_c_${stamp}`];
const createdInstances:string[]=[];
let adminFixtureId:string|null=null;
let passes=0,failures=0;
function check(name:string,condition:unknown) {if(condition){passes++;console.log(`PASS ${name}`);}else{failures++;console.error(`FAIL ${name}`);}}
async function rejects(name:string,fn:()=>Promise<unknown>) {try{await fn();check(name,false);}catch{check(name,true);}}
async function ensureMigration() {
  await adminPool.query(`CREATE SCHEMA "${testSchema}"`);
  const current=await pool.query('SELECT current_schema() AS name');
  if(current.rows[0].name!==testSchema) throw new Error('Commercial fixture schema isolation failed');
  const sql=readFileSync('packages/server/drizzle/0012_commercial_financial_core.sql','utf8');
  const client=await pool.connect();
  try {await client.query('BEGIN');for(const statement of sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean)) await client.query(statement);await client.query('COMMIT');}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
async function seedInstance(id:string,fee:number,prize:number) {
  const template=`tmpl_${id}`;
  const version=GAME_COMPETITION_CERTIFICATIONS['space-blaster'].authorityVersion!;
  await pool.query(`INSERT INTO competition_templates(id,game_id,title,format,participant_capacity,currency,entry_fee_minor,rules_version,skill_assessment_version,jurisdiction)
    VALUES($1,'space-blaster','Commercial disposable fixture','HEAD_TO_HEAD',2,'GEL',$2,$3,'test','GE')`,[template,fee,version]);
  await pool.query(`INSERT INTO competition_instances(id,template_id,game_id,format,participant_capacity,currency,entry_fee_minor,rules_version,skill_assessment_version,jurisdiction,status)
    VALUES($1,$2,'space-blaster','HEAD_TO_HEAD',2,'GEL',$3,$4,'test','GE','ACTIVE')`,[id,template,fee,version]);
  createdInstances.push(id);
  await pool.query('INSERT INTO competition_instance_prizes(id,instance_id,placement,amount_minor,currency) VALUES($1,$2,1,$3,\'GEL\')',[`prize_${id}`,id,prize]);
  for(let i=0;i<2;i++) await pool.query('INSERT INTO competition_participants(id,instance_id,user_id,seat_index,entry_fee_minor) VALUES($1,$2,$3,$4,$5)',
    [`part_${id}_${i}`,id,users[i],i,fee]);
}
async function seedAuthorityDecision(instanceId:string,winnerUserId:string) {
  const matchId=`match_${instanceId}`,runId=`run_${instanceId}`;
  const version=GAME_COMPETITION_CERTIFICATIONS['space-blaster'].authorityVersion!;
  await pool.query(`INSERT INTO matches_history(id,game_id,player1_id,player2_id,currency,seed,competition_instance_id)
    VALUES($1,'space-blaster',$2,$3,'GEL',42,$4)`,[matchId,users[0],users[1],instanceId]);
  await pool.query(`INSERT INTO competition_authority_runs(id,instance_id,match_id,game_id,version,seed,owner_id,lease_until,status)
    VALUES($1,$2,$3,'space-blaster',$4,42,'disposable-test',now()+interval '1 hour','COMPLETED')`,
    [runId,instanceId,matchId,version]);
  await pool.query(`INSERT INTO competition_authority_decisions(run_id,kind,winner_user_id,reason,result_ids)
    VALUES($1,'WIN',$2,'SERVER_RESULTS','[]')`,[runId,winnerUserId]);
}
function funding(userId:string,amount:number,key:string) {return ledger.post({idempotencyKey:key,eventType:'TEST_FUNDING',currency:'GEL',actorId:'disposable-test',
  source:'test_fixture',reason:'Disposable financial simulation funding',postings:[
    {account:{kind:'FINANCIAL_ADJUSTMENTS'},amountMinor:-amount},{account:{kind:'USER_AVAILABLE',userId},amountMinor:amount}]});}
const req=(userId:string,amountMinor:number,idempotencyKey:string)=>({userId,amountMinor,idempotencyKey,currency:'GEL' as const,
  accountActive:true,identityVerified:true,jurisdiction:'GE',riskSignals:[] as const});

async function main() {
  await ensureMigration();
  for(const id of users) await pool.query('INSERT INTO users(id,username,password_hash) VALUES($1,$2,\'fixture\')',[id,id]);
  const [a,b,c]=users;
  check('default policy independently denies every financial action',(['DEPOSIT','COMPETITION','WITHDRAWAL'] as const).every(action=>
    !evaluateEligibility(DEFAULT_ELIGIBILITY_POLICY,{action,amountMinor:100,accountActive:true,identityVerified:true,jurisdiction:'GE',riskSignals:[]}).allowed));
  check('risk signal routes to review',evaluateEligibility(policy,{action:'WITHDRAWAL',amountMinor:100,accountActive:true,identityVerified:true,
    jurisdiction:'GE',riskSignals:['ACCOUNT_TAKEOVER']}).reasons.includes('RISK_REVIEW_REQUIRED'));
  check('unapproved jurisdiction fails closed',!evaluateEligibility(policy,{action:'DEPOSIT',amountMinor:100,accountActive:true,identityVerified:true,
    jurisdiction:'XX',riskSignals:[]}).allowed);
  await rejects('fractional amount rejected',()=>funding(a,1.5,'bad-fraction'));
  await rejects('unsafe amount rejected',()=>funding(a,Number.MAX_SAFE_INTEGER+1,'bad-overflow'));
  await rejects('unbalanced posting rejected',()=>ledger.post({idempotencyKey:'bad-unbalanced',eventType:'ADJUSTMENT',currency:'GEL',actorId:'test',source:'test',reason:'bad',
    postings:[{account:{kind:'FINANCIAL_ADJUSTMENTS'},amountMinor:-10},{account:{kind:'USER_AVAILABLE',userId:a},amountMinor:9}]}));
  await rejects('currency mismatch rejected by database',async()=>{
    const client=await pool.connect();try{await client.query('BEGIN');await client.query(`INSERT INTO commercial_transactions(id,idempotency_key,request_hash,event_type,currency,actor_id,source,reason)
      VALUES($1,$2,$3,'TEST','GEL','test','test','mismatch')`,[`badcur_${stamp}`,`badcur_${stamp}`,'a'.repeat(64)]);
      await client.query('INSERT INTO commercial_postings(transaction_id,account_id,currency,amount_minor) VALUES($1,$2,\'USD\',10)',[`badcur_${stamp}`,`user:${a}:USER_AVAILABLE:GEL`]);}
    finally{await client.query('ROLLBACK');client.release();}
  });
  const initial=await funding(a,1000,`fund_a_${stamp}`);
  const repeat=await funding(a,1000,`fund_a_${stamp}`);
  check('funding is idempotent',!initial.duplicate&&repeat.duplicate&&initial.transactionId===repeat.transactionId);
  await rejects('idempotency conflict rejected',()=>funding(a,1001,`fund_a_${stamp}`));
  const dup=await Promise.all([funding(b,1000,`fund_b_${stamp}`),funding(b,1000,`fund_b_${stamp}`)]);
  check('concurrent duplicate posts once',dup.filter(r=>!r.duplicate).length===1&&dup[0].transactionId===dup[1].transactionId);
  await funding(c,100,`fund_c_${stamp}`);
  check('balance is derived from postings',await ledger.balance({kind:'USER_AVAILABLE',userId:a},'GEL')===1000);
  await rejects('historical posting is immutable',()=>pool.query('UPDATE commercial_postings SET amount_minor=999 WHERE transaction_id=$1',[initial.transactionId]));
  await rejects('historical transaction is immutable',()=>pool.query('DELETE FROM commercial_transactions WHERE id=$1',[initial.transactionId]));
  await rejects('financial history cannot be truncated',()=>pool.query('TRUNCATE commercial_postings'));
  await rejects('late posting to committed transaction rejected',()=>pool.query(
    'INSERT INTO commercial_postings(transaction_id,account_id,currency,amount_minor) VALUES($1,$2,\'GEL\',1)',
    [initial.transactionId,`user:${a}:USER_AVAILABLE:GEL`]));
  await rejects('database rejects unbalanced commit',async()=>{
    const client=await pool.connect();try{await client.query('BEGIN');await client.query(`INSERT INTO commercial_transactions(id,idempotency_key,request_hash,event_type,currency,actor_id,source,reason)
      VALUES($1,$2,$3,'TEST','GEL','test','test','bad commit')`,[`unbalanced_${stamp}`,`unbalanced_${stamp}`,'b'.repeat(64)]);await client.query('COMMIT');}
    finally{await client.query('ROLLBACK');client.release();}
  });
  check('failed transaction rolled back',!(await pool.query('SELECT 1 FROM commercial_transactions WHERE id=$1',[`unbalanced_${stamp}`])).rowCount);
  const adjustment=await ledger.compensate({originalTransactionId:initial.transactionId,userId:a,amountMinor:25,currency:'GEL',
    direction:'CREDIT_USER',idempotencyKey:`adjust_${stamp}`,adminActorId:'fixture-admin',auditReference:`audit_${stamp}`,reason:'Explicit test correction'});
  check('compensating adjustment is a new audit-linked transaction',!adjustment.duplicate&&adjustment.transactionId!==initial.transactionId&&
    await ledger.balance({kind:'USER_AVAILABLE',userId:a},'GEL')===1025);
  check('processing fee is balanced',!(await ledger.recordProcessingFee({amountMinor:5,currency:'GEL',providerReference:`fee_${stamp}`,
    idempotencyKey:`fee_${stamp}`,reason:'Mock processing fee'})).duplicate);
  check('chargeback is represented separately',!(await ledger.recordChargeback({amountMinor:7,currency:'GEL',providerReference:`cb_${stamp}`,
    idempotencyKey:`chargeback_${stamp}`,reason:'Mock dispute'})).duplicate);
  const dep=await flows.requestDeposit(req(a,500,`dep_${stamp}`));
  check('deposit request is pending with no credit',dep.status==='EXTERNAL_PENDING'&&await ledger.balance({kind:'USER_AVAILABLE',userId:a},'GEL')===1025);
  const depAgain=await flows.requestDeposit(req(a,500,`dep_${stamp}`));
  check('duplicate deposit request reuses provider order',depAgain.providerReference===dep.providerReference);
  provider.setStatus(dep.providerReference!,'SUCCEEDED');
  const depositHook=provider.makeWebhook(dep.providerReference!,{status:'SUCCEEDED'});
  await rejects('invalid webhook signature rejected',()=>flows.handleWebhook(depositHook.body,'00'));
  check('invalid signature made no credit',await ledger.balance({kind:'USER_AVAILABLE',userId:a},'GEL')===1025);
  const applied=await flows.handleWebhook(depositHook.body,depositHook.signature);
  check('signed success credits once',applied.status==='APPLIED'&&await ledger.balance({kind:'USER_AVAILABLE',userId:a},'GEL')===1525);
  check('duplicate callback has no second credit',(await flows.handleWebhook(depositHook.body,depositHook.signature)).duplicate&&
    await ledger.balance({kind:'USER_AVAILABLE',userId:a},'GEL')===1525);
  const late=provider.makeWebhook(dep.providerReference!,{status:'FAILED'});
  check('out-of-order failure cannot reverse confirmed deposit',(await flows.handleWebhook(late.body,late.signature)).status==='OUT_OF_ORDER');
  const wrong=provider.makeWebhook(dep.providerReference!,{status:'SUCCEEDED',amountMinor:501});
  check('provider amount mismatch quarantined',(await flows.handleWebhook(wrong.body,wrong.signature)).status==='MISMATCH');
  const depFailed=await flows.requestDeposit(req(a,60,`dep_fail_${stamp}`));
  provider.setStatus(depFailed.providerReference!,'FAILED');
  const depFailHook=provider.makeWebhook(depFailed.providerReference!);
  check('failed deposit creates no credit',(await flows.handleWebhook(depFailHook.body,depFailHook.signature)).status==='APPLIED'&&
    await ledger.balance({kind:'USER_AVAILABLE',userId:a},'GEL')===1525);
  const depLateSuccess=provider.makeWebhook(depFailed.providerReference!,{status:'SUCCEEDED'});
  check('late success after failed deposit is quarantined',(await flows.handleWebhook(depLateSuccess.body,depLateSuccess.signature)).status==='OUT_OF_ORDER');
  const withdrawal=await flows.requestWithdrawal(req(a,400,`wd_${stamp}`));
  check('withdrawal reserves funds',withdrawal.status==='PROCESSING'&&await ledger.balance({kind:'USER_AVAILABLE',userId:a},'GEL')===1125&&
    await ledger.balance({kind:'USER_WITHDRAWAL_RESERVED',userId:a},'GEL')===400);
  const payoutHook=provider.makeWebhook(withdrawal.providerReference!,{status:'SUCCEEDED'});
  provider.setStatus(withdrawal.providerReference!,'SUCCEEDED');
  check('payout completion is signed and ledger backed',(await flows.handleWebhook(payoutHook.body,payoutHook.signature)).status==='APPLIED'&&
    await ledger.balance({kind:'USER_WITHDRAWAL_RESERVED',userId:a},'GEL')===0);
  check('duplicate payout callback is harmless',(await flows.handleWebhook(payoutHook.body,payoutHook.signature)).duplicate);
  const withdrawal2=await flows.requestWithdrawal(req(a,200,`wd_fail_${stamp}`));
  const failedHook=provider.makeWebhook(withdrawal2.providerReference!,{status:'FAILED'});
  provider.setStatus(withdrawal2.providerReference!,'FAILED');
  check('failed payout restores available funds',(await flows.handleWebhook(failedHook.body,failedHook.signature)).status==='APPLIED'&&
    await ledger.balance({kind:'USER_AVAILABLE',userId:a},'GEL')===1125);
  provider.setBehavior('PAYOUT_REJECTED');
  const rejectedPayout=await flows.requestWithdrawal(req(a,100,`wd_rejected_${stamp}`));
  check('provider rejection reverses reservation',rejectedPayout.status==='REVERSED'&&await ledger.balance({kind:'USER_WITHDRAWAL_RESERVED',userId:a},'GEL')===0);
  const preSubmit=await flows.reserveWithdrawal(req(a,30,`wd_cancel_${stamp}`));
  check('withdrawal can remain reserved before provider submission',preSubmit.status==='RESERVED'&&
    await ledger.balance({kind:'USER_WITHDRAWAL_RESERVED',userId:a},'GEL')===30);
  await flows.cancelWithdrawal(preSubmit.operationId);
  await flows.cancelWithdrawal(preSubmit.operationId);
  check('pre-submission cancellation reverses exactly once',await ledger.balance({kind:'USER_WITHDRAWAL_RESERVED',userId:a},'GEL')===0&&
    (await pool.query("SELECT count(*)::integer n FROM commercial_transactions WHERE idempotency_key=$1",[`${preSubmit.operationId}:reverse`])).rows[0].n===1);
  provider.setBehavior('TIMEOUT');
  await rejects('provider timeout leaves resumable deposit request',()=>flows.requestDeposit(req(a,50,`dep_timeout_${stamp}`)));
  await rejects('provider timeout leaves payout submission uncertain for safe retry',()=>flows.requestWithdrawal(req(a,50,`wd_timeout_${stamp}`)));
  check('timed-out withdrawal stays reserved and uncertain',await ledger.balance({kind:'USER_WITHDRAWAL_RESERVED',userId:a},'GEL')===50&&
    (await pool.query('SELECT status FROM commercial_operations WHERE id=$1',[`withdrawal:wd_timeout_${stamp}`])).rows[0].status==='SUBMISSION_UNCERTAIN');
  await rejects('uncertain payout cannot be cancelled or returned to available funds',()=>flows.cancelWithdrawal(`withdrawal:wd_timeout_${stamp}`));
  provider.setBehavior('PENDING');
  check('provider retry completes pending request',(await flows.submitDeposit(`deposit:dep_timeout_${stamp}`)).status==='EXTERNAL_PENDING');
  const retriedPayout=await flows.submitWithdrawal(`withdrawal:wd_timeout_${stamp}`);
  check('uncertain payout retries under the same provider idempotency key',retriedPayout.status==='PROCESSING'&&Boolean(retriedPayout.providerReference));
  const timeoutFailure=provider.makeWebhook(retriedPayout.providerReference!,{status:'FAILED'});
  provider.setStatus(retriedPayout.providerReference!,'FAILED');
  check('verified retry failure reverses reservation once',(await flows.handleWebhook(timeoutFailure.body,timeoutFailure.signature)).status==='APPLIED'&&
    await ledger.balance({kind:'USER_WITHDRAWAL_RESERVED',userId:a},'GEL')===0);
  await rejects('insufficient withdrawal funds rejected',()=>flows.requestWithdrawal(req(c,101,`wd_overdraw_${stamp}`)));
  const standard=`comp_std_${stamp}`;await seedInstance(standard,100,150);
  const ra=await accounting.reserveEntry({competitionInstanceId:standard,userId:a,entryFee:createMoney(100),idempotencyKey:`ra_${stamp}`});
  const rb=await accounting.reserveEntry({competitionInstanceId:standard,userId:b,entryFee:createMoney(100),idempotencyKey:`rb_${stamp}`});
  check('two independent entry reservations succeed',ra.success&&rb.success);
  check('second reservation for same user is rejected or idempotent',
    (await accounting.reserveEntry({competitionInstanceId:standard,userId:a,entryFee:createMoney(100),idempotencyKey:`ra_other_${stamp}`})).success);
  check('duplicate reservation does not move funds',(await accounting.reserveEntry({competitionInstanceId:standard,userId:a,entryFee:createMoney(100),idempotencyKey:`ra_${stamp}`})).success&&
    await ledger.balance({kind:'USER_ENTRY_RESERVED',userId:a},'GEL')===100);
  check('capture succeeds',(await accounting.captureEntry({competitionInstanceId:standard,userId:a,idempotencyKey:`ca_${stamp}`})).success&&
    (await accounting.captureEntry({competitionInstanceId:standard,userId:b,idempotencyKey:`cb_${stamp}`})).success);
  check('duplicate capture is idempotent',(await accounting.captureEntry({competitionInstanceId:standard,userId:a,idempotencyKey:`ca_${stamp}`})).success);
  const stdPrize=[{placement:1,userId:a,amount:createMoney(150)}];
  await rejects('settlement without server decision is refused',()=>accounting.settleCompetition({competitionInstanceId:standard,prizes:stdPrize,idempotencyKey:`no_authority_${stamp}`}));
  await seedAuthorityDecision(standard,a);
  const settled=await accounting.settleCompetition({competitionInstanceId:standard,prizes:stdPrize,idempotencyKey:`settle_${stamp}`});
  check('standard predetermined prize independent of entry sum',settled.success&&settled.totalEntriesCaptured.amountMinor===200&&
    settled.totalPrizesAwarded.amountMinor===150&&settled.platformMarginRetained?.amountMinor===50);
  check('duplicate terminal event pays prize once',(await accounting.settleCompetition({competitionInstanceId:standard,prizes:stdPrize,idempotencyKey:`settle_${stamp}`})).success);
  check('historical prize credit appears exactly once',(await pool.query("SELECT count(*)::integer n FROM commercial_transactions WHERE event_type='PRIZE_SETTLEMENT' AND reference_id=$1",[standard])).rows[0].n===1);
  check('settled competition cannot refund',!(await accounting.refundCompetition({competitionInstanceId:standard,reason:'test',idempotencyKey:`refund_std_${stamp}`})).success);
  const partial=`comp_partial_${stamp}`;await seedInstance(partial,100,150);
  await accounting.reserveEntry({competitionInstanceId:partial,userId:a,entryFee:createMoney(100),idempotencyKey:`partial_a_${stamp}`});
  await accounting.reserveEntry({competitionInstanceId:partial,userId:b,entryFee:createMoney(100),idempotencyKey:`partial_b_${stamp}`});
  await accounting.captureEntry({competitionInstanceId:partial,userId:a,idempotencyKey:`partial_capture_${stamp}`});
  await seedAuthorityDecision(partial,a);
  await rejects('settlement refuses partially captured participant entries',()=>accounting.settleCompetition({competitionInstanceId:partial,
    prizes:[{placement:1,userId:a,amount:createMoney(150)}],idempotencyKey:`partial_settle_${stamp}`}));
  check('partial competition can refund captured and reserved funds',(await accounting.refundCompetition({competitionInstanceId:partial,
    reason:'Partial capture abort',idempotencyKey:`partial_refund_${stamp}`})).success&&
    await ledger.balance({kind:'USER_ENTRY_RESERVED',userId:b},'GEL')===0);
  const promo=`comp_promo_${stamp}`;await seedInstance(promo,100,300);
  for(const [i,userId] of [a,b].entries()) {await accounting.reserveEntry({competitionInstanceId:promo,userId,entryFee:createMoney(100),idempotencyKey:`promo_r_${i}_${stamp}`});
    await accounting.captureEntry({competitionInstanceId:promo,userId,idempotencyKey:`promo_c_${i}_${stamp}`});}
  await seedAuthorityDecision(promo,b);
  const promoted=await accounting.settleCompetition({competitionInstanceId:promo,prizes:[{placement:1,userId:b,amount:createMoney(300)}],idempotencyKey:`promo_s_${stamp}`});
  check('promotional prize injects explicit subsidy',promoted.success&&promoted.promotionalSubsidyInjected?.amountMinor===100);
  const free=`comp_free_${stamp}`;await seedInstance(free,0,50);
  await seedAuthorityDecision(free,a);
  const freeroll=await accounting.settleCompetition({competitionInstanceId:free,prizes:[{placement:1,userId:a,amount:createMoney(50)}],idempotencyKey:`free_s_${stamp}`});
  check('freeroll prize is platform funded',freeroll.success&&freeroll.totalEntriesCaptured.amountMinor===0&&freeroll.promotionalSubsidyInjected?.amountMinor===50);
  const cancel=`comp_cancel_${stamp}`;await seedInstance(cancel,100,150);
  const invalidPrize=await accounting.settleCompetition({competitionInstanceId:cancel,prizes:[{placement:1,userId:a,amount:createMoney(151)}],idempotencyKey:`bad_prize_${stamp}`});
  check('settlement rejects prize differing from immutable snapshot',!invalidPrize.success&&invalidPrize.errorCode==='INVALID_PRIZE_AMOUNT');
  await accounting.reserveEntry({competitionInstanceId:cancel,userId:a,entryFee:createMoney(100),idempotencyKey:`cancel_r_${stamp}`});
  check('release restores available',(await accounting.releaseEntry({competitionInstanceId:cancel,userId:a,idempotencyKey:`cancel_l_${stamp}`})).success);
  check('duplicate release is idempotent',(await accounting.releaseEntry({competitionInstanceId:cancel,userId:a,idempotencyKey:`cancel_l_${stamp}`})).success);
  const voided=`comp_void_${stamp}`;await seedInstance(voided,100,150);
  await accounting.reserveEntry({competitionInstanceId:voided,userId:a,entryFee:createMoney(100),idempotencyKey:`void_r_${stamp}`});
  await accounting.captureEntry({competitionInstanceId:voided,userId:a,idempotencyKey:`void_c_${stamp}`});
  const refunded=await accounting.refundCompetition({competitionInstanceId:voided,reason:'Authoritative void',idempotencyKey:`void_f_${stamp}`});
  check('captured entry refunds once',refunded.success&&refunded.totalRefunded.amountMinor===100);
  check('duplicate refund has no duplicate payout',(await accounting.refundCompetition({competitionInstanceId:voided,reason:'Authoritative void',idempotencyKey:`void_f_${stamp}`})).success);
  const race1=`comp_race1_${stamp}`,race2=`comp_race2_${stamp}`;
  await seedInstance(race1,100,150);await seedInstance(race2,100,150);
  const races=await Promise.all([race1,race2].map((id,i)=>accounting.reserveEntry({competitionInstanceId:id,userId:c,
    entryFee:createMoney(100),idempotencyKey:`race_${i}_${stamp}`})));
  check('concurrent reservations cannot double spend',races.filter(r=>r.success).length===1&&races.filter(r=>r.errorCode==='INSUFFICIENT_FUNDS').length===1);
  const reconciliation=await flows.reconcile();
  check('all ledger transactions balance',reconciliation.ledger.unbalancedTransactions===0&&reconciliation.ledger.totalMinor==='0');
  check('mismatched provider event appears in reconciliation',reconciliation.issues.some(i=>i.startsWith('PROVIDER_EVENT_MISMATCH')));
  const signals=deriveRiskSignals({accountsOnDevice:3,financialOperationsInWindow:5,failedPaymentsInWindow:2,
    depositToWithdrawalElapsedMs:1000,withdrawalDestinationChanged:true,repeatedPromotionClaims:3,
    recentCredentialReset:true,intentionalDisconnectCount:4,apiAbuseCount:6},
    {maxAccountsOnDevice:2,maxFinancialOperationsInWindow:4,maxFailedPaymentsInWindow:1,
      minDepositToWithdrawalElapsedMs:2000,maxPromotionClaims:2,maxIntentionalDisconnects:3,maxApiAbuseCount:5});
  check('configurable risk rules cover all nine signals',signals.length===9);
  const review=new RiskReviewStore(pool);
  const caseId=await review.open(c,signals,'Trusted simulation facts');
  check('risk case enters review queue',(await review.listOpen()).some(item=>item.id===caseId));
  await rejects('ordinary user cannot enforce risk case',()=>review.decide(caseId,c,'RESTRICTED','BLOCK_ALL','Unauthorized'));
  const adminId=`cfin_admin_${stamp}`;
  await pool.query("INSERT INTO users(id,username,password_hash,role) VALUES($1,$2,'fixture','OWNER')",[adminId,adminId]);
  adminFixtureId=adminId;
  const decision=await review.decide(caseId,adminId,'RESTRICTED','BLOCK_WITHDRAWALS','Reviewed test risk case');
  check('owner restriction is explicit and audited',decision.status==='RESTRICTED'&&
    (await review.activeBlocks(c)).includes('BLOCK_WITHDRAWALS')&&
    (await pool.query('SELECT count(*)::integer n FROM commercial_risk_events WHERE case_id=$1',[caseId])).rows[0].n===2);
  await rejects('reviewed withdrawal block is enforced',()=>flows.requestWithdrawal(req(c,10,`risk_block_${stamp}`)));
  await rejects('risk audit event cannot be edited',()=>pool.query('DELETE FROM commercial_risk_events WHERE case_id=$1',[caseId]));
  const burst=await Promise.all(Array.from({length:20},()=>ledger.recordProcessingFee({amountMinor:3,currency:'GEL',
    providerReference:`burst_${stamp}`,idempotencyKey:`burst_${stamp}`,reason:'Concurrent duplicate fee test'})));
  check('20 concurrent duplicate requests create one transaction',burst.filter(item=>!item.duplicate).length===1&&
    new Set(burst.map(item=>item.transactionId)).size===1);
  const concurrentDeposits=await Promise.all(Array.from({length:4},()=>flows.requestDeposit(req(b,30,`parallel_dep_${stamp}`))));
  check('concurrent duplicate deposit requests share one operation and provider order',
    new Set(concurrentDeposits.map(item=>item.operationId)).size===1&&
    (await pool.query('SELECT count(*)::integer n FROM commercial_operations WHERE id=$1',[`deposit:parallel_dep_${stamp}`])).rows[0].n===1);
  const concurrentWithdrawals=await Promise.all(Array.from({length:4},()=>flows.requestWithdrawal(req(b,20,`parallel_wd_${stamp}`))));
  check('concurrent duplicate withdrawal requests reserve funds once',
    new Set(concurrentWithdrawals.map(item=>item.operationId)).size===1&&
    (await pool.query("SELECT count(*)::integer n FROM commercial_transactions WHERE idempotency_key=$1",[`withdrawal:parallel_wd_${stamp}:reserve`])).rows[0].n===1);
  console.log(`Commercial Financial Check: ${passes} PASS, ${failures} FAIL`);
  if(failures) process.exitCode=1;
}
async function cleanup() {
  await pool.end();
  const client=await adminPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
    if(createdInstances.length) {
      const ids=createdInstances;
      await client.query('DELETE FROM competition_authority_decisions WHERE run_id = ANY($1)',[ids.map(id=>`run_${id}`)]);
      await client.query('DELETE FROM competition_authority_runs WHERE instance_id = ANY($1)',[ids]);
      await client.query('DELETE FROM matches_history WHERE id = ANY($1)',[ids.map(id=>`match_${id}`)]);
      await client.query('DELETE FROM competition_instance_prizes WHERE instance_id = ANY($1)',[ids]);
      await client.query('DELETE FROM competition_participants WHERE instance_id = ANY($1)',[ids]);
      await client.query('DELETE FROM competition_instances WHERE id = ANY($1)',[ids]);
      await client.query('DELETE FROM competition_templates WHERE id = ANY($1)',[ids.map(id=>`tmpl_${id}`)]);
    }
    await client.query('DELETE FROM users WHERE id = ANY($1)',[[...users,...(adminFixtureId?[adminFixtureId]:[])]]);
    await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();await adminPool.end();}
}
main().catch(error=>{console.error('Commercial financial check failed:',error);process.exitCode=1}).finally(()=>cleanup().catch(error=>{
  console.error('Commercial fixture cleanup failed:',error);process.exitCode=1;
}));

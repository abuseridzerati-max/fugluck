import './require-disposable-test-database';
import express from 'express';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pool } from '../packages/server/src/db/client';
import { competitionAdminRouter } from '../packages/server/src/routes/adminCompetitions';
import { requireOwnerAdmin, ADMIN_SESSION_COOKIE_NAME } from '../packages/server/src/auth/middleware';
import { signSessionToken } from '../packages/server/src/auth/jwt';
import { templateService } from '../packages/server/src/competitions/templateService';
import { instanceService } from '../packages/server/src/competitions/instanceService';
import { lifecycleEngine } from '../packages/server/src/competitions/lifecycleEngine';
import { SandboxAccountingAdapter } from '../packages/server/src/accounting/sandboxAdapter';

let passed=0,failed=0;
const check=(label:string,ok:unknown)=>{console.log(`${ok?'PASS':'FAIL'} ${label}`);ok?passed++:failed++};
async function main(){
 const id=`admin_http_${randomUUID().slice(0,12)}`, owner=`${id}_owner`,player=`${id}_player`;
 let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
 try {
 await pool.query("INSERT INTO users(id,username,password_hash,role,status,is_email_verified) VALUES($1::text,$1::text,'test-only','OWNER','active',true),($2::text,$2::text,'test-only','user','active',true)",[owner,player]);
 await templateService.createTemplate({id,gameId:'space-blaster',title:'HTTP contract fixture',format:'HEAD_TO_HEAD',participantCapacity:2,currency:'GEL',entryFeeMinor:500,prizes:[{placement:1,amountMinor:900}],rulesVersion:'space-blaster-rv001-v1',skillAssessmentVersion:'v1',enabled:true,isSandbox:true});
 const app=express();app.use(express.json(),cookieParser());app.use('/api/admin/competitions',requireOwnerAdmin,competitionAdminRouter);
 server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.once('listening',r));
 const base=`http://127.0.0.1:${(server.address() as any).port}/api/admin/competitions/templates/${id}`;
 const request=(method:string,suffix='',data?:unknown,user:string|null=owner)=>fetch(base+suffix,{method,headers:{'Content-Type':'application/json',...(user?{Cookie:`${ADMIN_SESSION_COOKIE_NAME}=${signSessionToken({sub:user})}`}:{})},body:data===undefined?undefined:JSON.stringify(data)});
  check('PUT template edit succeeds',(await request('PUT','',{title:'Edited through HTTP'})).status===200);
  check('edited title persisted',(await templateService.getTemplate(id))?.title==='Edited through HTTP');
  check('POST disable succeeds',(await request('POST','/disable')).status===200);
  check('disabled flag persisted',(await templateService.getTemplate(id))?.enabled===false);
  check('POST enable succeeds',(await request('POST','/enable')).status===200);
  check('enabled flag persisted',(await templateService.getTemplate(id))?.enabled===true);
  check('anonymous edit rejected',(await request('PUT','',{title:'Unauthorized'},null)).status===401);
  check('player disable rejected',(await request('POST','/disable',undefined,player)).status===403);
  check('wrong PATCH method rejected',(await request('PATCH','',{enabled:false,title:'Wrong method'})).status===404);
  check('wrong GET disable rejected',(await request('GET','/disable')).status===404);
  const unchanged=await templateService.getTemplate(id);
  check('unauthorized and wrong-method requests made no mutation',unchanged?.enabled&&unchanged.title==='Edited through HTTP');
  const audit=(await pool.query('SELECT action FROM admin_audit_logs WHERE target_id=$1 ORDER BY created_at',[id])).rows;
  check('edit enable disable audited exactly once',audit.length===3&&['ADMIN_COMPETITION_TEMPLATE_EDIT','ADMIN_COMPETITION_TEMPLATE_DISABLE','ADMIN_COMPETITION_TEMPLATE_ENABLE'].every(x=>audit.some(a=>a.action===x)));
  const source=readFileSync('packages/client/src/admin/AdminConsolePage.tsx','utf8');
  check('client edit follows PUT contract',/handleEditTemplate[\s\S]*?method: 'PUT'/.test(source));
  check('client toggle uses existing POST actions',source.includes("template.enabled ? 'disable' : 'enable'")&&/handleToggleTemplate[\s\S]*?method: 'POST'/.test(source));
  const accounting=new SandboxAccountingAdapter();
  await accounting.grantSandboxTestFunds(owner,2000);await accounting.grantSandboxTestFunds(player,2000);
  const joined=await instanceService.joinCompetitionQueue(id,owner,accounting);
  await instanceService.joinCompetitionQueue(id,player,accounting);
  for(const userId of [owner,player])await accounting.captureEntry({competitionInstanceId:joined.instanceId,userId,idempotencyKey:`${joined.instanceId}:${userId}`});
  await lifecycleEngine.settleCompetition(joined.instanceId,{systemVoid:true,voidReason:'HTTP_REFUND_REGRESSION'},accounting);
  const detailResponse=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/admin/competitions/instances/${joined.instanceId}`,{headers:{Cookie:`${ADMIN_SESSION_COOKIE_NAME}=${signSessionToken({sub:owner})}`}});
  const detail=await detailResponse.json() as any;
  check('actual admin detail HTTP returns refund report',detailResponse.ok&&detail.reconciliation.totalRefundedMinor===1000);
  check('admin serialized refund discrepancy zero',detail.reconciliation.reconciled&&detail.reconciliation.discrepancyMinor===0);
  check('admin serialized void participants terminal',detail.participants.every((p:any)=>p.status==='VOIDED'&&p.rank===null));
  check('refund ledger double entry independently zero',(await pool.query('SELECT sum(amount_minor)::int n FROM sandbox_ledger_entries WHERE competition_instance_id=$1',[joined.instanceId])).rows[0].n===0);
  const modal=readFileSync('packages/client/src/admin/CompetitionAdminModals.tsx','utf8');
  check('admin report displays returned refund total',modal.includes('Entry Refunds:')&&modal.includes('reconciliation.totalRefundedMinor'));
  const list=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/admin/competitions/instances?templateId=${id}`,{headers:{Cookie:`${ADMIN_SESSION_COOKIE_NAME}=${signSessionToken({sub:owner})}`}}).then(r=>r.json()) as any;
  check('instance list count follows actual HTTP contract',list.total===1&&list.instances.length===1&&source.includes('setCompInstanceTotal(res.total ?? 0)'));
 }finally{
  if(server)await new Promise<void>(r=>server!.close(()=>r()));
  // Preserve audit history, but never leave a privileged fixture behind to
  // interfere with the canonical owner-seeding regression on the next run.
  await pool.query("UPDATE users SET role='user' WHERE id=$1 AND password_hash='test-only'",[owner]);
 }
 console.log(`ADMIN HTTP CHECK: ${passed} passed, ${failed} failed`);
}
main().catch(e=>{failed++;console.error(e.message)}).finally(async()=>{await pool.end();process.exitCode=failed?1:0});

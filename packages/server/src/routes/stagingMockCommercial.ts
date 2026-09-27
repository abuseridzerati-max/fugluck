/** Operator-authorized, staging-only HTTP harness. Never mounted as a real-money API. */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { AUTHORITY_VERSION, CYBER_HOPPER_AUTHORITY_VERSION } from '@fugluck/shared';
import { attachSession, requireAuth } from '../auth/middleware';
import { pool } from '../db/client';
import { createRateLimiterMiddleware } from '../utils/rateLimiter';
import { CommercialLedger } from '../accounting/commercialLedger';
import { FinancialFlows } from '../payments/financialFlows';
import { HostedMockPaymentProvider } from '../payments/hostedMockProvider';
import type { EligibilityPolicy } from '../payments/eligibility';
import { templateService } from '../competitions/templateService';
import { MOCK_TEMPLATES, allowedMockUser, stagingMockAction, stagingMockMode, validMockAuthorization } from '../config/stagingMockCommercial';

export const stagingMockCommercialRouter=Router();
stagingMockCommercialRouter.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
stagingMockCommercialRouter.use(createRateLimiterMiddleware({windowMs:60_000,maxRequests:30}));

function provider() {return new HostedMockPaymentProvider(pool,process.env.STAGING_MOCK_PROVIDER_KEY??'');}
function flows() {
  const policy:EligibilityPolicy={enabled:{DEPOSIT:stagingMockAction('deposits'),
    COMPETITION:stagingMockAction('competitions'),WITHDRAWAL:stagingMockAction('withdrawals')},
    maxSingleMinor:{DEPOSIT:10_000,COMPETITION:10_000,WITHDRAWAL:10_000},
    requireVerifiedIdentity:{DEPOSIT:false,COMPETITION:false,WITHDRAWAL:false},
    allowedJurisdictions:{DEPOSIT:['GE'],COMPETITION:['GE'],WITHDRAWAL:['GE']}};
  return new FinancialFlows(pool,provider(),policy);
}
const request=(req:Request)=>({userId:req.userId!,currency:'GEL' as const,amountMinor:req.body.amountMinor,
  idempotencyKey:req.body.idempotencyKey,accountActive:true,identityVerified:false,jurisdiction:'GE',riskSignals:[] as const});
function validRequest(req:Request) {
  return req.body?.currency==='GEL' && Number.isSafeInteger(req.body?.amountMinor) &&
    req.body.amountMinor>0 && req.body.amountMinor<=10_000 &&
    typeof req.body.idempotencyKey==='string' && /^[a-zA-Z0-9_-]{8,80}$/.test(req.body.idempotencyKey);
}
function testUser(req:Request,res:Response,next:NextFunction) {
  if(!stagingMockMode()) {res.status(404).json({error:'Unavailable'});return;}
  if(!allowedMockUser(req.userId!)||!validMockAuthorization(req.header('x-staging-mock-authorization'))) {
    res.status(403).json({error:'Staging mock authorization required'});return;
  }
  if(req.method!=='GET' && (req.header('origin')!=='https://staging.fugluck.com'||
    !req.is('application/json'))) {res.status(403).json({error:'Staging origin and JSON required'});return;}
  next();
}

// Provider callback: the signed payload is never accepted from a browser as success.
stagingMockCommercialRouter.post('/provider-event',async(req,res)=>{
  try {
    if(!stagingMockMode()) {res.status(404).json({error:'Unavailable'});return;}
    const body=req.body?.body,signature=req.body?.signature;
    if(typeof body!=='string'||body.length>4096||typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature)) {
      res.status(400).json({error:'Invalid provider event'});return;
    }
    const mock=provider();
    const event=mock.verifyWebhook(body,signature);
    const op=await pool.query<{user_id:string}>(`SELECT user_id FROM commercial_operations
      WHERE provider_reference=$1 AND kind IN ('DEPOSIT','WITHDRAWAL')`,[event.reference]);
    if(!op.rows[0]||!allowedMockUser(op.rows[0].user_id)) {res.status(404).json({error:'Unknown test operation'});return;}
    const result=await flows().handleWebhook(body,signature);
    res.json({mode:'TEST / MOCK / STAGING',...result});
  } catch {res.status(400).json({error:'Signed mock provider event rejected'});}
});

stagingMockCommercialRouter.use(attachSession,requireAuth,testUser);
stagingMockCommercialRouter.get('/status',(_req,res)=>res.json({mode:'TEST / MOCK / STAGING',
  deposits:stagingMockAction('deposits'),competitions:stagingMockAction('competitions'),
  withdrawals:stagingMockAction('withdrawals'),realMoney:false}));
stagingMockCommercialRouter.post('/templates/ensure',async(_req,res)=>{
  try {
    for(const [gameId,id,version,fee,prize] of [
      ['space-blaster',MOCK_TEMPLATES['space-blaster'],AUTHORITY_VERSION,500,900],
      ['cyber-hopper',MOCK_TEMPLATES['cyber-hopper'],CYBER_HOPPER_AUTHORITY_VERSION,400,720],
    ] as const) {
      if(!await templateService.getTemplate(id)) await templateService.createTemplate({id,gameId,
        title:`TEST / MOCK / STAGING — ${gameId} commercial duel`,format:'HEAD_TO_HEAD',participantCapacity:2,
        currency:'GEL',entryFeeMinor:fee,prizes:[{placement:1,amountMinor:prize,currency:'GEL'}],
        rulesVersion:version,skillAssessmentVersion:'staging-mock-v1',jurisdiction:'GE',enabled:true,isSandbox:true});
    }
    res.json({mode:'TEST / MOCK / STAGING',templates:Object.values(MOCK_TEMPLATES)});
  } catch {res.status(500).json({error:'Mock templates unavailable'});}
});
stagingMockCommercialRouter.get('/balance',async(req,res)=>{
  try {const ledger=new CommercialLedger(pool);res.json({mode:'TEST / MOCK / STAGING',currency:'GEL',
    availableMinor:await ledger.balance({kind:'USER_AVAILABLE',userId:req.userId},'GEL'),
    entryReservedMinor:await ledger.balance({kind:'USER_ENTRY_RESERVED',userId:req.userId},'GEL'),
    withdrawalReservedMinor:await ledger.balance({kind:'USER_WITHDRAWAL_RESERVED',userId:req.userId},'GEL')});}
  catch {res.status(500).json({error:'Mock balance unavailable'});}
});
stagingMockCommercialRouter.post('/faults/one-shot',(req,res)=>{
  const {kind,idempotencyKey,fault}=req.body??{};
  if(!['DEPOSIT','PAYOUT'].includes(kind)||typeof idempotencyKey!=='string'||
    !/^[a-zA-Z0-9_-]{8,80}$/.test(idempotencyKey)||!['TIMEOUT','UNAVAILABLE','REJECTED'].includes(fault)||
    (fault==='REJECTED'&&kind!=='PAYOUT')) {res.status(400).json({error:'Invalid one-shot mock fault'});return;}
  const operationId=`${kind==='DEPOSIT'?'deposit':'withdrawal'}:${idempotencyKey}`;
  HostedMockPaymentProvider.setOneShotFault(kind,operationId,fault);
  res.json({mode:'TEST / MOCK / STAGING',armed:true,operationId,fault});
});
stagingMockCommercialRouter.post('/deposits',async(req,res)=>{
  if(!stagingMockAction('deposits')) {res.status(403).json({error:'Mock deposits disabled'});return;}
  if(!validRequest(req)) {res.status(400).json({error:'Invalid mock deposit request'});return;}
  try {res.status(202).json({mode:'TEST / MOCK / STAGING',...await flows().requestDeposit(request(req))});}
  catch {res.status(409).json({error:'Mock deposit rejected'});}
});
stagingMockCommercialRouter.post('/withdrawals',async(req,res)=>{
  if(!stagingMockAction('withdrawals')) {res.status(403).json({error:'Mock withdrawals disabled'});return;}
  if(!validRequest(req)) {res.status(400).json({error:'Invalid mock withdrawal request'});return;}
  try {res.status(202).json({mode:'TEST / MOCK / STAGING',...await flows().requestWithdrawal(request(req))});}
  catch {res.status(409).json({error:'Mock withdrawal rejected'});}
});
stagingMockCommercialRouter.post('/withdrawals/:id/retry',async(req,res)=>{
  try {
    const id=String(req.params.id);
    const op=await pool.query<{user_id:string;status:string}>('SELECT user_id,status FROM commercial_operations WHERE id=$1 AND kind=\'WITHDRAWAL\'',[id]);
    if(op.rows[0]?.user_id!==req.userId||op.rows[0]?.status!=='SUBMISSION_UNCERTAIN') {
      res.status(404).json({error:'Retryable withdrawal not found'});return;}
    res.json({mode:'TEST / MOCK / STAGING',...await flows().submitWithdrawal(id)});
  } catch {res.status(409).json({error:'Mock withdrawal retry rejected'});}
});
stagingMockCommercialRouter.get('/reconciliation',async(_req,res)=>{
  try {res.json({mode:'TEST / MOCK / STAGING',...await flows().reconcile()});}
  catch {res.status(500).json({error:'Mock reconciliation unavailable'});}
});

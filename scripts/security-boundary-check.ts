import './require-disposable-test-database';
import { tournamentTestDatabase } from './tournament-test-database';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { pool } from '../packages/server/src/db/client';
import { hashPassword, verifyPassword } from '../packages/server/src/auth/password';
import { signSessionToken, verifySessionToken, SESSION_COOKIE_NAME } from '../packages/server/src/auth/jwt';
import { ADMIN_SESSION_COOKIE_NAME } from '../packages/server/src/auth/middleware';
import { authRouter } from '../packages/server/src/routes/auth';
import { accountRouter } from '../packages/server/src/routes/account';
import { adminRouter } from '../packages/server/src/routes/admin';
import { walletRouter } from '../packages/server/src/routes/wallet';
import { friendsRouter } from '../packages/server/src/routes/friends';
import { competitionsRouter } from '../packages/server/src/routes/competitions';
import { stagingMockCommercialRouter } from '../packages/server/src/routes/stagingMockCommercial';
import { httpSecurity } from '../packages/server/src/config/httpSecurity';
import { isOriginAllowed, corsOptions } from '../packages/server/src/config/cors';
import cors from 'cors';
import { socketAuthMiddleware, guardSocketSession } from '../packages/server/src/matchmaking/socketAuth';
import { redactSensitiveData, logger } from '../packages/server/src/utils/safeLogger';
import { createRateLimiterMiddleware } from '../packages/server/src/utils/rateLimiter';
import { CommercialLedger, assertFinancialAmount } from '../packages/server/src/accounting/commercialLedger';
import { playerCompetitionError } from '../packages/server/src/competitions/playerError';
import { getSentEmailsHistory, sendPasswordResetEmail } from '../packages/server/src/email/emailService';

let passed=0,failed=0;
const check=(label:string,ok:unknown)=>{console.log(`${ok?'PASS':'FAIL'} ${label}`);ok?passed++:failed++;};
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
async function main(){
  const cleanup=await tournamentTestDatabase();
  const app=express(); app.use(httpSecurity,cors(corsOptions),cookieParser(),express.json());
  app.use('/api/auth',authRouter); app.use('/api/account',accountRouter); app.use('/api/admin',adminRouter);
  app.use('/api/wallet',walletRouter); app.use('/api/friends',friendsRouter);
  app.use('/api/competitions',competitionsRouter);app.use('/api/staging-mock-commercial',stagingMockCommercialRouter);
  const limiter=createRateLimiterMiddleware({windowMs:60_000,maxRequests:2});
  app.get('/api/limited/:id',limiter,(_req,res)=>res.json({ok:true}));
  app.use(((error:any,_req:any,res:any,_next:any)=>res.status(500).json({error:'Internal server error'})) as express.ErrorRequestHandler);
  const server=createServer(app),io=new Server(server,{cors:corsOptions,
    allowRequest:(request,done)=>done(null,isOriginAllowed(request.headers.origin))});
  io.use(socketAuthMiddleware);
  io.on('connection',s=>{guardSocketSession(s as any);s.emit('fixture:identity',{id:s.data.userId,guest:s.data.isGuest});s.on('joinQueue',()=>s.emit('fixture:accepted'));});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const prefix=randomUUID().slice(0,8),a=`security_a_${prefix}`,b=`security_b_${prefix}`,owner=`security_o_${prefix}`;
  const password='SecurityBoundary-Password1!',hash=await hashPassword(password);
  await pool.query(`INSERT INTO users(id,username,password_hash,role,status,email,is_email_verified) VALUES
    ($1,$1::text,$4,'user','active',$1::text||'@example.invalid',true),
    ($2,$2::text,$4,'user','active',$2::text||'@example.invalid',true),
    ($3,$3::text,$4,'OWNER','active',$3::text||'@example.invalid',true)`,[a,b,owner,hash]);
  let cookieA=`${SESSION_COOKIE_NAME}=${signSessionToken({sub:a},hash)}`;
  const cookieB=`${SESSION_COOKIE_NAME}=${signSessionToken({sub:b},hash)}`;
  const ownerUser=`${SESSION_COOKIE_NAME}=${signSessionToken({sub:owner},hash)}`;
  const ownerAdmin=`${ADMIN_SESSION_COOKIE_NAME}=${signSessionToken({sub:owner,sessionPurpose:'admin'},hash)}`;
  const call=(path:string,method='GET',cookie?:string,body?:unknown,headers:Record<string,string>={})=>fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const sockets:ReturnType<typeof connect>[]=[];
  async function socket(auth:Record<string,unknown>,origin?:string,cookie?:string,transport:'polling'|'websocket'='websocket'){
    const s=connect(base,{auth,transports:[transport],reconnection:false,autoConnect:false,
      extraHeaders:{...(origin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})}});sockets.push(s);
    const result=await new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Socket test timeout')),4000);
      s.once('fixture:identity',x=>{clearTimeout(timer);resolve(x)});s.once('connect_error',e=>{clearTimeout(timer);resolve({error:e.message})});s.connect();});
    return {s,result};
  }
  try{
    check('unauthenticated wallet rejected',(await call('/api/wallet/history')).status===401);
    check('unauthenticated account mutation rejected',(await call('/api/account/change-password','POST',undefined,{newPassword:password})).status===401);
    check('ordinary account cannot invoke admin API',(await call('/api/admin/users','GET',`${ADMIN_SESSION_COOKIE_NAME}=${signSessionToken({sub:a,sessionPurpose:'admin'},hash)}`)).status===403);
    check('owner user session cannot be relabeled as an admin session',(await call('/api/admin/me','GET',ownerUser.replace(SESSION_COOKIE_NAME,ADMIN_SESSION_COOKIE_NAME))).status===401);
    check('admin proof cannot be relabeled as a user session',(await call('/api/auth/me','GET',ownerAdmin.replace(ADMIN_SESSION_COOKIE_NAME,SESSION_COOKIE_NAME))).status===401);
    check('real owner admin session is accepted',(await call('/api/admin/me','GET',ownerAdmin)).status===200);
    const forged=jwt.sign({sub:owner},'forged-test-key',{expiresIn:60});
    check('forged JWT rejected',(await call('/api/auth/me','GET',`${SESSION_COOKIE_NAME}=${forged}`)).status===401);
    check('unsigned token rejected',verifySessionToken(jwt.sign({sub:a},'',{algorithm:'none'}))===null);
    check('signed token without expiry rejected',verifySessionToken(jwt.sign({sub:a,jti:randomUUID(),sessionPurpose:'user'},process.env.JWT_SECRET!))===null);
    check('expired token rejected',verifySessionToken(jwt.sign({sub:a,jti:randomUUID(),sessionPurpose:'user'},process.env.JWT_SECRET!,{expiresIn:-1}))===null);
    const privateMe=await call('/api/auth/me?userId='+b,'GET',cookieA),me=await privateMe.json() as any;
    check('client userId cannot select another account',me.user.id===a&&me.user.email!==b+'@example.invalid');
    check('private response cannot be cached',privateMe.headers.get('cache-control')==='no-store');
    check('HTTP security headers present',privateMe.headers.get('x-content-type-options')==='nosniff'&&privateMe.headers.get('x-frame-options')==='DENY');
    check('CSP forbids hostile framing',privateMe.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    const unknownBefore=process.env.NODE_ENV;process.env.NODE_ENV='production';
    const secureHeaders=await call('/api/limited/x');process.env.NODE_ENV=unknownBefore;
    check('hosted HTTP sends HSTS',secureHeaders.headers.get('strict-transport-security')==='max-age=15552000');
    await pool.query('INSERT INTO ledger_entries(id,user_id,currency,amount,reason) VALUES($1,$2,\'COINS\',17,$3)',[randomUUID(),b,'security_private_'+prefix]);
    const history=await (await call('/api/wallet/history?userId='+b,'GET',cookieA)).json() as any;
    check('wallet history excludes another user ledger row',!history.history.some((x:any)=>x.reason==='security_private_'+prefix));
    await pool.query(`INSERT INTO friendships(id,requester_id,addressee_id,status) VALUES($1,$2,$3,'pending')`,['f_'+prefix,b,owner]);
    check('cross-user friend acceptance rejected',(await call('/api/friends/f_'+prefix+'/accept','POST',cookieA,{})).status===404);
    check('cross-user friend deletion rejected',(await call('/api/friends/f_'+prefix,'DELETE',cookieA)).status===404);
    const roleBefore=(await pool.query('SELECT role FROM users WHERE id=$1',[a])).rows[0].role;
    check('mass assignment cannot grant privileges',(await call('/api/auth/policies/accept','POST',cookieA,{policyType:'TERMS',policyVersion:'draft-1.0',role:'OWNER',balance:999999})).status===200&&(await pool.query('SELECT role FROM users WHERE id=$1',[a])).rows[0].role===roleBefore);
    check('foreign-origin cookie mutation denied',(await call('/api/auth/logout','POST',cookieA,{}, {Origin:'https://evil.example'})).status===403);
    check('cross-site fetch without Origin denied',(await call('/api/auth/logout','POST',cookieA,undefined,{'Sec-Fetch-Site':'cross-site'})).status===403);
    check('form encoded auth body denied',(await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'username=x&password=x'})).status===415);
    check('approved frontend still has credentialed CORS',(await call('/api/auth/me','GET',cookieA,undefined,{Origin:'http://localhost:5173'})).headers.get('access-control-allow-origin')==='http://localhost:5173');
    for(const transport of ['polling','websocket'] as const){const hostile=await socket({},'https://evil.example',cookieA,transport);check(`${transport} rejects hostile origin before identity`,Boolean(hostile.result.error));hostile.s.disconnect();}
    const invalid=await socket({socketTicket:'invalid'},undefined,cookieA);check('explicit invalid socket proof fails closed',Boolean(invalid.result.error));invalid.s.disconnect();
    const guest=await socket({userId:a});check('guest cannot impersonate client supplied user ID',guest.result.guest&&guest.result.id!==a);guest.s.disconnect();
    const guestProof=await (await call('/api/auth/guest-ticket','POST',undefined,{})).json() as any;
    const guest1=await socket({guestTicket:guestProof.token});const guest2=await socket({guestTicket:guestProof.token});
    check('signed guest capability preserves reconnect identity',guest1.result.guest&&guest1.result.id===guest2.result.id);guest1.s.disconnect();guest2.s.disconnect();
    const spoofedGuest=await socket({guestId:guest1.result.id.slice(6)});
    check('knowing a public guest ID cannot hijack its session',spoofedGuest.result.id!==guest1.result.id);spoofedGuest.s.disconnect();
    const badGuestProof=await socket({guestTicket:'forged'});check('forged explicit guest proof is rejected',Boolean(badGuestProof.result.error));badGuestProof.s.disconnect();
    check('guest capability cannot authenticate HTTP accounts',(await call('/api/auth/me','GET',`${SESSION_COOKIE_NAME}=${guestProof.token}`)).status===401);
    const ticket=await (await call('/api/auth/socket-ticket','POST',cookieA,{})).json() as any;
    const originalQuery=pool.query;
    try {
      pool.query=(async()=>{throw Error('database is unavailable')}) as typeof pool.query;
      const unavailable=await socket({socketTicket:ticket.token});
      check('database outage rejects socket authentication without crashing',unavailable.result.error==='authentication_unavailable');unavailable.s.disconnect();
    } finally {pool.query=originalQuery;}
    const active=await socket({socketTicket:ticket.token});check('HTTP-issued proof authenticates socket',active.result.id===a&&!active.result.guest);
    const disconnected=new Promise<void>(r=>active.s.once('disconnect',()=>r()));
    check('logout succeeds',(await call('/api/auth/logout','POST',cookieA)).status===204);
    await disconnected;check('logout immediately disconnects bound socket',!active.s.connected);
    check('copied cookie is rejected after logout',(await call('/api/auth/me','GET',cookieA)).status===401);
    const stale=await socket({socketTicket:ticket.token});check('copied socket ticket is rejected after logout',Boolean(stale.result.error));stale.s.disconnect();
    cookieA=`${SESSION_COOKIE_NAME}=${signSessionToken({sub:a},hash)}`;
    const change=await call('/api/account/change-password','POST',cookieA,{currentPassword:password,newPassword:'ChangedSecurityPassword2!'});
    check('password change succeeds',change.status===200);
    check('old password session is rejected',(await call('/api/auth/me','GET',cookieA)).status===401);
    const changedCookie=change.headers.get('set-cookie')!.split(';')[0];
    check('current browser gets a fresh valid session',(await call('/api/auth/me','GET',changedCookie)).status===200);
    const reset=randomUUID();await pool.query('INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval \'1 hour\')',[randomUUID(),a,digest(reset)]);
    const resetResults=await Promise.all(['ResetWinnerPassword3!','ResetWinnerPassword4!'].map(newPassword=>call('/api/auth/reset-password','POST',undefined,{token:reset,newPassword})));
    check('exactly one concurrent reset consumes the token',resetResults.filter(r=>r.status===200).length===1&&resetResults.filter(r=>r.status===400).length===1);
    check('reset token cannot be replayed',(await call('/api/auth/reset-password','POST',undefined,{token:reset,newPassword:'ResetAgainPassword5!'})).status===400);
    check('reset invalidates all older user sessions',(await call('/api/auth/me','GET',changedCookie)).status===401);
    check('unrelated user session survives another account recovery',(await call('/api/auth/me','GET',cookieB)).status===200);
    const verify=randomUUID();await pool.query('INSERT INTO email_verification_tokens(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval \'1 hour\')',[randomUUID(),b,digest(verify)]);
    const verifications=await Promise.all([1,2].map(()=>call('/api/auth/verify-email','POST',undefined,{token:verify})));
    check('verification token is consumed once under concurrency',verifications.filter(r=>r.status===200).length===1&&verifications.filter(r=>r.status===400).length===1);
    const protectedOwner=signSessionToken({sub:owner,sessionPurpose:'admin'},hash);
    const loggedOutAdmin=signSessionToken({sub:owner,sessionPurpose:'admin'},hash);
    check('admin logout revokes only the supplied administrator session',(await call('/api/admin/logout','POST',`${ADMIN_SESSION_COOKIE_NAME}=${loggedOutAdmin}`)).status===204&&
      (await call('/api/admin/me','GET',`${ADMIN_SESSION_COOKIE_NAME}=${loggedOutAdmin}`)).status===403&&
      (await call('/api/admin/me','GET',`${ADMIN_SESSION_COOKIE_NAME}=${protectedOwner}`)).status===200);
    await pool.query('UPDATE users SET password_hash=$2 WHERE id=$1',[owner,await hashPassword('ResetOwnerPassword5!')]);
    check('password changes invalidate admin sessions',(await call('/api/admin/me','GET',`${ADMIN_SESSION_COOKIE_NAME}=${protectedOwner}`)).status===403);
    for(const amount of [1.1,-1,null,'100',9007199254740992]) check(`sandbox rejects malformed amount ${String(amount)}`,(await call('/api/competitions/sandbox-faucet','POST',cookieB,{amountMinor:amount})).status===400);
    check('mock financial routes cannot be enabled by request body',(await call('/api/staging-mock-commercial/deposits','POST',cookieB,{amountMinor:500,enabled:true})).status===404);
    await call('/api/limited/one');const varied=await call('/api/limited/two');
    check('changing route identifiers does not reset rate limit',varied.status===429);
    const long='A'.repeat(72)+'OriginalSuffix!',longHash=await hashPassword(long);
    check('long-password correct suffix authenticates',await verifyPassword(long,longHash));
    check('long-password suffix changes cannot authenticate',!await verifyPassword('A'.repeat(72)+'AttackerSuffix!',longHash));
    const unicode='გ'.repeat(30)+'Original!',unicodeHash=await hashPassword(unicode);
    check('multibyte password suffix is significant',!await verifyPassword('გ'.repeat(30)+'Attacker!',unicodeHash));
    check('legacy bcrypt password remains readable',await verifyPassword(password,hash));
    const dangerous={newPassword:'do-not-log',currentPassword:'do-not-log',resetToken:'do-not-log',socketTicket:'do-not-log',signature:'do-not-log',DATABASE_URL:'do-not-log','Set-Cookie':'do-not-log'};
    check('new recovery and transport secret fields are redacted',!JSON.stringify(redactSensitiveData(dangerous)).includes('do-not-log'));
    const circular:any={};circular.self=circular;check('logger handles cyclic structures',Boolean(redactSensitiveData(circular)));
    const output:unknown[][]=[],originalConsole=console.error;console.error=(...args)=>output.push(args);
    try{logger.error('failed Bearer secret-demo',new Error('postgresql://user:private-demo@db.invalid/database '+signSessionToken({sub:b},hash)));}finally{console.error=originalConsole;}
    check('Error metadata redacts JWTs credentials and bearer tokens',!JSON.stringify(output).includes('private-demo')&&!JSON.stringify(output).includes('secret-demo')&&!JSON.stringify(output).includes('eyJ'));
    check('password hashes are scrubbed inside exception messages',!JSON.stringify(redactSensitiveData(new Error('hash='+hash))).includes(hash));
    const safeError=playerCompetitionError(Object.assign(new Error('SQL private schema postgres://private-secret'),{code:'ECONNREFUSED'}),'COMPETITION_JOIN_FAILED');
    check('socket failures hide internal exception messages and codes',safeError.code==='COMPETITION_JOIN_FAILED'&&!safeError.message.includes('SQL')&&!safeError.message.includes('private-secret'));
    const priorEnvironment=process.env.APP_ENV,priorRuntime=process.env.NODE_ENV;
    process.env.APP_ENV='staging';process.env.NODE_ENV='production';
    const delivery=await sendPasswordResetEmail('test@example.invalid','fixture',randomUUID());
    process.env.APP_ENV=priorEnvironment;process.env.NODE_ENV=priorRuntime;
    check('hosted logger email cannot claim successful delivery',!delivery.success);
    check('hosted recovery tokens are not retained in test history',getSentEmailsHistory().length===0);
    // Test actual grants, including a pre-existing insecure grant, in this disposable schema only.
    await pool.query("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$");
    await pool.query('GRANT SELECT,UPDATE ON users TO anon,authenticated');
    check('fixture demonstrates anonymous table access before hardening',(await pool.query("SELECT has_table_privilege('anon','users','SELECT') allowed")).rows[0].allowed);
    await pool.query(readFileSync('packages/server/drizzle/0014_security_boundaries.sql','utf8').split('--> statement-breakpoint')[1]);
    for(const role of ['anon','authenticated']){
      check(`${role} cannot read or mutate private users or financial tables`,!(await pool.query(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relkind='r' AND (has_table_privilege($1,c.oid,'SELECT') OR has_table_privilege($1,c.oid,'INSERT') OR has_table_privilege($1,c.oid,'UPDATE') OR has_table_privilege($1,c.oid,'DELETE'))`,[role])).rowCount);
    }
    await pool.query('CREATE TABLE security_future_private(id integer)');
    check('future backend-created tables do not regain browser access',!(await pool.query("SELECT has_table_privilege('anon','security_future_private','SELECT') OR has_table_privilege('authenticated','security_future_private','INSERT') allowed")).rows[0].allowed);
    const ledger=await new CommercialLedger(pool).reconcile();check('commercial ledger still reconciles',ledger.totalMinor==='0'&&ledger.unbalancedTransactions===0);
    for(const amount of [NaN,Infinity,-1,1.1,Number.MAX_SAFE_INTEGER+1]){let denied=false;try{assertFinancialAmount(amount)}catch{denied=true}check(`commercial amount rejects ${String(amount)}`,denied);}
  }finally{for(const s of sockets)s.disconnect();await new Promise<void>(r=>io.close(()=>r()));await cleanup();}
  console.log(`Security boundaries: ${passed} PASS, ${failed} FAIL`);if(failed)process.exitCode=1;
}
void main().catch(e=>{console.error('Security boundary check failed:',e.message);process.exitCode=1});

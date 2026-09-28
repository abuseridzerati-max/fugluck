import './require-disposable-test-database.ts';
import { createHmac } from 'node:crypto';
import type { Pool } from 'pg';
import { getDatabaseTargetIdentity } from '../packages/server/src/config/deploymentIdentity';
import { validateStartupConfig } from '../packages/server/src/config/startup';
import { HostedMockPaymentProvider } from '../packages/server/src/payments/hostedMockProvider';
import { ProviderError } from '../packages/server/src/payments/provider';
import { MOCK_TEMPLATES, isMockTemplate, stagingMockAction, stagingMockMode } from '../packages/server/src/config/stagingMockCommercial';

let passed=0,failed=0;
const check=(name:string,ok:unknown)=>{console.log(`${ok?'PASS':'FAIL'} ${name}`);ok?passed++:failed++;};
const url='postgresql://postgres.gzfcucvxfzzjzjtgkwpd:fixture@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require';
const env:NodeJS.ProcessEnv={APP_ENV:'staging',NODE_ENV:'production',RENDER_SERVICE_ID:'srv-da2c50c9v7es73db3dkg',
  DATABASE_URL:url,DATABASE_TARGET_FINGERPRINT:getDatabaseTargetIdentity(url)!.fingerprint,DATABASE_REGION:'eu-central-1',
  JWT_SECRET:'x'.repeat(64),GIT_SHA:'a'.repeat(40),CLIENT_ORIGIN:'https://staging.fugluck.com',
  APP_URL:'https://staging.fugluck.com',ALLOWED_ORIGINS:'https://staging.fugluck.com',
  STAGING_MOCK_COMMERCIAL_ENABLED:'true',STAGING_MOCK_DEPOSITS_ENABLED:'true',
  STAGING_MOCK_COMPETITIONS_ENABLED:'true',STAGING_MOCK_WITHDRAWALS_ENABLED:'true',
  STAGING_MOCK_AUTHORIZATION:'a'.repeat(64),STAGING_MOCK_PROVIDER_KEY:'b'.repeat(64),
  STAGING_MOCK_USER_IDS:'11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222',
  REAL_MONEY_ENABLED:'false',REAL_MONEY_DEPOSITS_ENABLED:'false',REAL_MONEY_WITHDRAWALS_ENABLED:'false',
  REAL_MONEY_COMPETITIONS_ENABLED:'false'};
const prior={...process.env};
async function main(){
  check('registered staging mock config passes startup validation',validateStartupConfig(env).valid);
  check('real-money switches stay false while mock actions run',stagingMockMode(env)&&
    ['REAL_MONEY_ENABLED','REAL_MONEY_DEPOSITS_ENABLED','REAL_MONEY_WITHDRAWALS_ENABLED','REAL_MONEY_COMPETITIONS_ENABLED'].every(k=>env[k]==='false'));
  check('legacy mock game templates remain isolated',isMockTemplate(MOCK_TEMPLATES['space-blaster'])&&
    isMockTemplate(MOCK_TEMPLATES['cyber-hopper'])&&!isMockTemplate('tmpl_standard_space_blaster'));
  check('mock tournament names require an exact private namespace',isMockTemplate('tmpl_staging_mock_ko_'+'a'.repeat(32))&&!isMockTemplate('tmpl_ko_'+'a'.repeat(32))&&!isMockTemplate('tmpl_staging_mock_ko_arbitrary')&&!isMockTemplate('tmpl_staging_mock_ko_'+'a'.repeat(33)));
  check('independent deposit kill switch preserves competition action',!stagingMockAction('deposits',{...env,STAGING_MOCK_DEPOSITS_ENABLED:'false'})&&
    stagingMockAction('competitions',{...env,STAGING_MOCK_DEPOSITS_ENABLED:'false'}));
  check('production app environment refuses mock activation',!stagingMockMode({...env,APP_ENV:'production'}));
  check('unregistered database fingerprint refuses mock activation',!stagingMockMode({...env,DATABASE_TARGET_FINGERPRINT:'0'.repeat(64)}));
  Object.assign(process.env,env);
  const provider=new HostedMockPaymentProvider({} as Pool,env.STAGING_MOCK_PROVIDER_KEY!);
  const order={amountMinor:500,currency:'GEL' as const,idempotencyKey:'deposit:e2e-test-1'};
  const first=await provider.createDeposit(order);
  const again=await new HostedMockPaymentProvider({} as Pool,env.STAGING_MOCK_PROVIDER_KEY!).createDeposit(order);
  check('mock references survive provider re-instantiation without a network call',first.reference===again.reference&&first.status==='PENDING');
  const event={...first,eventId:'evt_staging_test_1',occurredAt:new Date().toISOString(),status:'SUCCEEDED' as const};
  const body=JSON.stringify(event),signature=createHmac('sha256',env.STAGING_MOCK_PROVIDER_KEY!).update(body).digest('hex');
  check('signed provider event verifies',provider.verifyWebhook(body,signature).eventId===event.eventId);
  let invalid=false;try{provider.verifyWebhook(body,'0'.repeat(64))}catch(e){invalid=e instanceof ProviderError&&e.code==='INVALID_SIGNATURE'}
  check('invalid provider signature is rejected',invalid);
  HostedMockPaymentProvider.setOneShotFault('PAYOUT','withdrawal:e2e-test-2','TIMEOUT');
  let timedOut=false;try{await provider.createPayout({amountMinor:300,currency:'GEL',idempotencyKey:'withdrawal:e2e-test-2'})}
  catch(e){timedOut=e instanceof ProviderError&&e.code==='TIMEOUT'}
  const retry=await provider.createPayout({amountMinor:300,currency:'GEL',idempotencyKey:'withdrawal:e2e-test-2'});
  check('one-shot payout timeout recovers under same idempotency key',timedOut&&retry.reference.startsWith('mock_stage_'));
  HostedMockPaymentProvider.setOneShotFault('PAYOUT','withdrawal:e2e-test-3','REJECTED');
  let rejected=false;try{await provider.createPayout({amountMinor:300,currency:'GEL',idempotencyKey:'withdrawal:e2e-test-3'})}
  catch(e){rejected=e instanceof ProviderError&&e.code==='REJECTED'}
  check('one-shot payout rejection is definitive',rejected);
  let productionDenied=false;Object.assign(process.env,{APP_ENV:'production'});
  try{new HostedMockPaymentProvider({} as Pool,env.STAGING_MOCK_PROVIDER_KEY!)}catch{productionDenied=true}
  check('hosted mock provider cannot construct in production',productionDenied);
  console.log(`STAGING MOCK COMMERCIAL CHECK: ${passed} passed, ${failed} failed`);
  if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{
  for(const key of Object.keys(process.env))if(!(key in prior))delete process.env[key];
  Object.assign(process.env,prior);
});

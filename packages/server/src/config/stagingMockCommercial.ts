import { timingSafeEqual } from 'node:crypto';
import { getAppEnvironment } from './environment';
import { getDatabaseTargetIdentity, isHostedEnvironment } from './deploymentIdentity';

export const MOCK_TEMPLATES = {
  'space-blaster': 'tmpl_staging_mock_7i_space',
  'cyber-hopper': 'tmpl_staging_mock_7i_cyber',
} as const;

const switches = {
  enabled: 'STAGING_MOCK_COMMERCIAL_ENABLED',
  deposits: 'STAGING_MOCK_DEPOSITS_ENABLED',
  competitions: 'STAGING_MOCK_COMPETITIONS_ENABLED',
  withdrawals: 'STAGING_MOCK_WITHDRAWALS_ENABLED',
} as const;

export function stagingMockMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const target=getDatabaseTargetIdentity(env.DATABASE_URL);
  const ids=(env.STAGING_MOCK_USER_IDS??'').split(',').filter(Boolean);
  return isHostedEnvironment(env) && getAppEnvironment(env) === 'staging' &&
    env.NODE_ENV === 'production' && env.RENDER_SERVICE_ID === 'srv-da2c50c9v7es73db3dkg' &&
    target?.expectedStagingTarget===true && target.fingerprint===env.DATABASE_TARGET_FINGERPRINT && target.tlsPermitted &&
    /^[a-f0-9]{64}$/i.test(env.STAGING_MOCK_AUTHORIZATION??'') &&
    /^[a-f0-9]{64}$/i.test(env.STAGING_MOCK_PROVIDER_KEY??'') &&
    ids.length===2 && new Set(ids).size===2 && ids.every(id=>/^[a-f0-9-]{36}$/i.test(id)) &&
    env[switches.enabled] === 'true' && Object.values({money:env.REAL_MONEY_ENABLED,
      deposits:env.REAL_MONEY_DEPOSITS_ENABLED,withdrawals:env.REAL_MONEY_WITHDRAWALS_ENABLED,
      competitions:env.REAL_MONEY_COMPETITIONS_ENABLED}).every(value=>value===undefined||value==='false');
}

export type StagingMockAction = 'deposits'|'competitions'|'withdrawals';
export function stagingMockAction(action:StagingMockAction, env:NodeJS.ProcessEnv=process.env):boolean {
  return stagingMockMode(env) && env[switches[action]] === 'true';
}

export function isMockTemplate(id:string):boolean {
  return Object.values(MOCK_TEMPLATES).includes(id as typeof MOCK_TEMPLATES[keyof typeof MOCK_TEMPLATES]);
}

export function allowedMockUser(userId:string,env:NodeJS.ProcessEnv=process.env):boolean {
  return stagingMockMode(env) && (env.STAGING_MOCK_USER_IDS??'').split(',').includes(userId);
}

export function validMockAuthorization(value:unknown,env:NodeJS.ProcessEnv=process.env):boolean {
  const expected=env.STAGING_MOCK_AUTHORIZATION;
  if(!stagingMockMode(env)||typeof value!=='string'||!expected||value.length!==expected.length)return false;
  return timingSafeEqual(Buffer.from(value),Buffer.from(expected));
}

export function validateStagingMockConfig(env:NodeJS.ProcessEnv):string[] {
  const errors:string[]=[];
  const enabled=env[switches.enabled]==='true';
  for(const [name,key] of Object.entries(switches)) {
    const value=env[key];
    if(value!==undefined && value!=='true' && value!=='false') errors.push(`${key} must be true, false, or absent.`);
    if(name!=='enabled'&&value==='true'&&!enabled) errors.push(`${key} requires STAGING_MOCK_COMMERCIAL_ENABLED=true.`);
  }
  if(!enabled) return errors;
  if(getAppEnvironment(env)!=='staging'||env.NODE_ENV!=='production'||
     env.RENDER_SERVICE_ID!=='srv-da2c50c9v7es73db3dkg') errors.push('Staging mock mode requires the registered hosted staging service.');
  if(!/^[a-f0-9]{64}$/i.test(env.STAGING_MOCK_AUTHORIZATION??'')) errors.push('Staging mock authorization must be a 256-bit hex secret.');
  if(!/^[a-f0-9]{64}$/i.test(env.STAGING_MOCK_PROVIDER_KEY??'')) errors.push('Staging mock provider key must be a separate 256-bit hex secret.');
  const ids=(env.STAGING_MOCK_USER_IDS??'').split(',').filter(Boolean);
  if(ids.length!==2||new Set(ids).size!==2||ids.some(id=>!/^[a-f0-9-]{36}$/i.test(id)))
    errors.push('Staging mock mode requires exactly two distinct synthetic user IDs.');
  return errors;
}

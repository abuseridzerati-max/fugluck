import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { GAME_COMPETITION_CERTIFICATIONS, type TournamentConfig, type TournamentTerms, type SpecialCycle, type CompetitionProduct, type TournamentCapacity } from '@fugluck/shared';
import { pool } from '../db/client';
import { defaultTournamentConfig, freezeTournamentTerms, nextSpecialCycle, validateTournamentConfig } from './tournamentRules';
import { getAppEnvironment } from '../config/environment';
import { COMMERCIAL_SWITCHES } from '../config/commercialSafety';

export const knockoutEnabled=()=>process.env.ENABLE_KNOCKOUT_TOURNAMENTS==='true'&&process.env.ENABLE_COMPETITION_AUTHORITY==='true'&&['test','development','staging'].includes(getAppEnvironment())&&!Object.values(COMMERCIAL_SWITCHES).some(k=>process.env[k]&&process.env[k]!=='false');
// Session locks cannot consume the pool needed to finish accounting transactions.
const lockPool=new Pool({...pool.options,max:4,connectionTimeoutMillis:10000});
export const closeTournamentLocks=()=>lockPool.end();
const localLocks=new Map<string,Promise<void>>();
export type ProductRow={template_id:string;game_id:string;product:CompetitionProduct;terms:TournamentTerms;cycle_id:string|null;provenance:'SANDBOX'|'STAGING_MOCK'|'LIVE'};
export async function tournamentTx<T>(fn:(c:PoolClient)=>Promise<T>) {
  const c=await pool.connect();try{await c.query('BEGIN');const value=await fn(c);await c.query('COMMIT');return value;}
  catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
/** A pinned transaction spans the durable intent and accounting port calls, including through transaction poolers. */
export async function tournamentLock<T>(key:string,fn:()=>Promise<T>,tryOnly=false):Promise<T|undefined> {
  const previous=localLocks.get(key);if(tryOnly&&previous)return;
  let release!:()=>void;const gate=new Promise<void>(r=>release=r),tail=(previous??Promise.resolve()).then(()=>gate);localLocks.set(key,tail);
  await previous;
  try{return await durableLock(key,fn,tryOnly);}finally{release();if(localLocks.get(key)===tail)localLocks.delete(key);}
}
async function durableLock<T>(key:string,fn:()=>Promise<T>,tryOnly:boolean):Promise<T|undefined>{
  const c=await lockPool.connect();
  try{await c.query('BEGIN');
    if(tryOnly){const held=(await c.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS held',[key])).rows[0].held;if(!held){await c.query('ROLLBACK');return;}}
    else await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);
    const result=await fn();await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function currentTournamentConfig(gameId:string,c?:PoolClient):Promise<{revision:number;config:TournamentConfig}> {
  if(!['space-blaster','cyber-hopper'].includes(gameId))throw Error('GAME_NOT_CERTIFIED');
  const q=c??pool;const row=(await q.query('SELECT revision,config FROM competition_product_configs WHERE game_id=$1 AND active',[gameId])).rows[0];
  return row??{revision:1,config:defaultTournamentConfig(gameId)};
}
/** Internal operator domain method; no client route accepts configuration or financial provenance. */
export async function saveTournamentConfig(gameId:string,config:TournamentConfig,actorId:string) {
  validateTournamentConfig(config);if(!actorId||!['space-blaster','cyber-hopper'].includes(gameId))throw Error('INVALID_TOURNAMENT_CONFIG');
  return tournamentTx(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`product-config:${gameId}`]);
    const revision=Number((await c.query('SELECT COALESCE(max(revision),0)+1 n FROM competition_product_configs WHERE game_id=$1',[gameId])).rows[0].n);
    await c.query('UPDATE competition_product_configs SET active=false WHERE game_id=$1 AND active',[gameId]);
    await c.query('INSERT INTO competition_product_configs(game_id,revision,config,actor_id) VALUES($1,$2,$3,$4)',[gameId,revision,config,actorId]);
    return revision;
  });
}
export function cycleFromRow(row:any):SpecialCycle {
  return {id:row.id,gameId:row.game_id,product:row.product,opensAt:new Date(row.opens_at).toISOString(),cutoffAt:new Date(row.cutoff_at).toISOString(),
    startsAt:new Date(row.starts_at).toISOString(),endsAt:new Date(row.ends_at).toISOString(),timezone:row.timezone,capacity:row.terms.capacity};
}
export async function ensureSpecialCycle(c:PoolClient,gameId:string,product:'PROMO'|'GIFT',now:number) {
  const {config,revision}=await currentTournamentConfig(gameId,c);const cycle=nextSpecialCycle(gameId,product,config,now);
  const terms=freezeTournamentTerms(product,cycle.capacity,config,revision);
  await c.query(`INSERT INTO competition_special_cycles(id,game_id,product,opens_at,cutoff_at,starts_at,ends_at,timezone,terms)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,[cycle.id,gameId,product,cycle.opensAt,cycle.cutoffAt,cycle.startsAt,cycle.endsAt,cycle.timezone,terms]);
  return (await c.query('SELECT * FROM competition_special_cycles WHERE id=$1',[cycle.id])).rows[0];
}
export async function materializeTournamentProduct(c:PoolClient,gameId:string,terms:TournamentTerms,cycleId:string|null=null,provenance:'SANDBOX'|'STAGING_MOCK'='SANDBOX') {
  const identity=cycleId??`${gameId}:STANDARD:${terms.capacity}:${terms.configRevision}`;
  const id=`${provenance==='STAGING_MOCK'?'tmpl_staging_mock_ko_':'tmpl_ko_'}${createHash('sha256').update(identity).digest('hex').slice(0,32)}`;
  const version=GAME_COMPETITION_CERTIFICATIONS[gameId]?.authorityVersion;if(!version)throw Error('GAME_NOT_CERTIFIED');
  await c.query(`INSERT INTO competition_templates(id,game_id,title,format,participant_capacity,currency,entry_fee_minor,rules_version,skill_assessment_version,jurisdiction,enabled)
    VALUES($1,$2,$3,'TOURNAMENT_BRACKET',$4,'GEL',$5,$6,'knockout-v1','GE',true) ON CONFLICT(id) DO NOTHING`,[id,gameId,terms.product,terms.capacity,terms.entryMinor,version]);
  await c.query(`INSERT INTO competition_template_prizes(id,template_id,placement,amount_minor,currency)
    VALUES($1,$2,1,$3,'GEL') ON CONFLICT DO NOTHING`,[`prize_${id}`,id,terms.prizeMinor]);
  await c.query(`INSERT INTO competition_products(template_id,game_id,product,terms,cycle_id,provenance)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,[id,gameId,terms.product,terms,cycleId,provenance]);
  return id;
}
export async function ensureTournamentCatalog(now=Date.now()) {
  return tournamentTx(async c=>{
    const games=['space-blaster','cyber-hopper'];
    let configs=(await c.query('SELECT game_id,revision,config FROM competition_product_configs WHERE game_id=ANY($1::text[]) AND active',[games])).rows;
    if(configs.length!==games.length){
      const missing=games.filter(game=>!configs.some(row=>row.game_id===game)).map(game=>({game_id:game,config:defaultTournamentConfig(game)}));
      await c.query(`INSERT INTO competition_product_configs(game_id,revision,config,actor_id)
        SELECT game_id,1,config,'default-product-config' FROM jsonb_to_recordset($1::jsonb) AS x(game_id text,config jsonb) ON CONFLICT DO NOTHING`,[JSON.stringify(missing)]);
      configs=(await c.query('SELECT game_id,revision,config FROM competition_product_configs WHERE game_id=ANY($1::text[]) AND active',[games])).rows;
    }
    const plannedCycles=configs.flatMap(({game_id,config,revision})=>(['PROMO','GIFT'] as const).map(product=>{
      const cycle=nextSpecialCycle(game_id,product,config,now);
      return {...cycle,terms:freezeTournamentTerms(product,cycle.capacity,config,revision)};
    }));
    let cycles=(await c.query('SELECT * FROM competition_special_cycles WHERE id=ANY($1::text[])',[plannedCycles.map(cycle=>cycle.id)])).rows;
    const missingCycles=plannedCycles.filter(cycle=>!cycles.some(row=>row.id===cycle.id));
    if(missingCycles.length){
      // Unique cycle identities arbitrate concurrent schedulers. The persisted winner's terms stay frozen.
      await c.query(`INSERT INTO competition_special_cycles(id,game_id,product,opens_at,cutoff_at,starts_at,ends_at,timezone,terms)
        SELECT id,"gameId",product,"opensAt","cutoffAt","startsAt","endsAt",timezone,terms FROM jsonb_to_recordset($1::jsonb)
        AS x(id text,"gameId" text,product text,"opensAt" timestamptz,"cutoffAt" timestamptz,"startsAt" timestamptz,"endsAt" timestamptz,timezone text,terms jsonb) ON CONFLICT DO NOTHING`,[JSON.stringify(missingCycles)]);
      cycles=(await c.query('SELECT * FROM competition_special_cycles WHERE id=ANY($1::text[])',[plannedCycles.map(cycle=>cycle.id)])).rows;
    }
    const products=configs.flatMap(({game_id,config,revision})=>[
      ...config.capacities.map((capacity:TournamentCapacity)=>({game_id,terms:freezeTournamentTerms('STANDARD',capacity,config,revision),cycle_id:null as string|null})),
      ...cycles.filter(cycle=>cycle.game_id===game_id).map(cycle=>({game_id,terms:cycle.terms as TournamentTerms,cycle_id:cycle.id as string|null})),
    ]).map(product=>({...product,id:`tmpl_ko_${createHash('sha256').update(product.cycle_id??`${product.game_id}:STANDARD:${product.terms.capacity}:${product.terms.configRevision}`).digest('hex').slice(0,32)}`,
      version:GAME_COMPETITION_CERTIFICATIONS[product.game_id].authorityVersion}));
    const ids=products.map(product=>product.id);
    const existing=(await c.query('SELECT template_id FROM competition_products WHERE template_id=ANY($1::text[])',[ids])).rows;
    const missing=products.filter(product=>!existing.some(row=>row.template_id===product.id));
    if(missing.length){
      const data=JSON.stringify(missing);
      await c.query(`INSERT INTO competition_templates(id,game_id,title,format,participant_capacity,currency,entry_fee_minor,rules_version,skill_assessment_version,jurisdiction,enabled)
        SELECT id,game_id,terms->>'product','TOURNAMENT_BRACKET',(terms->>'capacity')::int,'GEL',(terms->>'entryMinor')::int,version,'knockout-v1','GE',true
        FROM jsonb_to_recordset($1::jsonb) AS x(id text,game_id text,terms jsonb,version text) ON CONFLICT DO NOTHING`,[data]);
      await c.query(`INSERT INTO competition_template_prizes(id,template_id,placement,amount_minor,currency)
        SELECT 'prize_'||id,id,1,(terms->>'prizeMinor')::int,'GEL' FROM jsonb_to_recordset($1::jsonb) AS x(id text,terms jsonb) ON CONFLICT DO NOTHING`,[data]);
      await c.query(`INSERT INTO competition_products(template_id,game_id,product,terms,cycle_id,provenance)
        SELECT id,game_id,terms->>'product',terms,cycle_id,'SANDBOX' FROM jsonb_to_recordset($1::jsonb) AS x(id text,game_id text,terms jsonb,cycle_id text) ON CONFLICT DO NOTHING`,[data]);
    }
    return ids;
  });
}
export async function readProduct(templateId:string,c?:PoolClient):Promise<ProductRow|null> {
  return (await (c??pool).query('SELECT * FROM competition_products WHERE template_id=$1',[templateId])).rows[0]??null;
}
export async function createTournamentInstance(c:PoolClient,product:ProductRow) {
  const template=(await c.query('SELECT * FROM competition_templates WHERE id=$1 AND enabled',[product.template_id])).rows[0];
  if(!template||GAME_COMPETITION_CERTIFICATIONS[template.game_id]?.authorityVersion!==template.rules_version)throw Error('GAME_NOT_CERTIFIED');
  const terms=product.terms,id=`inst_${randomUUID()}`;
  await c.query(`INSERT INTO competition_instances(id,template_id,game_id,format,participant_capacity,currency,entry_fee_minor,rules_version,skill_assessment_version,jurisdiction)
    VALUES($1,$2,$3,'TOURNAMENT_BRACKET',$4,'GEL',$5,$6,$7,$8)`,[id,product.template_id,product.game_id,terms.capacity,terms.entryMinor,template.rules_version,template.skill_assessment_version,template.jurisdiction]);
  await c.query('INSERT INTO competition_instance_prizes(id,instance_id,placement,amount_minor,currency) VALUES($1,$2,1,$3,\'GEL\')',[`ip_${randomUUID()}`,id,terms.prizeMinor]);
  await c.query(`INSERT INTO competition_tournaments(instance_id,terms,cycle_id,provenance) VALUES($1,$2,$3,$4)`,[id,terms,product.cycle_id,product.provenance]);
  return id;
}

import './require-disposable-test-database.ts';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { pool } from '../packages/server/src/db/client';
import { closeTournamentLocks } from '../packages/server/src/competitions/tournamentPersistence';

/** Fresh schema in the already guarded disposable DB. Never runs against a deployed database. */
export async function tournamentTestDatabase(){
  if(pool.totalCount)throw Error('Test isolation must be configured before application queries');
  // Same guarded disposable database; Neon transaction pooling rejects startup search_path.
  const direct=new URL(pool.options.connectionString!);
  if(direct.hostname.endsWith('.neon.tech'))direct.hostname=direct.hostname.replace('-pooler.','.');
  pool.options.connectionString=direct.toString();
  const name=`ko_test_${randomUUID().replaceAll('-','')}`;
  if(!/^ko_test_[a-f0-9]{32}$/.test(name))throw Error('Invalid isolated schema');
  const admin=new Pool({...pool.options,max:1});
  await admin.query(`CREATE SCHEMA "${name}"`);
  pool.options.options=`-c search_path=${name}`;
  let c:import('pg').PoolClient|undefined;
  try{
    c=await pool.connect();
    const journal=JSON.parse(readFileSync('packages/server/drizzle/meta/_journal.json','utf8'));
    for(const entry of journal.entries){
      const source=readFileSync(`packages/server/drizzle/${entry.tag}.sql`,'utf8').replaceAll('"public".',`"${name}".`);
      for(const sql of source.split('--> statement-breakpoint').filter((s:string)=>s.trim()))await c.query(sql);
    }
  }catch(e){await admin.query(`DROP SCHEMA "${name}" CASCADE`);await admin.end();throw e;}finally{c?.release();}
  process.env.APP_ENV='test';process.env.ENABLE_COMPETITION_AUTHORITY='true';process.env.ENABLE_KNOCKOUT_TOURNAMENTS='true';
  // tsx can load the server's ESM module separately from a script's static import.
  // Preload the exact dynamic import used by auth and bind it to this same schema
  // before an HTTP guard fixture temporarily changes environment identity strings.
  const authDatabase=await import('../packages/server/src/db/client');
  if(authDatabase.pool!==pool){
    if(authDatabase.pool.totalCount)throw Error('Auth database already in use before test isolation');
    authDatabase.pool.options.connectionString=pool.options.connectionString;
    authDatabase.pool.options.options=pool.options.options;
  }
  return async()=>{await closeTournamentLocks();if(authDatabase.pool!==pool)await authDatabase.pool.end();await pool.end();await admin.query(`DROP SCHEMA "${name}" CASCADE`);await admin.end();};
}

// Exercise the actual application shutdown handler and Socket.IO-owned HTTP
// server. Signal delivery is emitted in-process so this also runs on Windows.
import { tournamentTestDatabase } from './tournament-test-database';
import { pool } from '../packages/server/src/db/client';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

let passes=0,failures=0,cleanup:(()=>Promise<void>)|undefined;
function check(name:string,ok:unknown){console.log(`${ok?'PASS':'FAIL'} ${name}`);ok?passes++:failures++;}
async function main(){
  cleanup=await tournamentTestDatabase();
  const probe=createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));
  const port=(probe.address() as {port:number}).port;await new Promise<void>(r=>probe.close(()=>r()));
  const script=`
    import('./packages/server/src/index.ts');
    const deadline=setTimeout(()=>process.exit(2),30000);
    (async()=>{for(let n=0;n<100;n++){
      await new Promise(r=>setTimeout(r,200));
      try{const r=await fetch('http://127.0.0.1:${port}/health');const h=await r.json();
        if(h.environment!=='test')continue;
        console.log('SHUTDOWN_TEST_READY');clearTimeout(deadline);
        process.emit('SIGTERM');return;
      }catch{}
    }process.exit(3)})();`;
  const child=spawn(process.execPath,['--import','tsx','--eval',script],{windowsHide:true,env:{...process.env,
    APP_ENV:'test',NODE_ENV:'test',DATABASE_URL:pool.options.connectionString,PGOPTIONS:pool.options.options,
    HOST:'127.0.0.1',PORT:String(port),JWT_SECRET:'shutdown-test-only-not-a-hosted-credential',
    ENABLE_COMPETITION_AUTHORITY:'false',ENABLE_KNOCKOUT_TOURNAMENTS:'false',STAGING_MOCK_COMMERCIAL_ENABLED:'false',
    REAL_MONEY_ENABLED:'false',REAL_MONEY_DEPOSITS_ENABLED:'false',REAL_MONEY_WITHDRAWALS_ENABLED:'false',REAL_MONEY_COMPETITIONS_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  const watchdog=setTimeout(()=>child.kill(),45000);
  const code=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
  clearTimeout(watchdog);
  if(code!==0)console.error('Shutdown child diagnostics:\n'+output);
  check('actual application starts with direct Node/tsx loader',output.includes('SHUTDOWN_TEST_READY'));
  check('actual application receives shutdown signal',output.includes('received SIGTERM'));
  check('Socket.IO HTTP close is not closed a second time',!output.includes('ERR_SERVER_NOT_RUNNING')&&!output.includes('Server is not running'));
  check('shutdown closes database pool and exits successfully',code===0&&output.includes('closing database pool')&&output.includes('graceful shutdown complete'));
}
main().catch(e=>{failures++;console.error(e.message)}).finally(async()=>{await cleanup?.();console.log(`Shutdown lifecycle: ${passes} PASS, ${failures} FAIL`);process.exitCode=failures?1:0});

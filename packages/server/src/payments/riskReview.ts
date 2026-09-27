import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { isHostedEnvironment } from '../config/deploymentIdentity';
import type { RiskSignal } from './eligibility';

export type RiskAction = 'NONE'|'BLOCK_DEPOSITS'|'BLOCK_COMPETITIONS'|'BLOCK_WITHDRAWALS'|'BLOCK_ALL';
export type RiskCase = {id:string;user_id:string;status:string;signals:RiskSignal[];enforcement_action:RiskAction|null};

/** Internal simulation store; external admin routes must enforce their own RBAC. */
export class RiskReviewStore {
  constructor(private readonly pool:Pool) {
    if(isHostedEnvironment()) throw new Error('Commercial risk administration is simulation-only');
  }
  async open(userId:string,signals:readonly RiskSignal[],reason:string):Promise<string> {
    if(!userId||!signals.length||!reason?.trim()) throw new Error('Risk case requires user, signals, and reason');
    const id=`risk_${randomUUID()}`;
    const client=await this.pool.connect();
    try {await client.query('BEGIN');
      await client.query(`INSERT INTO commercial_risk_cases(id,user_id,status,signals,enforcement_action)
        VALUES($1,$2,'OPEN',$3,'NONE')`,[id,userId,JSON.stringify(signals)]);
      await client.query(`INSERT INTO commercial_risk_events(case_id,actor_id,action,reason)
        VALUES($1,'risk_engine','OPEN',$2)`,[id,reason]);
      await client.query('COMMIT');return id;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async decide(id:string,adminUserId:string,status:'IN_REVIEW'|'CLEARED'|'RESTRICTED',action:RiskAction,reason:string):Promise<RiskCase> {
    if(!adminUserId||!reason?.trim()) throw new Error('Risk decision requires admin actor and reason');
    if(status==='CLEARED'&&action!=='NONE') throw new Error('Cleared case cannot retain an enforcement block');
    if(status==='RESTRICTED'&&action==='NONE') throw new Error('Restricted case requires an enforcement action');
    const client=await this.pool.connect();
    try {await client.query('BEGIN');
      const actor=await client.query<{role:string}>('SELECT role FROM users WHERE id=$1 FOR SHARE',[adminUserId]);
      if(!['OWNER','SUPER_ADMIN','ADMIN'].includes(actor.rows[0]?.role)) throw new Error('Risk decision requires an authorized admin');
      const existing=await client.query<RiskCase>('SELECT id,user_id,status,signals,enforcement_action FROM commercial_risk_cases WHERE id=$1 FOR UPDATE',[id]);
      if(!existing.rows[0]) throw new Error('Risk case not found');
      if(existing.rows[0].status==='CLEARED'&&status!=='CLEARED') throw new Error('Cleared case cannot be reopened without a new case');
      const updated=await client.query<RiskCase>(`UPDATE commercial_risk_cases SET status=$2,enforcement_action=$3,updated_at=now()
        WHERE id=$1 RETURNING id,user_id,status,signals,enforcement_action`,[id,status,action]);
      await client.query(`INSERT INTO commercial_risk_events(case_id,actor_id,action,reason)
        VALUES($1,$2,$3,$4)`,[id,adminUserId,`${status}:${action}`,reason]);
      await client.query('COMMIT');return updated.rows[0];
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async listOpen(limit=50):Promise<RiskCase[]> {
    if(!Number.isInteger(limit)||limit<1||limit>100) throw new Error('Invalid risk queue limit');
    return (await this.pool.query<RiskCase>(`SELECT id,user_id,status,signals,enforcement_action
      FROM commercial_risk_cases WHERE status IN ('OPEN','IN_REVIEW','RESTRICTED') ORDER BY created_at,id LIMIT $1`,[limit])).rows;
  }
  async activeBlocks(userId:string):Promise<RiskAction[]> {
    return (await this.pool.query<{enforcement_action:RiskAction}>(`SELECT enforcement_action FROM commercial_risk_cases
      WHERE user_id=$1 AND status='RESTRICTED'`,[userId])).rows.map(row=>row.enforcement_action);
  }
}

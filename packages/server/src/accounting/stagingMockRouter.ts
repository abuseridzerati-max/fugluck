import type { CompetitionAccountingPort, ReserveEntryParams, ReleaseEntryParams, CaptureEntryParams,
  SettleCompetitionParams, RefundCompetitionParams } from './port';
import { SandboxAccountingAdapter } from './sandboxAdapter';
import { CommercialAccountingAdapter } from './commercialAdapter';
import { pool } from '../db/client';
import { isMockTemplate, stagingMockMode } from '../config/stagingMockCommercial';

/** Select by a server-owned immutable template ID, never a client currency or amount. */
export function accountingForTemplate(templateId:string):CompetitionAccountingPort {
  if(!isMockTemplate(templateId)) return new SandboxAccountingAdapter();
  if(!stagingMockMode()) throw new Error('Staging mock accounting is disabled');
  return new CommercialAccountingAdapter(pool);
}

export class StagingMockAccountingRouter implements CompetitionAccountingPort {
  private async forInstance(instanceId:string):Promise<CompetitionAccountingPort> {
    const result=await pool.query<{template_id:string}>('SELECT template_id FROM competition_instances WHERE id=$1',[instanceId]);
    if(!result.rows[0]) throw new Error('Competition instance not found');
    return accountingForTemplate(result.rows[0].template_id);
  }
  async reserveEntry(p:ReserveEntryParams) {return (await this.forInstance(p.competitionInstanceId)).reserveEntry(p);}
  async releaseEntry(p:ReleaseEntryParams) {return (await this.forInstance(p.competitionInstanceId)).releaseEntry(p);}
  async captureEntry(p:CaptureEntryParams) {return (await this.forInstance(p.competitionInstanceId)).captureEntry(p);}
  async settleCompetition(p:SettleCompetitionParams) {return (await this.forInstance(p.competitionInstanceId)).settleCompetition(p);}
  async refundCompetition(p:RefundCompetitionParams) {return (await this.forInstance(p.competitionInstanceId)).refundCompetition(p);}
}

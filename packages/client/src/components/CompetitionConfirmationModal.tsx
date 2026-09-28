import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameTitle, type CompetitionTemplate } from '@fugluck/shared'
import { useAuth } from '../auth/AuthContext'
import { joinBlockReason, moneyLabel } from '../lib/competitionPresentation'
import { CompetitionDialog, CompetitionPlayerSlots, CompetitionRules, CompetitionTerms } from './CompetitionUI'
import AuthModal from './AuthModal'

export default function CompetitionConfirmationModal({template,onClose,onConfirm,joined=0,available=true}:{
  template:CompetitionTemplate;gameTitle?:string;joined?:number;available?:boolean;onClose:()=>void;onConfirm:()=>void
}) {
  const {t}=useTranslation();const {user}=useAuth();const [auth,setAuth]=useState(false);const submitting=useRef(false)
  const reason=joinBlockReason({signedIn:Boolean(user),balanceMinor:user?.balances.sandboxGelMinor??0,entryMinor:template.entryFeeMinor,
    status:'PENDING_ENTRANTS',joined,capacity:template.participantCapacity,sandbox:available})
  if(auth)return <AuthModal initialMode="login" onClose={()=>setAuth(false)}/>
  return <CompetitionDialog title={t('competition.joinTitle',{game:getGameTitle(template.gameId)})} onClose={onClose}>
    <CompetitionTerms entryMinor={template.entryFeeMinor} prizeMinor={template.prizes?.find(p=>p.placement===1)?.amountMinor??0} currency={template.currency}/>
    <CompetitionPlayerSlots joined={joined} capacity={template.participantCapacity}/>
    <p className="competition-test-label">{t('competition.testNotice')}</p>
    {reason&&<p className="competition-feedback" role="status">{t(`competition.errors.${reason}`,{amount:moneyLabel(template.entryFeeMinor,template.currency)})}</p>}
    <CompetitionRules template={template}/>
    <div className="competition-dialog-actions"><button type="button" className="ac-btn ac-btn--ghost" onClick={onClose}>{t('common.cancel')}</button><button type="button" className="ac-btn ac-btn--primary" disabled={Boolean(reason&&reason!=='signIn')} onClick={()=>{if(reason==='signIn'){setAuth(true);return}if(!submitting.current){submitting.current=true;onConfirm()}}}>{t(reason==='signIn'?'competition.signIn':template.entryFeeMinor===0?'competition.joinFree':'competition.joinFor',{amount:moneyLabel(template.entryFeeMinor,template.currency)})}</button></div>
  </CompetitionDialog>
}

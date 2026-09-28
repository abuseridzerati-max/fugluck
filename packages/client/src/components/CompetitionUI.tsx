import React, { useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CompetitionTemplate } from '@fugluck/shared'
import { competitionResult, moneyLabel, type PlayerCompetition } from '../lib/competitionPresentation'

export function CompetitionPlayerSlots({joined,capacity}:{joined:number;capacity:number}) {
  const {t}=useTranslation()
  return <div className="competition-players" aria-label={t('competition.playersCount',{joined,capacity})}>
    <div className="competition-slots" aria-hidden="true">{Array.from({length:Math.min(capacity,16)},(_,i)=><span key={i} className={`competition-slot${i<joined?' is-filled':''}`}><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3Z"/></svg></span>)}</div>
    <span><strong>{joined} / {capacity}</strong> {t('competition.players')}</span>
  </div>
}
export function CompetitionTerms({entryMinor,prizeMinor,currency='GEL'}:{entryMinor:number;prizeMinor:number;currency?:string}) {
  const {t}=useTranslation()
  return <dl className="competition-terms"><div><dt>{t('competition.entry')}</dt><dd>{entryMinor===0?t('competition.free'):moneyLabel(entryMinor,currency)}</dd></div><div><dt>{t('competition.prize')}</dt><dd>{moneyLabel(prizeMinor,currency)}</dd></div></dl>
}
export function CompetitionGameVisual({gameId}:{gameId:string}) {
  return <div className={`competition-visual ${gameId==='cyber-hopper'?'is-hopper':''}`} aria-hidden="true">
    {gameId==='cyber-hopper'?<svg viewBox="0 0 300 110"><path className="visual-road" d="M0 25H300M0 75H300"/><path d="M25 25h35m40 0h35m40 0h35m40 0h35M5 75h35m40 0h35m40 0h35m40 0h35" stroke="currentColor" strokeWidth="2" strokeDasharray="8 8"/><rect x="45" y="13" width="42" height="24" rx="8" fill="#bf8af6"/><rect x="213" y="63" width="48" height="24" rx="8" fill="#f5c35b"/><path d="m150 22 22 25-4 23-18 15-18-15-4-23Z" fill="#54e8af"/><path d="m141 38 9-9 9 9-4 22h-10Z" fill="#0b1734"/><path d="M144 76v14m12-14v14" stroke="#54e8af" strokeWidth="5"/></svg>:<svg viewBox="0 0 300 110"><g fill="#baa1ec"><circle cx="40" cy="24" r="2"/><circle cx="73" cy="82" r="2"/><circle cx="232" cy="25" r="2"/><circle cx="266" cy="75" r="2"/><path d="m60 26 7-9 12 4 5 13-9 11-12-5Z"/><path d="m223 77 8-11 16 2 5 13-14 11-10-4Z"/></g><path d="m150 13 14 42 22 25-32-6-4 7-4-7-32 6 22-25Z" fill="#b998ff"/><path d="m150 28 6 29-6 11-6-11Z" fill="#e8dcff"/><path d="m139 80 4 22 4-18m6 0 4 18 4-22" stroke="#5af4c0" strokeWidth="3"/><path d="M150 0v8M126 32v-9m48 9v-9" stroke="#5af4c0" strokeWidth="2"/></svg>}
  </div>
}
export function CompetitionDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  const {t}=useTranslation()
  const ref=useRef<HTMLDialogElement>(null)
  React.useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current;dialog?.showModal();return()=>{dialog?.close();previous?.focus()}},[])
  return <dialog ref={ref} role="dialog" aria-modal="true" aria-label={title} className="competition-dialog" onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();if(e.target===e.currentTarget&&(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom))onClose()}} onKeyDown={e=>{
    if(e.key!=='Tab')return
    const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary,input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length>0)
    const first=items[0],last=items.at(-1)
    if(!first){e.preventDefault();e.currentTarget.focus();return}
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }}>
    <div className="competition-dialog-heading"><h2>{title}</h2><button type="button" className="ac-btn ac-btn--ghost" aria-label={t('common.close')} onClick={onClose}>×</button></div>{children}
  </dialog>
}
export function CompetitionRules({template}:{template:CompetitionTemplate}) {
  const {t}=useTranslation()
  return <details className="competition-rules"><summary>{t('competition.rulesDetails')}</summary>
    <dl><div><dt>{t('competition.format')}</dt><dd>{t(`competition.formats.${template.format}`)}</dd></div><div><dt>{t('competition.players')}</dt><dd>{template.participantCapacity}</dd></div></dl>
    <p>{t(template.gameId==='cyber-hopper'?'competition.hopperControls':'competition.blasterControls')}</p><p>{t(template.format==='TOURNAMENT_BRACKET'?'competition.knockout.rules':'competition.gameRules')}</p><p>{t(template.format==='TOURNAMENT_BRACKET'?'competition.knockout.leaveRule':'competition.leaveRule')}</p>
    <div className="competition-policy-links"><a href="/rules" target="_blank" rel="noreferrer">{t('competition.rules')}</a><a href="/entry-fees-prizes" target="_blank" rel="noreferrer">{t('competition.entryPrizeDetails')}</a><a href="/fair-play" target="_blank" rel="noreferrer">{t('competition.fairPlay')}</a><a href="/terms" target="_blank" rel="noreferrer">{t('competition.terms')}</a><a href="/sandbox-notice" target="_blank" rel="noreferrer">{t('competition.sandboxDetails')}</a></div>
  </details>
}
export function CompetitionBracket({instance,userId}:{instance:PlayerCompetition;userId?:string}){
  const {t}=useTranslation();const bracket=instance.tournament;if(!bracket)return null;
  return <details className="competition-rules competition-bracket"><summary>{t('competition.knockout.bracket')}</summary>
    {Array.from(new Set(bracket.matches.map(m=>m.round))).map(round=><section key={round}><h3>{t(`competition.knockout.rounds.${bracket.matches.find(m=>m.round===round)!.roundName}`)}</h3>
      <ul>{bracket.matches.filter(m=>m.round===round).map(m=><li key={m.id} className={m.players.includes(userId??'')?'is-yours':''}>
        {m.players.map((id,i)=><span key={i}>{m.winnerUserId===id&&id?'★ ':''}{id===userId?t('competition.knockout.you'):m.playerNames[i]??t('competition.knockout.pendingPlayer')}</span>)}
      </li>)}</ul></section>)}
  </details>
}
export function CompetitionQualification({template}:{template:CompetitionTemplate}){
  const {t,i18n}=useTranslation(),info=template.tournament;if(!info)return null;
  const date=(value:string)=>new Intl.DateTimeFormat([i18n.resolvedLanguage??'en','en-GB'],{timeZone:info.cycle?.timezone??'Asia/Tbilisi',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
  return <div className="competition-qualification">
    {info.cycle&&<p>{t('competition.knockout.starts',{date:date(info.cycle.startsAt),zone:info.cycle.timezone})}</p>}
    {info.product!=='STANDARD'&&<p>{t(`competition.knockout.eligibility.${info.eligibility}`)}</p>}
    <details><summary>{t('competition.knockout.qualification')}</summary>
      {(['promo','gift'] as const).map(product=>{const track=info[product],cycle=product==='promo'?info.nextPromoCycle:info.nextGiftCycle;return <p key={product}>{t(`competition.knockout.products.${product.toUpperCase()}`)}: {track.progress} / {track.threshold} {track.ticketStatus&&t(`competition.knockout.tickets.${track.ticketStatus}`)}{cycle&&<small>{t('competition.knockout.next',{date:date(cycle.startsAt)})}</small>}</p>})}
      <p>{t('competition.knockout.qualificationRule',{promo:info.promo.threshold,gift:info.gift.threshold})}</p>
    </details>
  </div>
}
export function CompetitionResult({instance,userId,onRetry}:{instance:PlayerCompetition|null;userId?:string;onRetry?:()=>void}) {
  const {t}=useTranslation();const result=competitionResult(instance,userId)
  const icon=result.kind==='win'?'★':result.kind==='loss'?'⚑':result.kind==='draw'?'＝':result.kind==='pending'?'…':'↩'
  return <section className={`competition-result is-${result.kind}`} aria-live="polite">
    <p className="competition-test-label">{t('competition.testLabel')}</p>
    <div className="competition-result-icon" aria-hidden="true">{icon}</div><h2>{t(`competition.results.${result.kind}`)}</h2>
    {result.kind==='pending'?<><p>{t('competition.resultPending')}</p>{onRetry&&<button type="button" className="ac-btn ac-btn--secondary" onClick={onRetry}>{t('competition.retry')}</button>}</>:<>
      <dl className="competition-terms"><div><dt>{t('competition.yourScore')}</dt><dd>{result.yourScore??'—'}</dd></div><div><dt>{t('competition.opponentScore')}</dt><dd>{result.opponentScore??'—'}</dd></div></dl>
      {'prizeMinor' in result&&<p className="competition-award">{t('competition.prize')} <strong>{moneyLabel(result.prizeMinor??0,result.currency)}</strong></p>}
      {'returnedMinor' in result&&<p>{result.returnedMinor===undefined?t('competition.returnPending'):t('competition.entryReturned',{amount:moneyLabel(result.returnedMinor,result.currency)})}</p>}
    </>}
  </section>
}

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameTitle, type CompetitionTemplate } from '@fugluck/shared'
import { apiFetch } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { catalogPresentation, moneyLabel, publicCompetitionStatus, type CatalogRoom } from '../lib/competitionPresentation'
import CompetitionConfirmationModal from './CompetitionConfirmationModal'
import { CompetitionDialog, CompetitionGameVisual, CompetitionPlayerSlots, CompetitionRules, CompetitionTerms, CompetitionQualification } from './CompetitionUI'
import './competition.css'

const CATALOG_REQUEST_TIMEOUT_MS = 6_000
export default function CompetitionCatalog({gameId,onJoinCompetition,onClose,onShowAll}: {
  gameId?:string;gameTitle?:string;onJoinCompetition:(template:CompetitionTemplate)=>void;onClose?:()=>void;onShowAll?:()=>void
}) {
  const {t,i18n}=useTranslation()
  const {user}=useAuth()
  const [templates,setTemplates]=useState<CompetitionTemplate[]>([])
  const [rooms,setRooms]=useState<CatalogRoom[]>([])
  const [available,setAvailable]=useState(false)
  const [roomsKnown,setRoomsKnown]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [selected,setSelected]=useState<{template:CompetitionTemplate;room?:CatalogRoom}|null>(null)
  const [details,setDetails]=useState<CompetitionTemplate|null>(null)
  const activeCatalogRequest=useRef<AbortController|null>(null)
  function loadTemplates(quiet=false) {
    activeCatalogRequest.current?.abort()
    const controller=new AbortController();activeCatalogRequest.current=controller
    const timer=window.setTimeout(()=>controller.abort(),CATALOG_REQUEST_TIMEOUT_MS)
    if(!quiet)setLoading(true)
    setError(null)
    const path=gameId?`/api/competitions/templates?gameId=${encodeURIComponent(gameId)}`:'/api/competitions/templates'
    apiFetch<{templates:CompetitionTemplate[];rooms?:CatalogRoom[];playerMode?:string;joiningAvailable?:boolean}>(path,{signal:controller.signal})
      .then(res=>{if(activeCatalogRequest.current!==controller)return
        setTemplates(res.templates.filter(template=>template.enabled));setRooms(res.rooms??[])
        setRoomsKnown(Array.isArray(res.rooms))
        setAvailable(res.playerMode==='sandbox'&&res.joiningAvailable===true&&Array.isArray(res.rooms))
      }).catch(()=>{if(activeCatalogRequest.current===controller)setError(controller.signal.aborted?'catalogTimeout':'catalogError')})
      .finally(()=>{window.clearTimeout(timer);if(activeCatalogRequest.current===controller){activeCatalogRequest.current=null;setLoading(false)}})
  }
  useEffect(()=>{loadTemplates();const poll=window.setInterval(()=>{if(!activeCatalogRequest.current&&!document.hidden)loadTemplates(true)},10_000)
    return()=>{window.clearInterval(poll);activeCatalogRequest.current?.abort();activeCatalogRequest.current=null}
  },[gameId,user?.id])
  return <div className="competition-ux" lang={i18n.resolvedLanguage}>
    {onClose&&<button type="button" className="ac-btn ac-btn--ghost" onClick={onClose}>{t('common.back')}</button>}
    {loading?<div className="competition-grid" role="status" aria-label={t('competition.loading')}><span className="competition-sr">{t('competition.loading')}</span>{[0,1,2].map(i=><div key={i} className="competition-skeleton" aria-hidden="true"/>)}</div>:
      error?<div className="competition-empty" role="alert"><p>{t(`competition.${error}`)}</p><button type="button" className="ac-btn ac-btn--primary" onClick={()=>loadTemplates()}>{t('competition.retry')}</button></div>:
      templates.length===0?<div className="competition-empty"><p>{t(gameId?'competition.emptyGame':'competition.empty',{game:getGameTitle(gameId??'')})}</p>{gameId&&onShowAll?<button type="button" className="ac-btn ac-btn--secondary" onClick={onShowAll}>{t('competition.showAll')}</button>:<span>{t('competition.checkBack')}</span>}</div>:
      <div className="competition-grid">{templates.map(template=>{
        const room=rooms.find(r=>r.templateId===template.id);const view=catalogPresentation(template,room)
        const displayed={...template,entryFeeMinor:view.entryMinor,currency:view.currency,participantCapacity:view.capacity,
          prizes:room?room.prizes.map((p,i)=>({...p,id:`display_${i}`,templateId:template.id})):template.prizes}
        return <article key={template.id} className="competition-card" aria-label={`${view.gameName}, ${t('competition.entry')} ${view.isFree?t('competition.free'):moneyLabel(view.entryMinor,view.currency)}, ${t('competition.prize')} ${moneyLabel(view.prizeMinor,view.currency)}`}>
          <CompetitionGameVisual gameId={template.gameId}/><div className="competition-card-body">
            <div className="competition-card-top"><span className="competition-status">{t(`competition.status.${available?publicCompetitionStatus(view.status,view.joined,view.capacity):'unavailable'}`)}</span>{view.isFree||view.isPromo?<span className="competition-badge">{t(view.isFree?'competition.free':'competition.promo')}</span>:null}</div>
            <h2>{view.gameName}</h2>{template.tournament&&<span className="competition-badge">{t(`competition.knockout.products.${template.tournament.product}`)} · {view.capacity}</span>}<CompetitionTerms entryMinor={view.entryMinor} prizeMinor={view.prizeMinor} currency={view.currency}/>
            {roomsKnown?<CompetitionPlayerSlots joined={view.joined} capacity={view.capacity}/>:<p className="ac-text-muted">{t('competition.playersUnavailable')}</p>}
            <CompetitionQualification template={template}/>
            <button type="button" className="ac-btn ac-btn--primary competition-primary" disabled={!room?.viewerJoined&&(!available||publicCompetitionStatus(view.status,view.joined,view.capacity)!=='open'||Boolean(template.tournament&&!['AVAILABLE','SIGN_IN'].includes(template.tournament.eligibility)))} onClick={()=>{if(room?.viewerJoined){sessionStorage.setItem(`authority:${template.id}`,room.id);onJoinCompetition(displayed)}else setSelected({template:displayed,room})}}>{t(room?.viewerJoined?'competition.actions.view':!available?'competition.status.unavailable':view.isFree?'competition.joinFree':'competition.join')}</button>
            <button type="button" className="competition-secondary" onClick={()=>setDetails(displayed)}>{t('competition.rulesDetails')}</button>
          </div>
        </article>
      })}</div>}
    {selected&&<CompetitionConfirmationModal template={selected.template} joined={selected.room?.currentParticipants??0} available={available} onClose={()=>setSelected(null)} onConfirm={()=>{const template=selected.template;setSelected(null);onJoinCompetition(template)}}/>}
    {details&&<CompetitionDialog title={t('competition.rulesDetails')} onClose={()=>setDetails(null)}><h3>{catalogPresentation(details).gameName}</h3><CompetitionTerms entryMinor={details.entryFeeMinor} prizeMinor={details.prizes?.find(p=>p.placement===1)?.amountMinor??0} currency={details.currency}/><CompetitionRules template={details}/></CompetitionDialog>}
  </div>
}

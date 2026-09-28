import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameTitle, type CompetitionTemplate } from '@fugluck/shared'
import { useAuth } from '../auth/AuthContext'
import { apiFetch } from '../lib/api'
import { competitionAction, publicCompetitionStatus, templateForInstance, type PlayerCompetition } from '../lib/competitionPresentation'
import { CompetitionDialog, CompetitionResult, CompetitionRules } from './CompetitionUI'

export default function MyCompetitions({onLaunch}:{onLaunch:(template:CompetitionTemplate)=>void}) {
  const {t}=useTranslation();const {user}=useAuth();const [instances,setInstances]=useState<PlayerCompetition[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState(false);const [selected,setSelected]=useState<PlayerCompetition|null>(null)
  const request=useRef<AbortController|null>(null)
  const resultRequest=useRef<AbortController|null>(null)
  const [resultError,setResultError]=useState(false)
  function load(){request.current?.abort();const controller=new AbortController();request.current=controller;const timer=window.setTimeout(()=>controller.abort(),6000);setLoading(true);setError(false)
    apiFetch<{instances:PlayerCompetition[]}>('/api/competitions/mine',{signal:controller.signal}).then(r=>{if(request.current===controller)setInstances(r.instances)}).catch(()=>{if(request.current===controller)setError(true)}).finally(()=>{window.clearTimeout(timer);if(request.current===controller){request.current=null;setLoading(false)}})
  }
  useEffect(()=>{setInstances([]);setSelected(null);if(user)load();const timer=window.setInterval(()=>{if(user&&!request.current&&!document.hidden)load()},15000);return()=>{window.clearInterval(timer);request.current?.abort();request.current=null;resultRequest.current?.abort();resultRequest.current=null}},[user?.id])
  function resume(instance:PlayerCompetition){sessionStorage.setItem(`authority:${instance.templateId}`,instance.id);onLaunch(templateForInstance(instance))}
  async function refreshResult(){if(!selected)return;resultRequest.current?.abort();const controller=new AbortController();resultRequest.current=controller;const timer=window.setTimeout(()=>controller.abort(),6000);try{const r=await apiFetch<{instance:PlayerCompetition}>(`/api/competitions/instances/${encodeURIComponent(selected.id)}`,{signal:controller.signal});if(resultRequest.current===controller){setSelected(r.instance);setResultError(false)}}catch{if(resultRequest.current===controller)setResultError(true)}finally{window.clearTimeout(timer);if(resultRequest.current===controller)resultRequest.current=null}}
  return <section className="competition-my"><h2>{t('competition.myTitle')}</h2>
    {!user?<p className="ac-text-muted">{t('competition.mySignIn')}</p>:error?<div role="alert"><p>{t('competition.myError')}</p><button type="button" className="ac-btn ac-btn--secondary" onClick={load}>{t('competition.retry')}</button></div>:loading&&!instances.length?<p role="status">{t('competition.loading')}</p>:!instances.length?<p className="ac-text-muted">{t('competition.myEmpty')}</p>:<div className="competition-my-list">{instances.map(instance=>{const action=competitionAction(instance.status,true,instance.currentParticipants,instance.participantCapacity);return <article key={instance.id} className="competition-my-row"><div><h3>{getGameTitle(instance.gameId)}</h3><p>{t(`competition.status.${instance.status==='PENDING_ENTRANTS'?'waiting':publicCompetitionStatus(instance.status)}`)} · {instance.currentParticipants} / {instance.participantCapacity}</p></div><button type="button" className="ac-btn ac-btn--secondary" onClick={()=>action==='viewResult'?setSelected(instance):resume(instance)}>{t(`competition.actions.${action}`)}</button></article>})}</div>}
    {selected&&<CompetitionDialog title={getGameTitle(selected.gameId)} onClose={()=>{resultRequest.current?.abort();resultRequest.current=null;setSelected(null);setResultError(false)}}><CompetitionResult instance={resultError?null:selected} userId={user?.id} onRetry={refreshResult}/><CompetitionRules template={templateForInstance(selected)}/></CompetitionDialog>}
  </section>
}

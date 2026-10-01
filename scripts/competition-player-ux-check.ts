import { fixtureSession } from './security-test-session';
// Presentation scenarios plus the read-only canonical player API, on the guarded disposable DB.
import './require-disposable-test-database.ts'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import express from 'express'
import cookieParser from 'cookie-parser'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { AUTHORITY_VERSION, type CompetitionTemplate } from '@fugluck/shared'
import { catalogPresentation, competitionAction, competitionErrorKey, competitionResult, joinBlockReason, moneyLabel, publicCompetitionStatus, templateForInstance, type PlayerCompetition } from '../packages/client/src/lib/competitionPresentation'
import { CompetitionPlayerSlots, CompetitionResult, CompetitionRules, CompetitionTerms, CompetitionBracket, CompetitionQualification } from '../packages/client/src/components/CompetitionUI'
import { pool } from '../packages/server/src/db/client'
import { templateService, instanceService, lifecycleEngine } from '../packages/server/src/competitions'
import { SandboxAccountingAdapter } from '../packages/server/src/accounting/sandboxAdapter'
import { readCatalogRooms, readMyCompetitions, readPlayerInstance } from '../packages/server/src/competitions/playerReadModel'
import { competitionsRouter } from '../packages/server/src/routes/competitions'
import { signSessionToken, SESSION_COOKIE_NAME } from '../packages/server/src/auth/jwt'
import en from '../packages/client/src/locales/en.json'
import ka from '../packages/client/src/locales/ka.json'
import ru from '../packages/client/src/locales/ru.json'

let passes=0, failures=0
function check(label:string,ok:unknown){console.log(`${ok?'PASS':'FAIL'} ${label}`);ok?passes++:failures++}
const template:CompetitionTemplate={id:'display',gameId:'space-blaster',title:'Standard Duel',format:'HEAD_TO_HEAD',participantCapacity:2,currency:'GEL',entryFeeMinor:500,rulesVersion:AUTHORITY_VERSION,skillAssessmentVersion:'v1',jurisdiction:'GE',enabled:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),prizes:[{id:'prize',templateId:'display',placement:1,amountMinor:900,currency:'GEL'}]}
const instance:PlayerCompetition={...template,id:'room',templateId:template.id,status:'SETTLED',currentParticipants:2,winnerUserId:'alice',resultKind:'WIN',participants:[{userId:'alice',score:150,prizeWonMinor:900,status:'SUBMITTED'},{userId:'bob',score:31,prizeWonMinor:0,status:'SUBMITTED'}]}
const baseJoin={signedIn:true,balanceMinor:500,entryMinor:500,status:'PENDING_ENTRANTS',joined:1,capacity:2}
async function main(){
  for(const [internal,expected] of Object.entries({PENDING_ENTRANTS:'open',LOCKED:'starting',ACTIVE:'live',VERIFYING:'finished',SETTLED:'finished',CANCELLED:'canceled',VOIDED:'voided',INTERNAL_UNKNOWN:'unavailable'}))check(`public status ${internal}`,publicCompetitionStatus(internal)===expected)
  check('full room is full',publicCompetitionStatus('PENDING_ENTRANTS',2,2)==='full')
  for(const [state,action] of Object.entries({PENDING_ENTRANTS:'view',LOCKED:'getReady',ACTIVE:'returnToGame',VERIFYING:'viewResult',SETTLED:'viewResult',VOIDED:'viewResult',CANCELLED:'viewResult'}))check(`participant action ${state}`,competitionAction(state,true)===action)
  check('nonparticipant open join',competitionAction('PENDING_ENTRANTS',false)==='join')
  for(const state of ['LOCKED','ACTIVE','VERIFYING','SETTLED','VOIDED','CANCELLED'])check(`new join blocked ${state}`,joinBlockReason({...baseJoin,status:state})==='unavailable')
  check('standard paid join',joinBlockReason(baseJoin)===null)
  check('promotional entry independent of prize',catalogPresentation({...template,title:'Promo Duel',prizes:[{...template.prizes![0],amountMinor:2000}]}).prizeMinor===2000)
  check('promo badge follows existing template designation',catalogPresentation({...template,title:'Promo Duel'}).isPromo)
  check('freeroll zero balance join',joinBlockReason({...baseJoin,balanceMinor:0,entryMinor:0})===null)
  check('free card preserves predetermined prize',catalogPresentation({...template,entryFeeMinor:0}).isFree&&catalogPresentation({...template,entryFeeMinor:0}).prizeMinor===900)
  check('full join blocked',joinBlockReason({...baseJoin,joined:2})==='unavailable')
  check('insufficient balance blocked',joinBlockReason({...baseJoin,balanceMinor:499})==='insufficient')
  check('guest even free requires account',joinBlockReason({...baseJoin,signedIn:false,entryMinor:0})==='signIn')
  check('already participant is not another join',joinBlockReason({...baseJoin,participant:true})==='alreadyJoined')
  check('non-sandbox joining denied',joinBlockReason({...baseJoin,sandbox:false})==='unavailable')
  for(const [code,message] of Object.entries({INSUFFICIENT_FUNDS:'insufficient',DUPLICATE_USER_IN_INSTANCE:'alreadyJoined',IDENTITY_UNVERIFIED:'identity',ENTRY_LIMIT_EXCEEDED:'limit',JURISDICTION_UNAPPROVED:'account',RISK_REVIEW_REQUIRED:'account',RATE_LIMITED:'retryLater',CANCEL_REJECTED:'cannotLeave',DATABASE_INTERNAL_SECRET:'unavailable'}))check(`error safely mapped ${code}`,competitionErrorKey(code)===message)
  check('win from server winner and paid prize',competitionResult(instance,'alice').kind==='win'&&competitionResult(instance,'alice').prizeMinor===900)
  check('loss from server winner',competitionResult(instance,'bob').kind==='loss'&&competitionResult(instance,'bob').prizeMinor===0)
  const draw={...instance,status:'VOIDED' as const,resultKind:'DRAW',winnerUserId:null,participants:instance.participants.map(p=>({...p,entryReturned:true}))}
  check('draw only from durable server decision',competitionResult(draw,'alice').kind==='draw')
  check('draw entry return verified',competitionResult(draw,'alice').returnedMinor===500)
  check('equal scores do not invent draw',competitionResult({...draw,resultKind:'VOID',participants:draw.participants.map(p=>({...p,score:12}))},'alice').kind==='void')
  check('canceled entry refunded when recorded',competitionResult({...draw,status:'CANCELLED',resultKind:null},'alice').kind==='refund')
  check('void does not prematurely claim returned funds',competitionResult({...draw,resultKind:'VOID',participants:draw.participants.map(p=>({...p,entryReturned:false}))},'alice').returnedMinor===undefined)
  check('verifying never claims a paid prize',competitionResult({...instance,status:'VERIFYING'},'alice').kind==='pending')
  check('missing result fallback',competitionResult(null,'alice').kind==='pending')
  check('settled without server winner stays pending',competitionResult({...instance,winnerUserId:null},'alice').kind==='pending')
  check('other user cannot get own result',competitionResult(instance,'outsider').kind==='pending')
  check('duplicate outcome presentation is stable',JSON.stringify(competitionResult(instance,'alice'))===JSON.stringify(competitionResult(structuredClone(instance),'alice')))
  check('snapshot room owns entry and prize independently',catalogPresentation(template,{...instance,entryFeeMinor:300,prizes:[{placement:1,amountMinor:1555,currency:'GEL'}]}).entryMinor===300&&catalogPresentation(template,{...instance,entryFeeMinor:300,prizes:[{placement:1,amountMinor:1555,currency:'GEL'}]}).prizeMinor===1555)
  check('resume template retains snapshot terms',templateForInstance(instance).entryFeeMinor===500&&templateForInstance(instance).prizes![0].amountMinor===900)
  check('integer minor units displayed',moneyLabel(1555)==='15.55 GEL')
  const knockout:PlayerCompetition={...instance,status:'ACTIVE',format:'TOURNAMENT_BRACKET',participantCapacity:4,winnerUserId:null,tournament:{product:'STANDARD',cycle:null,state:'PLAYING',playerState:'ELIMINATED',currentMatch:null,yourScore:31,opponentScore:150,matches:[{id:'semi',round:1,roundName:'SEMIFINAL',position:0,players:['alice','bob'],playerNames:['Alice','Bob'],winnerUserId:'alice',status:'COMPLETE',attempt:1},{id:'final',round:2,roundName:'FINAL',position:0,players:['alice',null],playerNames:['Alice',null],winnerUserId:null,status:'WAITING',attempt:0}]}}
  const special:CompetitionTemplate={...template,format:'TOURNAMENT_BRACKET',participantCapacity:16,entryFeeMinor:0,tournament:{product:'GIFT',cycle:null,eligibility:'QUALIFY',promo:{progress:4,threshold:5,ticketStatus:null,targetCycleId:null,expiresAt:null},gift:{progress:4,threshold:10,ticketStatus:null,targetCycleId:null,expiresAt:null},nextPromoCycle:null,nextGiftCycle:null}}
  check('eliminated player sees their own last round before tournament ends',competitionResult(knockout,'bob').kind==='loss'&&competitionResult(knockout,'bob').yourScore===31&&competitionResult(knockout,'bob').opponentScore===150)
  for(const [code,key] of Object.entries({QUALIFICATION_REQUIRED:'qualify',QUALIFICATION_INVALIDATED:'qualify',CYCLE_CLOSED:'cycleClosed',TICKET_ALREADY_USED:'cycleClosed'}))check('tournament error safely mapped '+code,competitionErrorKey(code)===key)
  const i18n=i18next.createInstance();await i18n.init({resources:{en:{translation:en},ka:{translation:ka},ru:{translation:ru}},fallbackLng:'en',interpolation:{escapeValue:false}})
  for(const lang of ['en','ka','ru']){
    await i18n.changeLanguage(lang)
    const render=(element:React.ReactNode)=>renderToStaticMarkup(React.createElement(I18nextProvider,{i18n},element))
    const terms=render(React.createElement(CompetitionTerms,{entryMinor:0,prizeMinor:2000}))
    check(`${lang} free and fixed prize render`,terms.includes(i18n.t('competition.free'))&&terms.includes('20.00 GEL'))
    const slots=render(React.createElement(CompetitionPlayerSlots,{joined:3,capacity:4}))
    check(`${lang} slots have meaningful count`,slots.includes('aria-label=')&&slots.includes('3 / 4')&&(slots.match(/is-filled/g)||[]).length===3)
    const rules=render(React.createElement(CompetitionRules,{template}))
    check(`${lang} details preserve policy routes`,['/rules','/entry-fees-prizes','/fair-play','/terms','/sandbox-notice'].every(link=>rules.includes(`href="${link}"`))&&!rules.includes(AUTHORITY_VERSION)&&!rules.includes('HEAD_TO_HEAD'))
    const result=render(React.createElement(CompetitionResult,{instance,userId:'alice'}))
    check(`${lang} winner headline scores prize`,result.includes(i18n.t('competition.results.win'))&&result.includes('150')&&result.includes('31')&&result.includes('9.00 GEL'))
    const pending=render(React.createElement(CompetitionResult,{instance:null,userId:'alice',onRetry:()=>{}}))
    check(`${lang} missing result offers retry`,pending.includes(i18n.t('competition.retry'))&&!pending.includes('9.00 GEL'))
    const sixteen=render(React.createElement(CompetitionPlayerSlots,{joined:7,capacity:16}))
    check(`${lang} all sixteen slots remain visible`,(sixteen.match(/<svg /g)||[]).length===16&&(sixteen.match(/is-filled/g)||[]).length===7)
    const bracket=render(React.createElement(CompetitionBracket,{instance:knockout,userId:'bob'}))
    check(`${lang} optional bracket names rounds and player path`,bracket.includes('<details')&&bracket.includes(i18n.t('competition.knockout.rounds.SEMIFINAL'))&&bracket.includes(i18n.t('competition.knockout.rounds.FINAL'))&&bracket.includes(i18n.t('competition.knockout.you'))&&bracket.includes('Alice'))
    const progress=render(React.createElement(CompetitionQualification,{template:special}))
    check(`${lang} independent qualification and locked copy`,progress.includes('4 / 5')&&progress.includes('4 / 10')&&progress.includes(i18n.t('competition.knockout.eligibility.QUALIFY'))&&!progress.includes('{{'))
    const knockoutRules=render(React.createElement(CompetitionRules,{template:special}))
    check(`${lang} tournament rules disclose round and leave policy`,knockoutRules.includes(i18n.t('competition.knockout.rules'))&&knockoutRules.includes(i18n.t('competition.knockout.leaveRule')))
  }

  const id=`ux_${randomUUID()}`,other=`ux_${randomUUID()}`,tid=`tmpl_${id}`
  const adapter=new SandboxAccountingAdapter()
  const app=express();app.use(cookieParser());app.use('/api/competitions',competitionsRouter)
  const server=createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port
  const url=`http://127.0.0.1:${port}/api/competitions`
  const previousAuthority=process.env.ENABLE_COMPETITION_AUTHORITY;process.env.ENABLE_COMPETITION_AUTHORITY='true'
  try {
    await pool.query("INSERT INTO users(id,username,password_hash,role) VALUES($1,$3,'test','USER'),($2,$4,'test','USER')",[id,other,id.slice(0,30),other.slice(0,30)])
    await adapter.grantSandboxTestFunds(id,1000)
    await templateService.createTemplate({...template,id:tid,title:'UX test Standard Duel',prizes:[{placement:1,amountMinor:1300,currency:'GEL'}]})
    const joined=await instanceService.joinCompetitionQueue(tid,id,adapter)
    const rooms=await readCatalogRooms([tid],id)
    check('canonical open room count',rooms.length===1&&rooms[0].currentParticipants===1&&rooms[0].participantCapacity===2)
    check('catalog marks own participation',rooms[0].viewerJoined)
    check('anonymous cannot see viewer participation',!(await readCatalogRooms([tid]))[0].viewerJoined)
    await templateService.updateTemplate(tid,{entryFeeMinor:700,prizes:[{placement:1,amountMinor:2200,currency:'GEL'}]})
    const frozen=(await readCatalogRooms([tid]))[0]
    check('open catalog room remains snapshotted after template edit',frozen.entryFeeMinor===500&&frozen.prizes[0].amountMinor===1300)
    const mine=await readMyCompetitions(id),notMine=await readMyCompetitions(other)
    check('my history includes own instance',mine.some(i=>i!.id===joined.instanceId))
    check('my history excludes another user',!notMine.some(i=>i!.id===joined.instanceId))
    const before=(await pool.query('SELECT count(*)::int n FROM sandbox_ledger_entries')).rows[0].n
    const reserved=await readPlayerInstance(joined.instanceId)
    check('reserved entry not reported returned',reserved?.participants[0].entryReturned===false)
    await readPlayerInstance(joined.instanceId);await readMyCompetitions(id);await readCatalogRooms([tid])
    check('read projections do not write ledger',(await pool.query('SELECT count(*)::int n FROM sandbox_ledger_entries')).rows[0].n===before)
    const unauthorized=await fetch(`${url}/mine`)
    check('mine API requires auth',unauthorized.status===401)
    const cookie=`${SESSION_COOKIE_NAME}=${(await fixtureSession(id))}`
    const owned=await fetch(`${url}/mine`,{headers:{cookie}});const body=await owned.json() as any
    check('mine API session ownership and no cache',owned.status===200&&owned.headers.get('cache-control')==='no-store'&&body.instances.some((i:any)=>i.id===joined.instanceId))
    const publicCatalog=await fetch(`${url}/templates`);const catalog=await publicCatalog.json() as any
    check('catalog flags sandbox and actual joining switch',catalog.playerMode==='sandbox'&&catalog.joiningAvailable===true&&Array.isArray(catalog.rooms))
    check('catalog hides operator mock templates',catalog.templates.every((t:any)=>!t.id.startsWith('tmpl_staging_mock_7i_')))
    process.env.ENABLE_COMPETITION_AUTHORITY='false';const switched=await (await fetch(`${url}/templates`)).json() as any
    check('catalog respects authority action switch',switched.joiningAvailable===false)
    await lifecycleEngine.cancelUnfilledInstance(joined.instanceId,adapter,'USER_CANCELLED')
    const cancelled=await readPlayerInstance(joined.instanceId)
  check('cancelled entry return comes from reservation record',cancelled?.status==='CANCELLED'&&cancelled.participants[0].entryReturned===true)
    check('cancelled room no longer appears open',(await readCatalogRooms([tid])).length===0)
    check('missing instance safe null',await readPlayerInstance('ux_missing')===null)
    const original=pool.query.bind(pool)
    try {
      (pool as any).query=()=>Promise.reject(Error('private_database_detail'))
      const failed=await fetch(`${url}/templates`);const failedBody=await failed.text()
      check('catalog API failure generic and recoverable',failed.status===500&&!failedBody.includes('private_database_detail')&&failedBody.includes('retry'))
    } finally {(pool as any).query=original}
  } finally {
    if(previousAuthority===undefined)delete process.env.ENABLE_COMPETITION_AUTHORITY
    else process.env.ENABLE_COMPETITION_AUTHORITY=previousAuthority
    await templateService.disableTemplate(tid).catch(()=>{})
    await new Promise<void>(r=>server.close(()=>r()))
    await pool.end()
  }
  const authority=readFileSync('packages/client/src/game-loader/AuthorityCompetition.tsx','utf8')
  check('competition controls retain authority bindings',authority.includes("socket.volatile.emit('authority:controls'")&&authority.includes('snapshot:snapshot.seq'))
  check('UI does not simulate or submit score',!authority.includes('renderer.update(')&&!authority.includes("emit('submitScore'"))
  check('join only template identifier',authority.includes("socket.emit('competition:join',{templateId})"))
  check('raw API errors not shown',!authority.includes('setStatus(p.message)')&&!authority.includes('p.code.replaceAll'))
  console.log(`Total Passed: ${passes}; Total Failed: ${failures}`)
  if(failures)process.exitCode=1
}
main().catch(async(error)=>{console.error('FAIL competition player UX check failed:',error instanceof Error?error.message:'unknown error');await pool.end().catch(()=>{});process.exitCode=1})

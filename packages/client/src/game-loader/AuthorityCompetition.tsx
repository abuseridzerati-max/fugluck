import { useEffect, useRef, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { SpaceBlasterEngine } from '@fugluck/games/space-blaster/engine'
import { CyberHopperEngine } from '@fugluck/games/cyber-hopper/engine'
import { StackTowerEngine } from '@fugluck/games/stack-tower/engine'
import type { AuthorityBinding, AuthoritySnapshot, ClientToServerEvents, ServerToClientEvents, CompetitionTemplate } from '@fugluck/shared'
import { useTranslation } from 'react-i18next'
import { API_URL, apiFetch, ApiError } from '../lib/api'
import { competitionErrorKey, moneyLabel, type PlayerCompetition } from '../lib/competitionPresentation'
import { CompetitionPlayerSlots, CompetitionTerms, CompetitionRules, CompetitionResult, CompetitionBracket } from '../components/CompetitionUI'
import '../components/competition.css'
import { useAuth } from '../auth/AuthContext'
import { AuthorityPresentation } from './authorityPresentation'

/** Competition renderer: never calls engine.update and never submits a final score. */
export type CompetitionLobbyState = { instance:PlayerCompetition|null; status:string; canCancel:boolean; cancel:()=>void; retry:()=>void }
export function AuthorityCompetition({ gameId = 'space-blaster', templateId, template, onExit, onComplete, renderLobby, onCancelled }: { gameId?: string; templateId: string; template?: CompetitionTemplate; onExit: () => void; onComplete?:()=>void; renderLobby?:(state:CompetitionLobbyState)=>ReactNode; onCancelled?:()=>void }) {
  const { t, i18n } = useTranslation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const connection = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const binding = useRef<AuthorityBinding | null>(null)
  const waitingInstance = useRef<string | null>(null)
  const controls = useRef({ left:false,right:false,up:false,down:false,fire:false })
  const keyControls = useRef({ left:false,right:false,up:false,down:false,fire:false })
  const activePointers = useRef(new Map<number, 'left'|'right'|'up'|'down'|'fire'>())
  const hopPulses = useRef({ hopUp:false,hopDown:false,hopLeft:false,hopRight:false })
  const dropPulse = useRef(false)
  const swipeState = useRef<{ pointerId: number | null; x: number; y: number; consumed: boolean }>({ pointerId: null, x: 0, y: 0, consumed: false })
  const [status,setStatus] = useState('connecting')
  const [countdown,setCountdown] = useState(0)
  const [instance,setInstance] = useState<PlayerCompetition|null>(null)
  const [hasSession,setHasSession] = useState(false)
  const [enteredPlay,setEnteredPlay] = useState(false)
  const refreshInstance=useRef<(()=>void)|null>(null)
  const [active,setActive] = useState(false)
  const [terminal,setTerminal] = useState(false)
  const [canCancel,setCanCancel] = useState(false)
  const [diagnostics,setDiagnostics] = useState('')
  const diagnosticEnabled=(import.meta.env.DEV||window.location.hostname==='staging.fugluck.com')&&new URLSearchParams(window.location.search).has('authorityDiagnostics')
  const diagnosticRequested=useRef(false)
  const firePulse=useRef(false)
  const { refreshUser, user } = useAuth()
  const userId = useRef(user?.id);userId.current=user?.id
  const refresh = useRef(refreshUser); refresh.current=refreshUser
  const finish=useRef(onComplete);finish.current=onComplete
  const cancelled=useRef(onCancelled);cancelled.current=onCancelled
  const triggerSend = useRef<(()=>void)|null>(null)
  const gameTitle = gameId === 'cyber-hopper' ? 'Cyber Hopper' : gameId === 'stack-tower' ? 'Stack Tower' : 'Space Blaster'
  const syncBlasterControls = () => {
    let pLeft = false, pRight = false, pUp = false, pDown = false, pFire = false
    for (const c of activePointers.current.values()) {
      if (c === 'left') pLeft = true
      else if (c === 'right') pRight = true
      else if (c === 'up') pUp = true
      else if (c === 'down') pDown = true
      else if (c === 'fire') pFire = true
    }
    controls.current.left = keyControls.current.left || pLeft
    controls.current.right = keyControls.current.right || pRight
    controls.current.up = keyControls.current.up || pUp
    controls.current.down = keyControls.current.down || pDown
    controls.current.fire = keyControls.current.fire || pFire
  }
  useEffect(()=>{
    const renderer = gameId === 'cyber-hopper'
      ? new CyberHopperEngine(1)
      : gameId === 'stack-tower'
        ? new StackTowerEngine(1)
        : new SpaceBlasterEngine(1)
    renderer.resize(1280, 720)
    const syncCanvasBacking = () => {
      const el = canvas.current
      if (!el) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const targetW = Math.round(1280 * dpr)
      const targetH = Math.round(720 * dpr)
      if (el.width !== targetW || el.height !== targetH) {
        el.width = targetW
        el.height = targetH
      }
    }
    syncCanvasBacking()
    window.addEventListener('resize', syncCanvasBacking)
    const storageKey=`authority:${templateId}`
    let instanceId:string|null=sessionStorage.getItem(storageKey), seq=0, snapshot:AuthoritySnapshot|null=null, complete=false, pendingRecovery=false
    let presentation=new AuthorityPresentation(), animation=0, diagnosticStarted=0, lastStatus=''
    let reading:AbortController|null=null, ticketRequest:AbortController|null=null, disposed=false, completionReported=false, currentStatus:string|undefined, authFailure:string|undefined
    const reportComplete=()=>{if(!completionReported){completionReported=true;finish.current?.()}}
    const readInstance=async()=>{
      if(!instanceId||reading)return
      const controller=new AbortController();reading=controller
      const timeout=window.setTimeout(()=>controller.abort(),6000)
      try {
        const result=await apiFetch<{instance:PlayerCompetition}>(`/api/competitions/instances/${encodeURIComponent(instanceId)}`,{signal:controller.signal})
        if(disposed)return
        currentStatus=result.instance.status
        setInstance(result.instance)
        setCanCancel(!binding.current&&result.instance.status==='PENDING_ENTRANTS'&&result.instance.participants.some(p=>p.userId===userId.current))
        if(['SETTLED','CANCELLED','VOIDED'].includes(result.instance.status)||result.instance.tournament?.playerState==='ELIMINATED') {
          complete=true;setTerminal(true);setActive(false);setCanCancel(false);sessionStorage.removeItem(storageKey);neutral();reportComplete()
        } else if(!binding.current&&result.instance.status==='PENDING_ENTRANTS')say('waiting')
        else if(!binding.current&&result.instance.tournament){pendingRecovery=true;say('knockout.nextRound')}
      } catch { if(!disposed&&!complete&&!binding.current)say('waitingRetry') }
      finally {window.clearTimeout(timeout);reading=null}
    }
    refreshInstance.current=()=>{if(!socket.connected)socket.connect();else void readInstance()}
    const controlEvidence={samples:0,minX:1280,maxX:0,minY:720,maxY:0,maxScore:0,maxBullets:0,directions:[] as string[],activeMs:0,terminalState:''}
    const say=(text:string)=>{if(text!==lastStatus){lastStatus=text;setStatus(text)}}
    waitingInstance.current=instanceId
    const socket:Socket<ServerToClientEvents,ClientToServerEvents>=io(API_URL,{withCredentials:true,autoConnect:false,
      auth:callback=>{authFailure=undefined;const controller=new AbortController();ticketRequest=controller
        const timeout=window.setTimeout(()=>controller.abort(),6000)
        void apiFetch<{token:string}>('/api/auth/socket-ticket',{method:'POST',signal:controller.signal})
        .then(result=>{if(!disposed)callback({socketTicket:result.token})})
        .catch(error=>{if(!disposed){authFailure=error instanceof ApiError&&[401,403].includes(error.status)?'errors.signIn':'connectionError';say(authFailure);callback({socketTicket:null})}})
        .finally(()=>{window.clearTimeout(timeout);if(ticketRequest===controller)ticketRequest=null})},
    })
    connection.current=socket
    socket.on('authority:probe',ack=>ack())
    socket.on('connect',()=>{
      if(complete)return
      if(instanceId) socket.emit('authority:resume',{instanceId})
      else socket.emit('competition:join',{templateId})
    })
    socket.on('competition:joined',p=>{instanceId=p.instanceId;waitingInstance.current=p.instanceId;sessionStorage.setItem(storageKey,p.instanceId);say('waiting');void readInstance();void refresh.current()})
    socket.on('competition:cancelled',()=>{complete=true;sessionStorage.removeItem(storageKey);setTerminal(true);setCanCancel(false);reportComplete();void readInstance();void refresh.current();cancelled.current?.()})
    socket.on('competition:error',p=>say(`errors.${competitionErrorKey(p.code)}`))
    socket.on('authority:error',p=>{
      if(complete)return
      if(['NOT_ACTIVE','INPUT_STALE','INPUT_SEQUENCE','ILLEGAL_READY'].includes(p.code))return
      if(['RESULT_PENDING_RECOVERY','SESSION_UNAVAILABLE','SESSION_TERMINAL','ACCOUNTING_PENDING'].includes(p.code))pendingRecovery=true
      say(p.code==='CONTROLLER_REPLACED'?'otherWindow':currentStatus==='PENDING_ENTRANTS'?'waiting':currentStatus==='LOCKED'?'starting':'recovering')
      void readInstance()
      if(p.code==='CONTROLLER_REPLACED') {socket.disconnect();setActive(false)}
    })
    socket.on('authority:session',p=>{if(complete)return;binding.current=p;pendingRecovery=false;setHasSession(true);setEnteredPlay(true);waitingInstance.current=null;setCanCancel(false);instanceId=p.instanceId;sessionStorage.setItem(storageKey,p.instanceId);seq=0;snapshot=null;neutral();presentation=new AuthorityPresentation();socket.emit('authority:ready',p);void readInstance()})
    socket.on('authority:snapshot',p=>{
      if(complete)return
      const received=performance.now()
      if(!binding.current||!presentation.accept(p,binding.current.sessionId,binding.current.epoch,received,document.hidden))return
      snapshot=p
      presentation.applied(performance.now())
      const playing=p.state==='ACTIVE'&&p.startAt!==null&&p.serverTime>=p.startAt
      setActive(playing)
      if(playing){
        controlEvidence.samples++
        if(p.shipX!==undefined){controlEvidence.minX=Math.min(controlEvidence.minX,p.shipX);controlEvidence.maxX=Math.max(controlEvidence.maxX,p.shipX)}
        if(p.shipY!==undefined){controlEvidence.minY=Math.min(controlEvidence.minY,p.shipY);controlEvidence.maxY=Math.max(controlEvidence.maxY,p.shipY)}
        controlEvidence.maxScore=Math.max(controlEvidence.maxScore,p.score)
        if(p.bullets)controlEvidence.maxBullets=Math.max(controlEvidence.maxBullets,p.bullets.length)
      }
      else if(['COMPLETED','VOIDED','FORFEITED'].includes(p.state)){controlEvidence.terminalState=p.state;neutral()}
      setCountdown(p.startAt?Math.max(0,Math.ceil((p.startAt-p.serverTime)/1000)):0)
      say(p.state==='COMPLETED'?'runComplete':playing?(gameId==='cyber-hopper'?'hopperControls':gameId==='stack-tower'?'stackTowerControls':'blasterControls'):p.state==='VOIDED'?'recovering':p.startAt?'countdown':'starting')
    })
    socket.on('authority:outcome',p=>{
      if(p.matchId&&binding.current&&p.matchId!==binding.current.matchId)return
      if(p.status==='ROUND_COMPLETE'){
        binding.current=null;snapshot=null;presentation=new AuthorityPresentation();setHasSession(false);setActive(false);neutral();pendingRecovery=true;say('knockout.nextRound');void readInstance();return
      }
      complete=true;sessionStorage.removeItem(storageKey);setTerminal(true);setActive(false);setCanCancel(false);neutral()
      reportComplete()
      if(p.yourScore!==undefined){renderer.score=p.yourScore;const ctx=canvas.current?.getContext('2d');if(ctx)renderer.render(ctx)}
      void readInstance();void refresh.current()
    })
    socket.on('disconnect',()=>{neutral();setActive(false);if(!complete)say('reconnecting')})
    socket.on('connect_error',error=>say(authFailure??(error.message==='unauthorized'?'errors.signIn':'connectionError')))
    const sendControls = () => {
      if(complete||!socket.connected||!binding.current||!snapshot||snapshot.state!=='ACTIVE')return
      if(diagnosticEnabled&&diagnosticRequested.current&&snapshot.startAt!==null&&snapshot.serverTime>=snapshot.startAt){
        if(!diagnosticStarted)diagnosticStarted=performance.now()
        const elapsed=performance.now()-diagnosticStarted
        controlEvidence.activeMs=elapsed
        if(elapsed<24000){
          if(gameId==='stack-tower'){
            if(Math.floor(elapsed/900)>controlEvidence.directions.length){
              dropPulse.current=true
              controlEvidence.directions.push('drop')
            }
          }else if(gameId==='cyber-hopper'){
            const step=Math.floor(elapsed/800)%4
            const dir=step===0?'hopUp':step===1?'hopRight':step===2?'hopUp':'hopLeft'
            hopPulses.current[dir]=true
            if(controlEvidence.directions.at(-1)!==dir)controlEvidence.directions.push(dir)
          }else{
            const direction=Math.floor(elapsed/2000)%2===0?'left':'right'
            controls.current={left:direction==='left',right:direction==='right',up:false,down:false,fire:true}
            if(controlEvidence.directions.at(-1)!==direction)controlEvidence.directions.push(direction)
          }
        }else{diagnosticRequested.current=false;neutral()}
      }
      if(gameId==='stack-tower'){
        socket.volatile.emit('authority:controls',{
          ...binding.current,
          seq:++seq,
          snapshot:snapshot.seq,
          drop:dropPulse.current,
        })
        dropPulse.current=false
      }else if(gameId==='cyber-hopper'){
        socket.volatile.emit('authority:controls',{
          ...binding.current,
          seq:++seq,
          snapshot:snapshot.seq,
          hopUp:hopPulses.current.hopUp,
          hopDown:hopPulses.current.hopDown,
          hopLeft:hopPulses.current.hopLeft,
          hopRight:hopPulses.current.hopRight,
        })
        hopPulses.current={hopUp:false,hopDown:false,hopLeft:false,hopRight:false}
      }else{
        socket.volatile.emit('authority:controls',{...binding.current,...controls.current,fire:controls.current.fire||firePulse.current,seq:++seq,snapshot:snapshot.seq})
        firePulse.current=false
      }
    }
    triggerSend.current = sendControls
    const send=setInterval(sendControls,50)
    const retry=setInterval(()=>{if(pendingRecovery&&!complete&&socket.connected&&instanceId)socket.emit('authority:resume',{instanceId})},3000)
    const neutral=()=>{controls.current={left:false,right:false,up:false,down:false,fire:false};keyControls.current={left:false,right:false,up:false,down:false,fire:false};activePointers.current.clear();swipeState.current={pointerId:null,x:0,y:0,consumed:false};hopPulses.current={hopUp:false,hopDown:false,hopLeft:false,hopRight:false};dropPulse.current=false;firePulse.current=false}
    const visibility=()=>{if(document.hidden){neutral();diagnosticRequested.current=false}}
    const key=(event:KeyboardEvent,down:boolean)=>{
      // Keep page actions operable with Enter/Space; game shortcuts only control the play surface.
      if(complete||!snapshot||snapshot.state!=='ACTIVE'||(event.target instanceof HTMLElement&&event.target.closest('button,a,input,summary,select,textarea')))return
      if(gameId==='stack-tower'){
        if(!down||event.repeat)return
        if(event.key===' '||event.key==='Enter'||event.key==='ArrowDown'){
          event.preventDefault()
          dropPulse.current=true
          sendControls()
        }
        return
      }
      if(gameId==='cyber-hopper'){
        if(!down||event.repeat)return
        let handled=false
        if(event.key==='ArrowUp'||event.key==='w'||event.key==='W'||event.key===' '){hopPulses.current.hopUp=true;handled=true}
        else if(event.key==='ArrowDown'||event.key==='s'||event.key==='S'){hopPulses.current.hopDown=true;handled=true}
        else if(event.key==='ArrowLeft'||event.key==='a'||event.key==='A'){hopPulses.current.hopLeft=true;handled=true}
        else if(event.key==='ArrowRight'||event.key==='d'||event.key==='D'){hopPulses.current.hopRight=true;handled=true}
        if(handled){event.preventDefault();sendControls()}
        return
      }
      const map:Record<string,'left'|'right'|'up'|'down'|'fire'>={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',' ':'fire'}
      const control=map[event.key];if(!control)return;event.preventDefault()
      keyControls.current[control]=down
      syncBlasterControls()
      if(control==='fire'&&down&&!event.repeat)firePulse.current=true
    }
    const keydown=(e:KeyboardEvent)=>key(e,true),keyup=(e:KeyboardEvent)=>key(e,false)
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',neutral);document.addEventListener('visibilitychange',visibility)
    const draw=()=>{
      const state=presentation.visual(performance.now()),ctx=canvas.current?.getContext('2d')
      if(state&&ctx){
        if(gameId==='stack-tower'){
          Object.assign(renderer,{
            tickCount:state.tickCount,
            score:state.score,
            gameOver:state.gameOver,
            tower:state.tower??[],
            activeBlock:state.activeBlock,
            fallingPieces:state.fallingPieces??[],
            cameraY:state.cameraY??0,
            blocksPlaced:state.blocksPlaced??0,
            perfectStreak:state.perfectStreak??0,
            maxStreak:state.maxStreak??0,
            perfectPulseTicks:state.perfectPulseTicks??0,
            lastPulseX:state.lastPulseX??0,
            lastPulseWidth:state.lastPulseWidth??0,
            lastPulseLevel:state.lastPulseLevel??0,
          })
        }else if(gameId==='cyber-hopper'){
          Object.assign(renderer,{
            tickCount:state.tickCount,
            score:state.score,
            gameOver:state.gameOver,
            gridX:state.gridX??10,
            gridY:state.gridY??0,
            roundsCompleted:state.roundsCompleted??0,
            obstacles:state.obstacles??[],
          })
        }else{
          Object.assign(renderer,{
            tickCount:state.tickCount,
            score:state.score,
            gameOver:state.gameOver,
            shipX:state.shipX,
            shipY:state.shipY,
            bullets:state.bullets,
            asteroids:state.asteroids,
          })
        }
        renderer.render(ctx)
        presentation.frameAt(performance.now())
      }
      if(!complete&&socket.connected&&state?.state==='ACTIVE'&&performance.now()-presentation.receivedAt>250)say('connectionDelayed')
      animation=requestAnimationFrame(draw)
    }
    animation=requestAnimationFrame(draw)
    const diagnosticTimer=diagnosticEnabled?setInterval(()=>setDiagnostics(JSON.stringify({transport:socket.io.engine?.transport.name,visibility:document.visibilityState,controls:controls.current,hopPulses:hopPulses.current,controlEvidence,...presentation.report()},null,2)),500):undefined
    const observer=diagnosticEnabled&&typeof PerformanceObserver!=='undefined'?new PerformanceObserver(entries=>{for(const entry of entries.getEntries())presentation.longTask(entry.duration)}):undefined
    if(observer&&PerformanceObserver.supportedEntryTypes?.includes('longtask'))observer.observe({entryTypes:['longtask']})
    const poll=setInterval(()=>{if(!document.hidden)void readInstance()},5000)
    if(instanceId)void readInstance()
    socket.connect()
    return()=>{disposed=true;reading?.abort();ticketRequest?.abort();refreshInstance.current=null;triggerSend.current=null;clearInterval(poll);clearInterval(send);clearInterval(retry);clearInterval(diagnosticTimer);observer?.disconnect();cancelAnimationFrame(animation);neutral();socket.disconnect();binding.current=null;window.removeEventListener('resize',syncCanvasBacking);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',neutral);document.removeEventListener('visibilitychange',visibility)}
  },[templateId,gameId])
  const terms=instance??template
  const preparing=hasSession&&!active&&!terminal&&(status==='starting'||status==='countdown')
  const inLobby=Boolean(renderLobby&&!enteredPlay&&!terminal)
  const cancel=()=>{if(waitingInstance.current)connection.current?.emit('competition:cancel',{instanceId:waitingInstance.current})}
  return <>{inLobby&&renderLobby?.({instance,status,canCancel,cancel,retry:()=>refreshInstance.current?.()})}<section hidden={inLobby} className="competition-play competition-ux" lang={i18n.resolvedLanguage}>
    <header className="competition-play-header"><h2>{gameTitle}</h2>{!terminal&&<span className="competition-test-label">{t('competition.testLabel')}</span>}</header>
    {instance?.tournament?.currentMatch&&!terminal&&<p>{t(`competition.knockout.rounds.${instance.tournament.currentMatch.roundName}`)}</p>}
    {terminal?<CompetitionResult instance={instance} userId={user?.id} onRetry={()=>refreshInstance.current?.()}/>:!hasSession?<div className="competition-waiting">
      <h2>{t(instance?'competition.youreIn':'competition.connecting')}</h2>
      {instance?.tournament?.cycle&&<p>{t('competition.knockout.starts',{date:new Intl.DateTimeFormat(i18n.resolvedLanguage,{timeZone:instance.tournament.cycle.timezone,weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(instance.tournament.cycle.startsAt)),zone:instance.tournament.cycle.timezone})}</p>}
      {terms&&<CompetitionTerms entryMinor={terms.entryFeeMinor} prizeMinor={terms.prizes?.find(p=>p.placement===1)?.amountMinor??0} currency={terms.currency}/>}
      {instance&&<CompetitionPlayerSlots joined={instance.currentParticipants} capacity={instance.participantCapacity}/>}
      <p role="status">{t(`competition.${status==='waiting'&&instance?'waitingPlayers':status}`,{count:instance?Math.max(0,instance.participantCapacity-instance.currentParticipants):0,amount:moneyLabel(terms?.entryFeeMinor??0,terms?.currency)})}</p>
      {canCancel&&<button type="button" className="ac-btn ac-btn--secondary" onClick={()=>{if(waitingInstance.current)connection.current?.emit('competition:cancel',{instanceId:waitingInstance.current})}}>{t('competition.leaveCompetition')}</button>}
      {status==='waitingRetry'&&<button type="button" className="ac-btn ac-btn--secondary" onClick={()=>refreshInstance.current?.()}>{t('competition.retry')}</button>}
    </div>:preparing?<div className="competition-waiting">
      <h2>{t('competition.status.full')}</h2>
      {instance&&<CompetitionPlayerSlots joined={instance.currentParticipants} capacity={instance.participantCapacity}/>}
      <p role="status">{t(`competition.${status}`,{count:countdown})}</p>
    </div>:<p role="status">{t(`competition.${status}`,{count:countdown,amount:moneyLabel(terms?.entryFeeMinor??0,terms?.currency)})}</p>}
    <canvas
      hidden={!hasSession||terminal||preparing}
      ref={canvas}
      width={1280}
      height={720}
      className="ac-game-surface"
      aria-label={t('competition.liveCanvas',{game:gameTitle})}
      style={{width:'100%',aspectRatio:'16 / 9',objectFit:'contain',background:gameId==='stack-tower'?'#070a10':gameId==='cyber-hopper'?'#060913':'#080d19',display:(!hasSession||terminal||preparing)?'none':'block'}}
      onPointerDown={gameId==='stack-tower' ? e => {
        if (!active || (e.pointerType === 'mouse' && e.button !== 0)) return
        e.preventDefault()
        dropPulse.current = true
        triggerSend.current?.()
      } : gameId==='cyber-hopper' ? e => {
        if (!active || (e.pointerType === 'mouse' && e.button !== 0)) return
        e.preventDefault()
        if (swipeState.current.pointerId !== null) return
        swipeState.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, consumed: false }
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      } : undefined}
      onPointerMove={gameId==='cyber-hopper' ? e => {
        const s = swipeState.current
        if (!active || s.pointerId !== e.pointerId || s.consumed) return
        const dx = e.clientX - s.x, dy = e.clientY - s.y
        if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return
        s.consumed = true
        if (Math.abs(dx) > Math.abs(dy)) hopPulses.current[dx > 0 ? 'hopRight' : 'hopLeft'] = true
        else hopPulses.current[dy > 0 ? 'hopDown' : 'hopUp'] = true
        triggerSend.current?.()
      } : undefined}
      onPointerUp={gameId==='cyber-hopper' ? e => { if (swipeState.current.pointerId === e.pointerId) swipeState.current.pointerId = null } : undefined}
      onPointerCancel={gameId==='cyber-hopper' ? e => { if (swipeState.current.pointerId === e.pointerId) swipeState.current.pointerId = null } : undefined}
      onLostPointerCapture={gameId==='cyber-hopper' ? e => { if (swipeState.current.pointerId === e.pointerId) swipeState.current.pointerId = null } : undefined}
    />
    {hasSession&&!terminal&&!preparing&&<div className="competition-play-controls ac-game-surface">
      {gameId==='stack-tower' ? (
        <button
          type="button"
          className="ac-btn ac-btn--primary"
          disabled={!active}
          style={{minWidth:160,minHeight:52,touchAction:'none',fontWeight:'bold',letterSpacing:'0.08em'}}
          onClick={e=>{if(e.detail===0){dropPulse.current=true;triggerSend.current?.()}}}
          onPointerDown={e=>{e.preventDefault();try{e.currentTarget.setPointerCapture(e.pointerId)}catch{/* ignore */};dropPulse.current=true;triggerSend.current?.()}}
        >{t('competition.controls.drop')}</button>
      ) : gameId==='cyber-hopper' ? (
        ([
          { key:'hopUp', label:`▲ ${t('competition.controls.up')} (W)` },
          { key:'hopDown', label:`▼ ${t('competition.controls.down')} (S)` },
          { key:'hopLeft', label:`◀ ${t('competition.controls.left')} (A)` },
          { key:'hopRight', label:`▶ ${t('competition.controls.right')} (D)` },
        ] as const).map(btn=><button key={btn.key} type="button" className="ac-btn ac-btn--ghost" disabled={!active} style={{minWidth:76,minHeight:48,touchAction:'none',fontWeight:'bold'}}
          onClick={e=>{if(e.detail===0){hopPulses.current[btn.key]=true;triggerSend.current?.()}}}
          onPointerDown={e=>{e.preventDefault();try{e.currentTarget.setPointerCapture(e.pointerId)}catch{/* ignore */};hopPulses.current[btn.key]=true;triggerSend.current?.()}}
          onPointerUp={()=>{}}
          onLostPointerCapture={()=>{}}
          onPointerCancel={()=>{}}>{btn.label}</button>)
      ) : (
        (['left','up','down','right','fire'] as const).map(control=><button key={control} type="button" className={`ac-btn ${control==='fire'?'ac-btn--primary':'ac-btn--ghost'}`} disabled={!active} style={{minWidth:control==='fire'?84:60,minHeight:48,touchAction:'none'}}
          onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();keyControls.current[control]=true;syncBlasterControls();if(control==='fire')firePulse.current=true;triggerSend.current?.()}}}
          onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){keyControls.current[control]=false;syncBlasterControls()}}}
          onBlur={()=>{keyControls.current[control]=false;syncBlasterControls()}}
          onPointerDown={e=>{e.preventDefault();try{e.currentTarget.setPointerCapture(e.pointerId)}catch{/* ignore */};activePointers.current.set(e.pointerId,control);syncBlasterControls();if(control==='fire')firePulse.current=true}}
          onPointerUp={e=>{if(activePointers.current.delete(e.pointerId))syncBlasterControls()}}
          onLostPointerCapture={e=>{if(activePointers.current.delete(e.pointerId))syncBlasterControls()}}
          onPointerCancel={e=>{if(activePointers.current.delete(e.pointerId))syncBlasterControls()}}>{t(`competition.controls.${control}`)}</button>)
      )}
    </div>}
    {active&&<button type="button" className="ac-btn ac-btn--secondary" onClick={()=>{if(binding.current)connection.current?.emit('authority:forfeit',binding.current)}}>{t('competition.forfeit')}</button>}
    <button type="button" className="ac-btn ac-btn--ghost" onClick={onExit}>{t(active?'competition.leaveActive':'competition.backToCompetitions')}</button>
    {instance?.tournament&&<CompetitionBracket instance={instance} userId={user?.id}/>}
    {template&&<CompetitionRules template={template}/>}
    {diagnosticEnabled&&<details><summary>Staging connection diagnostics</summary>
      <p>Optional 24-second automated control check: alternating steering and held firing through the normal socket controls. Results remain server-owned.</p>
      <button disabled={terminal} onClick={()=>{diagnosticRequested.current=true}}>Run sustained control check</button>
      <button disabled={!active} onClick={()=>{connection.current?.disconnect();setTimeout(()=>connection.current?.connect(),500)}}>Check reconnect</button>
      <pre data-testid="authority-diagnostics" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11}}>{diagnostics}</pre>
    </details>}
  </section></>
}

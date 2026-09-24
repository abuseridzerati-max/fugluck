import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { SpaceBlasterEngine } from '@fugluck/games/space-blaster/engine'
import { CyberHopperEngine } from '@fugluck/games/cyber-hopper/engine'
import type { AuthorityBinding, AuthoritySnapshot, ClientToServerEvents, ServerToClientEvents } from '@fugluck/shared'
import { API_URL } from '../lib/api'
import { getStoredAuthToken, useAuth } from '../auth/AuthContext'
import { AuthorityPresentation } from './authorityPresentation'

/** Competition renderer: never calls engine.update and never submits a final score. */
export function AuthorityCompetition({ gameId = 'space-blaster', templateId, onExit }: { gameId?: string; templateId: string; onExit: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const connection = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const binding = useRef<AuthorityBinding | null>(null)
  const waitingInstance = useRef<string | null>(null)
  const controls = useRef({ left:false,right:false,up:false,down:false,fire:false })
  const hopPulses = useRef({ hopUp:false,hopDown:false,hopLeft:false,hopRight:false })
  const [status,setStatus] = useState('Connecting to sandbox competition…')
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
  const triggerSend = useRef<(()=>void)|null>(null)
  const gameTitle = gameId === 'cyber-hopper' ? 'Cyber Hopper' : 'Space Blaster'
  useEffect(()=>{
    const renderer = gameId === 'cyber-hopper' ? new CyberHopperEngine(1) : new SpaceBlasterEngine(1)
    renderer.resize(1280, 720)
    const storageKey=`authority:${templateId}`
    let instanceId:string|null=sessionStorage.getItem(storageKey), seq=0, snapshot:AuthoritySnapshot|null=null, complete=false, pendingRecovery=false
    let presentation=new AuthorityPresentation(), animation=0, diagnosticStarted=0, lastStatus=''
    const controlEvidence={samples:0,minX:1280,maxX:0,minY:720,maxY:0,maxScore:0,maxBullets:0,directions:[] as string[],activeMs:0,terminalState:''}
    const say=(text:string)=>{if(text!==lastStatus){lastStatus=text;setStatus(text)}}
    waitingInstance.current=instanceId
    const socket:Socket<ServerToClientEvents,ClientToServerEvents>=io(API_URL,{withCredentials:true,auth:{token:getStoredAuthToken()},autoConnect:false})
    connection.current=socket
    socket.on('authority:probe',ack=>ack())
    socket.on('connect',()=>{
      if(complete)return
      if(instanceId) socket.emit('authority:resume',{instanceId})
      else socket.emit('competition:join',{templateId})
    })
    socket.on('competition:joined',p=>{instanceId=p.instanceId;waitingInstance.current=p.instanceId;setCanCancel(true);sessionStorage.setItem(storageKey,p.instanceId);say('Waiting for the other player…')})
    socket.on('competition:cancelled',()=>{sessionStorage.removeItem(storageKey);setTerminal(true);setStatus('Entry cancelled. Sandbox reservation released.');void refresh.current()})
    socket.on('competition:error',p=>setStatus(p.message))
    socket.on('authority:error',p=>{
      if(complete)return
      if(['NOT_ACTIVE','INPUT_STALE','INPUT_SEQUENCE','ILLEGAL_READY'].includes(p.code))return
      if(['RESULT_PENDING_RECOVERY','SESSION_UNAVAILABLE','SESSION_TERMINAL','ACCOUNTING_PENDING'].includes(p.code))pendingRecovery=true
      setStatus(`Competition paused: ${p.code.replaceAll('_',' ').toLowerCase()}.`)
      if(p.code==='CONTROLLER_REPLACED') {socket.disconnect();setActive(false)}
    })
    socket.on('authority:session',p=>{binding.current=p;waitingInstance.current=null;setCanCancel(false);instanceId=p.instanceId;sessionStorage.setItem(storageKey,p.instanceId);seq=0;presentation=new AuthorityPresentation();socket.emit('authority:ready',p)})
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
      const instructions = gameId === 'cyber-hopper'
        ? 'Use arrow keys, WASD, or touch buttons to hop across lanes. Avoid the hovercars.'
        : 'Use arrow keys or WASD to move. Hold Space or Fire to shoot.'
      say(p.state==='COMPLETED'?'Your run is complete. Waiting for the other result…':playing?instructions:p.state==='VOIDED'?'Competition stopped. Confirming the sandbox refund…':p.startAt?`Starting in ${Math.max(0,Math.ceil((p.startAt-p.serverTime)/1000))}…`:'Waiting for both players to be ready…')
    })
    socket.on('authority:outcome',p=>{
      complete=true;sessionStorage.removeItem(storageKey);setTerminal(true);setActive(false);setCanCancel(false);neutral()
      if(p.yourScore!==undefined){renderer.score=p.yourScore;const ctx=canvas.current?.getContext('2d');if(ctx)renderer.render(ctx)}
      setStatus(p.status==='VOIDED'?'Competition voided — sandbox entry refunded.':p.winnerUserId===userId.current?'You won — the predetermined sandbox prize has been awarded.':'Competition finished — your opponent won.');void refresh.current()
    })
    socket.on('disconnect',()=>{neutral();setActive(false);if(!complete)say('Connection interrupted. Reconnecting…')})
    socket.on('connect_error',()=>setStatus('Unable to connect. Retrying…'))
    const sendControls = () => {
      if(complete||!socket.connected||!binding.current||!snapshot||snapshot.state!=='ACTIVE')return
      if(diagnosticEnabled&&diagnosticRequested.current&&snapshot.startAt!==null&&snapshot.serverTime>=snapshot.startAt){
        if(!diagnosticStarted)diagnosticStarted=performance.now()
        const elapsed=performance.now()-diagnosticStarted
        controlEvidence.activeMs=elapsed
        if(elapsed<24000){
          if(gameId==='cyber-hopper'){
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
      if(gameId==='cyber-hopper'){
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
    const neutral=()=>{controls.current={left:false,right:false,up:false,down:false,fire:false};hopPulses.current={hopUp:false,hopDown:false,hopLeft:false,hopRight:false};firePulse.current=false}
    const visibility=()=>{if(document.hidden){neutral();diagnosticRequested.current=false}}
    const key=(event:KeyboardEvent,down:boolean)=>{
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
      controls.current[control]=down
      if(control==='fire'&&down&&!event.repeat)firePulse.current=true
    }
    const keydown=(e:KeyboardEvent)=>key(e,true),keyup=(e:KeyboardEvent)=>key(e,false)
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',neutral);document.addEventListener('visibilitychange',visibility)
    const draw=()=>{
      const state=presentation.visual(performance.now()),ctx=canvas.current?.getContext('2d')
      if(state&&ctx){
        if(gameId==='cyber-hopper'){
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
      if(!complete&&socket.connected&&state?.state==='ACTIVE'&&performance.now()-presentation.receivedAt>250)say('Connection delayed. Waiting for a fresh server update…')
      animation=requestAnimationFrame(draw)
    }
    animation=requestAnimationFrame(draw)
    const diagnosticTimer=diagnosticEnabled?setInterval(()=>setDiagnostics(JSON.stringify({transport:socket.io.engine?.transport.name,visibility:document.visibilityState,controls:controls.current,hopPulses:hopPulses.current,controlEvidence,...presentation.report()},null,2)),500):undefined
    const observer=diagnosticEnabled&&typeof PerformanceObserver!=='undefined'?new PerformanceObserver(entries=>{for(const entry of entries.getEntries())presentation.longTask(entry.duration)}):undefined
    if(observer&&PerformanceObserver.supportedEntryTypes?.includes('longtask'))observer.observe({entryTypes:['longtask']})
    socket.connect()
    return()=>{triggerSend.current=null;clearInterval(send);clearInterval(retry);clearInterval(diagnosticTimer);observer?.disconnect();cancelAnimationFrame(animation);neutral();socket.disconnect();binding.current=null;window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',neutral);document.removeEventListener('visibilitychange',visibility)}
  },[templateId,gameId])
  return <section style={{maxWidth:1100,margin:'auto',padding:16}}>
    <h2>{gameTitle} — Sandbox Competition</h2>
    <p>TEST / SANDBOX — NO REAL MONEY · Maximum run: 180 seconds</p>
    <p role="status">{status}</p>
    <canvas ref={canvas} width={1280} height={720} aria-label={`Live ${gameTitle} competition`} style={{width:'100%',aspectRatio:'16 / 9',objectFit:'contain',background:gameId==='cyber-hopper'?'#060913':'#080d19'}} />
    <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'12px 0'}}>
      {gameId==='cyber-hopper' ? (
        ([
          { key:'hopUp', label:'▲ Up (W)' },
          { key:'hopDown', label:'▼ Down (S)' },
          { key:'hopLeft', label:'◀ Left (A)' },
          { key:'hopRight', label:'▶ Right (D)' },
        ] as const).map(btn=><button key={btn.key} disabled={!active} style={{minWidth:80,minHeight:48,touchAction:'none',fontWeight:'bold'}}
          onPointerDown={e=>{e.preventDefault();hopPulses.current[btn.key]=true;triggerSend.current?.()}}
          onPointerUp={()=>{}}
          onLostPointerCapture={()=>{}}
          onPointerCancel={()=>{}}>{btn.label}</button>)
      ) : (
        (['left','up','down','right','fire'] as const).map(control=><button key={control} disabled={!active} style={{minWidth:60,minHeight:48,touchAction:'none'}}
          onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);controls.current[control]=true;if(control==='fire')firePulse.current=true}}
          onPointerUp={()=>{controls.current[control]=false}}
          onLostPointerCapture={()=>{controls.current[control]=false}}
          onPointerCancel={()=>{controls.current[control]=false}}>{control==='fire'?'Fire':control}</button>)
      )}
    </div>
    {active&&<button onClick={()=>{if(binding.current)connection.current?.emit('authority:forfeit',binding.current)}}>Forfeit competition</button>}
    {canCancel&&!terminal&&<button onClick={()=>{if(waitingInstance.current)connection.current?.emit('competition:cancel',{instanceId:waitingInstance.current})}}>Cancel waiting entry</button>}
    <button onClick={onExit}>{terminal?'Return to competitions':'Leave (active runs may forfeit)'}</button>
    {diagnosticEnabled&&<details><summary>Staging connection diagnostics</summary>
      <p>Optional 24-second automated control check: alternating steering and held firing through the normal socket controls. Results remain server-owned.</p>
      <button disabled={terminal} onClick={()=>{diagnosticRequested.current=true}}>Run sustained control check</button>
      <button disabled={!active} onClick={()=>{connection.current?.disconnect();setTimeout(()=>connection.current?.connect(),500)}}>Check reconnect</button>
      <pre data-testid="authority-diagnostics" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11}}>{diagnostics}</pre>
    </details>}
  </section>
}

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { SpaceBlasterEngine } from '@fugluck/games/space-blaster/engine'
import type { AuthorityBinding, AuthoritySnapshot, ClientToServerEvents, ServerToClientEvents } from '@fugluck/shared'
import { API_URL } from '../lib/api'
import { getStoredAuthToken, useAuth } from '../auth/AuthContext'

/** Competition renderer: never calls engine.update and never submits a final score. */
export function AuthorityCompetition({ templateId, onExit }: { templateId: string; onExit: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const connection = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const binding = useRef<AuthorityBinding | null>(null)
  const waitingInstance = useRef<string | null>(null)
  const controls = useRef({ left:false,right:false,up:false,down:false,fire:false })
  const [status,setStatus] = useState('Connecting to sandbox competition…')
  const [active,setActive] = useState(false)
  const [terminal,setTerminal] = useState(false)
  const { refreshUser, user } = useAuth()
  const userId = useRef(user?.id);userId.current=user?.id
  const refresh = useRef(refreshUser); refresh.current=refreshUser
  useEffect(()=>{
    const renderer=new SpaceBlasterEngine(1)
    const storageKey=`authority:${templateId}`
    let instanceId:string|null=sessionStorage.getItem(storageKey), seq=0, snapshot:AuthoritySnapshot|null=null, complete=false, pendingRecovery=false
    waitingInstance.current=instanceId
    const socket:Socket<ServerToClientEvents,ClientToServerEvents>=io(API_URL,{withCredentials:true,auth:{token:getStoredAuthToken()},autoConnect:false})
    connection.current=socket
    socket.on('authority:probe',ack=>ack())
    socket.on('connect',()=>{
      if(complete)return
      if(instanceId) socket.emit('authority:resume',{instanceId})
      else socket.emit('competition:join',{templateId})
    })
    socket.on('competition:joined',p=>{instanceId=p.instanceId;waitingInstance.current=p.instanceId;sessionStorage.setItem(storageKey,p.instanceId);setStatus('Waiting for the other player…')})
    socket.on('competition:cancelled',()=>{sessionStorage.removeItem(storageKey);setTerminal(true);setStatus('Entry cancelled. Sandbox reservation released.');void refresh.current()})
    socket.on('competition:error',p=>setStatus(p.message))
    socket.on('authority:error',p=>{
      if(complete)return
      if(['NOT_ACTIVE','INPUT_STALE','INPUT_SEQUENCE','ILLEGAL_READY'].includes(p.code))return
      if(['RESULT_PENDING_RECOVERY','SESSION_UNAVAILABLE','SESSION_TERMINAL','ACCOUNTING_PENDING'].includes(p.code))pendingRecovery=true
      setStatus(`Competition paused: ${p.code.replaceAll('_',' ').toLowerCase()}.`)
      if(p.code==='CONTROLLER_REPLACED') {socket.disconnect();setActive(false)}
    })
    socket.on('authority:session',p=>{binding.current=p;waitingInstance.current=null;instanceId=p.instanceId;sessionStorage.setItem(storageKey,p.instanceId);seq=0;socket.emit('authority:ready',p)})
    socket.on('authority:snapshot',p=>{
      snapshot=p
      Object.assign(renderer,{tickCount:p.tickCount,score:p.score,gameOver:p.gameOver,shipX:p.shipX,shipY:p.shipY,bullets:p.bullets,asteroids:p.asteroids})
      const ctx=canvas.current?.getContext('2d');if(ctx)renderer.render(ctx)
      const playing=p.state==='ACTIVE'&&p.startAt!==null&&p.serverTime>=p.startAt
      setActive(playing)
      setStatus(p.state==='COMPLETED'?'Your run is complete. Waiting for the other result…':playing?'Use arrow keys or WASD to move. Press Space to fire.':p.startAt?`Starting in ${Math.max(0,Math.ceil((p.startAt-p.serverTime)/1000))}…`:'Waiting for both players to be ready…')
    })
    socket.on('authority:outcome',p=>{
      complete=true;sessionStorage.removeItem(storageKey);setTerminal(true);setActive(false)
      if(p.yourScore!==undefined){renderer.score=p.yourScore;const ctx=canvas.current?.getContext('2d');if(ctx)renderer.render(ctx)}
      setStatus(p.status==='VOIDED'?'Competition voided — sandbox entry refunded.':p.winnerUserId===userId.current?'You won — the predetermined sandbox prize has been awarded.':'Competition finished — your opponent won.');void refresh.current()
    })
    socket.on('disconnect',()=>{if(!complete)setStatus('Connection interrupted. Reconnecting…')})
    socket.on('connect_error',()=>setStatus('Unable to connect. Retrying…'))
    const send=setInterval(()=>{
      if(complete||!socket.connected||!binding.current||!snapshot||snapshot.state!=='ACTIVE')return
      socket.volatile.emit('authority:controls',{...binding.current,...controls.current,seq:++seq,snapshot:snapshot.seq})
      controls.current.fire=false
    },50)
    const retry=setInterval(()=>{if(pendingRecovery&&!complete&&socket.connected&&instanceId)socket.emit('authority:resume',{instanceId})},3000)
    const neutral=()=>{controls.current={left:false,right:false,up:false,down:false,fire:false}}
    const key=(event:KeyboardEvent,down:boolean)=>{
      const map:Record<string,'left'|'right'|'up'|'down'|'fire'>={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',' ':'fire'}
      const control=map[event.key];if(!control)return;event.preventDefault()
      if(control==='fire') {if(down&&!event.repeat)controls.current.fire=true} else controls.current[control]=down
    }
    const keydown=(e:KeyboardEvent)=>key(e,true),keyup=(e:KeyboardEvent)=>key(e,false)
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',neutral)
    socket.connect()
    return()=>{clearInterval(send);clearInterval(retry);socket.disconnect();binding.current=null;window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',neutral)}
  },[templateId])
  return <section style={{maxWidth:1100,margin:'auto',padding:16}}>
    <h2>Space Blaster — Sandbox Competition</h2>
    <p>TEST / SANDBOX — NO REAL MONEY · Maximum run: 180 seconds</p>
    <p role="status">{status}</p>
    <canvas ref={canvas} width={1280} height={720} aria-label="Live Space Blaster competition" style={{width:'100%',aspectRatio:'16 / 9',objectFit:'contain',background:'#080d19'}} />
    <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'12px 0'}}>
      {(['left','up','down','right','fire'] as const).map(control=><button key={control} disabled={!active} style={{minWidth:60,minHeight:48,touchAction:'none'}}
        onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);controls.current[control]=true}}
        onPointerUp={()=>{if(control!=='fire')controls.current[control]=false}}
        onPointerCancel={()=>{controls.current[control]=false}}>{control==='fire'?'Fire':control}</button>)}
    </div>
    {active&&<button onClick={()=>{if(binding.current)connection.current?.emit('authority:forfeit',binding.current)}}>Forfeit competition</button>}
    {!active&&!terminal&&<button onClick={()=>{if(waitingInstance.current)connection.current?.emit('competition:cancel',{instanceId:waitingInstance.current})}}>Cancel waiting entry</button>}
    <button onClick={onExit}>{terminal?'Return to competitions':'Leave (active runs may forfeit)'}</button>
  </section>
}

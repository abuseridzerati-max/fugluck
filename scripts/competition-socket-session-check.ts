// Real HTTP/Socket.IO auth boundary with an in-memory account lookup. No SQL,
// competition entry, wallet action, hosted credential, or database connection.
import { createServer } from 'node:http'
import express from 'express'
import cookieParser from 'cookie-parser'
import { Server } from 'socket.io'
import { io as connect } from 'socket.io-client'
import jwt from 'jsonwebtoken'

let passes=0,failures=0
function check(label:string,condition:unknown){console.log(`${condition?'PASS':'FAIL'} ${label}`);condition?passes++:failures++}
async function main(){
  process.env.APP_ENV='test';process.env.NODE_ENV='test'
  process.env.DATABASE_URL='postgresql://unused@127.0.0.1:1/fugluck_socket_session_test'
  process.env.JWT_SECRET='socket-session-test-only-secret'
  const tokens=await import('../packages/server/src/auth/jwt')
  const {db,pool}=await import('../packages/server/src/db/client')
  const {socketAuthMiddleware}=await import('../packages/server/src/matchmaking/socketAuth')
  const {authRouter}=await import('../packages/server/src/routes/auth')
  let accountStatus='active'
  const originalFind=db.query.users.findFirst
  db.query.users.findFirst=(async()=>({id:'socket_fixture',username:'Socket Fixture',status:accountStatus,isEmailVerified:true})) as typeof originalFind
  const app=express();app.use(cookieParser());app.use(express.json());app.use('/api/auth',authRouter)
  const http=createServer(app),io=new Server(http)
  io.use(socketAuthMiddleware)
  io.on('connection',socket=>socket.emit('fixture:identity',{userId:socket.data.userId,isGuest:socket.data.isGuest}))
  await new Promise<void>(resolve=>http.listen(0,'127.0.0.1',resolve))
  const address=http.address() as {port:number};const url=`http://127.0.0.1:${address.port}`
  async function identity(auth:Record<string,unknown>,transport:'polling'|'websocket',cookie?:string){
    const s=connect(url,{auth,transports:[transport],reconnection:false,autoConnect:false,extraHeaders:cookie?{Cookie:cookie}:undefined})
    return new Promise<any>((resolve,reject)=>{
      const timeout=setTimeout(()=>{s.disconnect();reject(Error('Socket fixture timed out'))},4000)
      const done=(result:unknown)=>{clearTimeout(timeout);s.disconnect();resolve(result)}
      s.on('fixture:identity',done);s.on('connect_error',error=>done({error:error.message}));s.connect()
    })
  }
  try{
    const cookie=`${tokens.SESSION_COOKIE_NAME}=${tokens.signSessionToken({sub:'socket_fixture'})}`
    const anonymous=await fetch(`${url}/api/auth/socket-ticket`,{method:'POST'})
    check('anonymous HTTP cannot obtain socket proof',anonymous.status===401)
    const response=await fetch(`${url}/api/auth/socket-ticket`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({userId:'attacker'})})
    const {token}=await response.json() as {token:string}
    check('signed-in HTTP obtains a non-cacheable socket proof',response.status===200&&response.headers.get('cache-control')==='no-store')
    check('ticket identity comes only from the verified cookie',tokens.verifySocketTicket(token)?.sub==='socket_fixture')
    const decoded=jwt.decode(token) as jwt.JwtPayload
    check('ticket lifetime is limited to sixty seconds',(decoded.exp??0)-(decoded.iat??0)===60)
    check('socket proof cannot authenticate HTTP sessions',tokens.verifySessionToken(token)===null)
    check('ordinary session JWT cannot be used as a socket ticket',tokens.verifySocketTicket(tokens.signSessionToken({sub:'socket_fixture'}))===null)
    check('malformed and missing tickets are rejected',[null,undefined,123,'invalid',''].every(value=>tokens.verifySocketTicket(value)===null))
    const forged=jwt.sign({sub:'socket_fixture',purpose:'socket'},'different-secret',{issuer:'fugluck:test',audience:'fugluck:test:socket',expiresIn:60})
    check('forged socket ticket is rejected',tokens.verifySocketTicket(forged)===null)
    const expired=jwt.sign({sub:'socket_fixture',purpose:'socket'},process.env.JWT_SECRET,{issuer:'fugluck:test',audience:'fugluck:test:socket',expiresIn:-1})
    check('expired socket ticket is rejected',tokens.verifySocketTicket(expired)===null)
    process.env.APP_ENV='staging'
    check('socket tickets cannot cross deployment environments',tokens.verifySocketTicket(token)===null)
    process.env.APP_ENV='test'
    for(const transport of ['polling','websocket'] as const){
      const result=await identity({socketTicket:token},transport)
      check(`${transport} authenticates HTTP account without a socket cookie`,result.userId==='socket_fixture'&&result.isGuest===false)
      const invalid=await identity({socketTicket:'invalid'},transport,cookie)
      check(`${transport} rejects invalid explicit proof without downgrading to guest`,invalid.error==='unauthorized')
    }
    const existing=await identity({},'polling',cookie)
    check('existing cookie-only socket authentication is preserved',existing.userId==='socket_fixture'&&existing.isGuest===false)
    const guest=await identity({},'websocket')
    check('ordinary unauthenticated guest play is preserved',guest.userId.startsWith('guest_')&&guest.isGuest===true)
    accountStatus='banned'
    const bannedHttp=await fetch(`${url}/api/auth/socket-ticket`,{method:'POST',headers:{Cookie:cookie}})
    check('banned account cannot obtain a socket ticket',bannedHttp.status===403)
    const bannedSocket=await identity({socketTicket:token},'websocket')
    check('account status is rechecked when the ticket is used',bannedSocket.error==='account_suspended')
  }finally{
    db.query.users.findFirst=originalFind
    await new Promise<void>(resolve=>io.close(()=>resolve()));await pool.end()
  }
  console.log(`Competition socket session: ${passes} PASS, ${failures} FAIL`)
  if(failures)process.exitCode=1
}
void main().catch(error=>{console.error(error.message);process.exitCode=1})

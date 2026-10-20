import {DurableObject} from 'cloudflare:workers';
import {identity,joinMode,LobbyFault,LOBBY_PROTOCOL,MAX_MESSAGE_BYTES,playerName,record,RECONNECT_GRACE_MS,ROOM_CAPACITY,roomCode,type JoinMode,type LobbyEvent} from '../../src/lobby/protocol';
import type {LobbyIdentity,LobbySnapshot} from '../../src/lobby/types';

export interface Env {
 ROOMS:DurableObjectNamespace<LobbyRoom>;
 JOIN_LIMIT:RateLimit;
 ALLOWED_ORIGINS:string;
}
interface Member {
 id:string;deviceId:string;keyHash:string;playerId:string;ready:boolean;
 sessionId:string;transport:'ws'|'http';expiresAt?:number;tokenHash?:string;
}
interface Room {code:string;members:Member[]}
interface Attachment {sessionId:string;code:string;memberId?:string;deadline?:number;window:number;count:number}
const json=(value:unknown,status=200,headers:HeadersInit={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
const size=(text:string)=>new TextEncoder().encode(text).byteLength;
const errorResponse=(error:unknown)=>json({error:error instanceof LobbyFault?error.message:'大厅服务暂时不可用'},error instanceof LobbyFault?error.status:500);
async function body(request:Request) {
 if(Number(request.headers.get('content-length')??0)>MAX_MESSAGE_BYTES) throw new LobbyFault(413,'请求内容过大');
 const reader=request.body?.getReader();if(!reader) throw new LobbyFault(400,'请求格式无效');
 const chunks:Uint8Array[]=[];let bytes=0;
 for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_MESSAGE_BYTES){await reader.cancel();throw new LobbyFault(413,'请求内容过大');}chunks.push(value);}
 const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
 try{return record(JSON.parse(new TextDecoder().decode(buffer)));}catch(e){if(e instanceof LobbyFault)throw e;throw new LobbyFault(400,'请求格式无效');}
}
function cors(origin:string|null):Record<string,string> {return origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}:{};}

/** Stateless public ingress. Each four-digit code maps to exactly one isolated room. */
export default {
 async fetch(request:Request,env:Env):Promise<Response> {
  const origin=request.headers.get('Origin'),url=new URL(request.url),health=url.pathname==='/api/lobby/health';
  try {
   const allowed=env.ALLOWED_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean);
   if(origin?!allowed.includes(origin):!health) throw new LobbyFault(403,'当前网页未被大厅服务授权');
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
   if(health&&request.method==='GET')return json({ok:true,service:'velocity-water-city-lobby',transport:'websocket',protocol:LOBBY_PROTOCOL,capacity:ROOM_CAPACITY},200,cors(origin));
   const socket=url.pathname.match(/^\/api\/lobby\/rooms\/(\d{4})\/socket$/);
   let code:string;
   if(socket) {
    if(request.method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')throw new LobbyFault(426,'请使用 WebSocket 连接大厅');
    code=socket[1];
   } else if(url.pathname==='/api/lobby/join'&&request.method==='POST') {
    const b=await body(request);code=roomCode(b.code);identity(b);joinMode(b.mode);
    request=new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(b)});
   } else {
    if(!/^\/api\/lobby\/(state|ready|rename|leave|start)$/.test(url.pathname))throw new LobbyFault(404,'大厅操作不存在');
    const token=request.headers.get('Authorization')?.match(/^Bearer (\d{4}\.[a-f0-9]{48})$/)?.[1];
    if(!token)throw new LobbyFault(401,'房间连接已失效，请重新进入');
    code=token.slice(0,4);
   }
   if(socket||url.pathname==='/api/lobby/join') {
    const key=request.headers.get('CF-Connecting-IP')??'local';
    if(!(await env.JOIN_LIMIT.limit({key})).success)throw new LobbyFault(429,'连接较频繁，请稍后再试');
   }
   const headers=new Headers(request.headers);headers.set('X-Lobby-Code',code);
   const response=await env.ROOMS.getByName(code).fetch(new Request(request,{headers}));
   if(response.status===101)return response;
   const outgoing=new Response(response.body,response);for(const[k,v]of Object.entries(cors(origin)))outgoing.headers.set(k,v);return outgoing;
  } catch(error) {
   const response=errorResponse(error);if(origin&&env.ALLOWED_ORIGINS.split(',').map(s=>s.trim()).includes(origin))for(const[k,v]of Object.entries(cors(origin)))response.headers.set(k,v);return response;
  }
 }
} satisfies ExportedHandler<Env>;

/** SQLite-backed storage survives eviction. Only idle disconnects need an alarm. */
export class LobbyRoom extends DurableObject<Env> {
 private room?:Room;
 constructor(ctx:DurableObjectState,env:Env) {
  super(ctx,env);
  ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  ctx.blockConcurrencyWhile(async()=>{this.room=await ctx.storage.get<Room>('room');});
 }
 private attachment(ws:WebSocket) {return ws.deserializeAttachment() as Attachment;}
 private sockets() {return this.ctx.getWebSockets();}
 private snapshot():LobbySnapshot {
  const members=this.room?.members??[];
  return {code:this.room?.code??'',capacity:ROOM_CAPACITY,members:members.map((m,i)=>({id:m.id,playerId:m.playerId,ready:m.ready,host:i===0,connected:m.transport==='http'||m.expiresAt===undefined}))};
 }
 private send(ws:WebSocket,value:LobbyEvent) {try{ws.send(JSON.stringify(value));}catch{/* Close/error handler records disconnection. */}}
 private broadcast(exclude?:WebSocket) {
  const room=this.snapshot();
  for(const ws of this.sockets()) {
   if(ws===exclude)continue;
   const a=this.attachment(ws);if(!this.room?.members.some(m=>m.id===a.memberId&&m.sessionId===a.sessionId))continue;
   this.send(ws,{v:1,type:'room',room});
  }
 }
 private async persist() {
  if(this.room?.members.length)await this.ctx.storage.put('room',this.room);
  else {this.room=undefined;await this.ctx.storage.deleteAll();}
  await this.schedule();
 }
 private async schedule() {
  const times=(this.room?.members??[]).flatMap(m=>m.expiresAt===undefined?[]:[m.expiresAt]);
  for(const ws of this.sockets()){const a=this.attachment(ws);if(!a.memberId&&a.deadline)times.push(a.deadline);}
  const current=await this.ctx.storage.getAlarm();
  if(times.length){const next=Math.min(...times);if(current!==next)await this.ctx.storage.setAlarm(next);}
  else if(current!==null)await this.ctx.storage.deleteAlarm();
 }
 private async prune() {
  const now=Date.now();let changed=false;
  if(this.room){const before=this.room.members.length;this.room.members=this.room.members.filter(m=>m.expiresAt===undefined||m.expiresAt>now);changed=before!==this.room.members.length;}
  for(const ws of this.sockets()){const a=this.attachment(ws);if(!a.memberId&&a.deadline&&a.deadline<=now){a.deadline=undefined;ws.serializeAttachment(a);ws.close(4008,'登录超时');}}
  if(changed){await this.persist();this.broadcast();}else await this.schedule();
 }
 async alarm() {await this.ctx.blockConcurrencyWhile(()=>this.prune());}
 private async join(code:string,who:LobbyIdentity,mode:JoinMode,sessionId:string,transport:'ws'|'http',token?:string) {
  const keyHash=await hash(who.resumeKey);let member=this.room?.members.find(m=>m.deviceId===who.deviceId);
  if(member&&member.keyHash!==keyHash)throw new LobbyFault(403,'设备验证失败');
  if(mode==='join'&&!this.room?.members.length)throw new LobbyFault(404,'房间不存在，请先创建房间或使用相同号码自动加入');
  if(mode==='create'&&this.room?.members.length&&!member)throw new LobbyFault(409,'该房间号已被使用');
  if(!member&&(this.room?.members.length??0)>=ROOM_CAPACITY)throw new LobbyFault(409,'这个房间已满，请换一个房间号');
  if(!this.room)this.room={code,members:[]};
  if(member){for(const ws of this.sockets()){const a=this.attachment(ws);if(a.memberId===member.id&&a.sessionId===member.sessionId)ws.close(4009,'此档案已在另一个页面进入大厅');}}
  else {member={id:random().slice(0,24),deviceId:who.deviceId,keyHash,playerId:who.playerId,ready:false,sessionId,transport};this.room.members.push(member);}
  member.playerId=who.playerId;member.sessionId=sessionId;member.transport=transport;member.expiresAt=transport==='http'?Date.now()+RECONNECT_GRACE_MS:undefined;member.tokenHash=token?await hash(token):undefined;
  return member;
 }
 private member(ws:WebSocket) {
  const a=this.attachment(ws),member=this.room?.members.find(m=>m.id===a.memberId&&m.sessionId===a.sessionId);
  if(!member)throw new LobbyFault(401,'房间连接已失效，请重新进入');return member;
 }
 private command(member:Member,type:string,b:Record<string,unknown>) {
  if(type==='ready'){if(typeof b.ready!=='boolean')throw new LobbyFault(400,'准备状态无效');member.ready=b.ready;}
  else if(type==='rename')member.playerId=playerName(b.playerId);
  else if(type==='leave')this.room!.members=this.room!.members.filter(m=>m.id!==member.id);
  else if(type==='start') {
   if(this.room?.members[0]?.id!==member.id)throw new LobbyFault(403,'只有房主可以发起比赛');
   throw new LobbyFault(501,'当前为大厅阶段，联机竞速尚未开放');
  } else if(type!=='state')throw new LobbyFault(400,'未知大厅操作');
 }
 async fetch(request:Request):Promise<Response> {
  return this.ctx.blockConcurrencyWhile(async()=>{
   try {
    const code=roomCode(request.headers.get('X-Lobby-Code')),url=new URL(request.url);await this.prune();
    if(this.room&&this.room.code!==code)throw new LobbyFault(403,'房间验证失败');
    if(url.pathname.endsWith('/socket')) {
     if(this.sockets().length>=ROOM_CAPACITY*2)throw new LobbyFault(429,'房间连接较多，请稍后再试');
     const pair=new WebSocketPair(),server=pair[1];
     this.ctx.acceptWebSocket(server);server.serializeAttachment({sessionId:random(),code,deadline:Date.now()+10_000,window:Date.now(),count:0} satisfies Attachment);
     await this.schedule();return new Response(null,{status:101,webSocket:pair[0]});
    }
    if(url.pathname==='/api/lobby/join'&&request.method==='POST') {
     const b=await body(request),token=code+'.'+random(),member=await this.join(code,identity(b),joinMode(b.mode),random(),'http',token);
     await this.persist();this.broadcast();return json({token,memberId:member.id,room:this.snapshot()});
    }
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,''),tokenHash=token?await hash(token):'',member=this.room?.members.find(m=>m.tokenHash===tokenHash);
    if(!member)throw new LobbyFault(401,'房间连接已失效，请重新进入');
    const type=url.pathname.split('/').at(-1)!;
    if((type==='state'&&request.method!=='GET')||(type!=='state'&&request.method!=='POST'))throw new LobbyFault(405,'请求方式无效');
    const b=type==='state'?{}:await body(request);this.command(member,type,b);
    // Legacy HTTP remains available for rollback. New clients never poll it.
    const renew=member.expiresAt!==undefined&&member.expiresAt<Date.now()+20_000;
    if(renew)member.expiresAt=Date.now()+RECONNECT_GRACE_MS;
    if(type!=='state'||renew)await this.persist();
    if(type!=='state')this.broadcast();return json(type==='leave'?{ok:true}:{room:this.snapshot()});
   } catch(e){return errorResponse(e);}
  });
 }
 async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer) {
  await this.ctx.blockConcurrencyWhile(async()=>{
   let id:string|undefined;
   try {
    if(typeof message!=='string'){ws.close(1003,'请使用 JSON 文本');return;}
    if(size(message)>MAX_MESSAGE_BYTES){ws.close(1009,'消息过大');return;}
    const a=this.attachment(ws),now=Date.now();if(now-a.window>=60_000){a.window=now;a.count=0;}
    a.count++;ws.serializeAttachment(a);if(a.count>40){
     try{const ref=JSON.parse(message)?.id;if(typeof ref==='string'&&/^[\w-]{1,48}$/.test(ref))id=ref;}catch{/* Malformed frames count against the same budget. */}
     this.send(ws,{v:1,type:'error',id,code:429,message:'操作较频繁，请稍后再试'});ws.close(4029,'操作较频繁');return;
    }
    let b:Record<string,unknown>;try{b=record(JSON.parse(message));}catch{throw new LobbyFault(400,'请求格式无效');}
    if(typeof b.id==='string'&&/^[\w-]{1,48}$/.test(b.id))id=b.id;else throw new LobbyFault(400,'请求编号无效');
    if(b.v!==LOBBY_PROTOCOL||typeof b.type!=='string')throw new LobbyFault(400,'大厅协议版本无效');
    await this.prune();
    if(b.type==='join') {
     if(a.memberId)throw new LobbyFault(409,'当前连接已加入房间');
     if(!a.deadline||a.deadline<=now)throw new LobbyFault(401,'连接已过期，请重新进入');
     const code=roomCode(a.code),member=await this.join(code,identity(b.identity),joinMode(b.mode),a.sessionId,'ws');
     a.memberId=member.id;a.deadline=undefined;ws.serializeAttachment(a);await this.persist();
     this.send(ws,{v:1,type:'welcome',id,memberId:member.id,room:this.snapshot()});this.broadcast(ws);return;
    }
    const member=this.member(ws);this.command(member,b.type,b);
    if(b.type==='state'){this.send(ws,{v:1,type:'room',room:this.snapshot()});this.send(ws,{v:1,type:'ack',id});return;}
    await this.persist();this.send(ws,{v:1,type:'ack',id});this.broadcast();if(b.type==='leave')ws.close(1000,'已离开房间');
   } catch(e) {
    this.send(ws,{v:1,type:'error',id,code:e instanceof LobbyFault?e.status:500,message:e instanceof LobbyFault?e.message:'大厅服务暂时不可用'});
    if(!this.attachment(ws).memberId)ws.close(4003,'无法加入房间');
   }
  });
 }
 private async disconnect(ws:WebSocket) {
  const a=this.attachment(ws),member=this.room?.members.find(m=>m.id===a.memberId&&m.sessionId===a.sessionId);
  if(member&&member.expiresAt===undefined){member.expiresAt=Date.now()+RECONNECT_GRACE_MS;await this.persist();this.broadcast();}
  else await this.schedule();
 }
 async webSocketClose(ws:WebSocket,code:number,reason:string,wasClean:boolean) {await this.ctx.blockConcurrencyWhile(()=>this.disconnect(ws));try{ws.close(code===1006?1000:code,'连接已关闭');}catch{/* Already closed. */}}
 async webSocketError(ws:WebSocket,error:unknown) {await this.ctx.blockConcurrencyWhile(()=>this.disconnect(ws));try{ws.close(1011,'连接中断');}catch{/* Already closed. */}}
}

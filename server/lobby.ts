import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {randomBytes, createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocket, WebSocketServer} from 'ws';
import {identity, joinMode, playerName, record, roomCode, LobbyFault, LOBBY_PROTOCOL, MAX_MESSAGE_BYTES, RECONNECT_GRACE_MS} from '../src/lobby/protocol';
import type {LobbyIdentity, LobbySnapshot} from '../src/lobby/types';

interface Member {
 id:string; deviceId:string; keyHash:string; playerId:string; ready:boolean;
 token:string; seen:number; socket?:WebSocket; transport:'http'|'websocket';
}
interface Room {code:string; members:Map<string,Member>}
interface Options {ttlMs?:number; capacity?:number; allowedOrigins?:string[]; now?:()=>number; publicDir?:string}
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');

/** Shared in-memory rooms for the original HTTP API and protocol-v1 WebSockets. */
export function createLobbyServer(options:Options={}) {
 const rooms=new Map<string,Room>();
 const tokens=new Map<string,{room:Room;member:Member}>();
 const replaced=new Map<string,number>();
 const rates=new Map<string,{count:number;until:number}>();
 const now=options.now??Date.now, ttl=options.ttlMs??RECONNECT_GRACE_MS, capacity=options.capacity??5;
 const instance=randomBytes(8).toString('hex');
 const wss=new WebSocketServer({noServer:true,maxPayload:MAX_MESSAGE_BYTES,perMessageDeflate:false});
 let closing=false;
 const snapshot=(room:Room):LobbySnapshot=>({code:room.code,capacity,members:[...room.members.values()].map((m,i)=>({
  id:m.id,playerId:m.playerId,ready:m.ready,host:i===0,
  connected:m.transport==='http'||m.socket?.readyState===WebSocket.OPEN,
 }))});
 const emit=(ws:WebSocket,value:unknown)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({v:LOBBY_PROTOCOL,...value as object}));};
 const broadcast=(room:Room)=>{const data={type:'room',room:snapshot(room)};for(const m of room.members.values())if(m.socket)emit(m.socket,data);};
 const remove=(room:Room,m:Member)=>{
  if(room.members.get(m.deviceId)!==m)return;
  room.members.delete(m.deviceId);tokens.delete(m.token);
  if(!room.members.size)rooms.delete(room.code);
  broadcast(room);
 };
 const prune=()=>{
  for(const room of rooms.values())for(const m of room.members.values()) {
   // Active sockets are kept by application ping. Broken links retain their seat briefly.
   if(m.socket&&now()-m.seen>150_000){m.socket.terminate();m.socket=undefined;m.seen=now();broadcast(room);}
   if(!m.socket&&now()-m.seen>ttl)remove(room,m);
  }
  for(const [k,r]of rates)if(r.until<now())rates.delete(k);
  for(const [k,until]of replaced)if(until<now())replaced.delete(k);
 };
 const timer=setInterval(prune,Math.min(ttl,5000));timer.unref();
 const originAllowed=(req:IncomingMessage)=>{
  const origin=req.headers.origin;if(!origin)return true;
  if(options.allowedOrigins?.includes(origin))return true;
  try{const u=new URL(origin);return ['http:','https:'].includes(u.protocol)&&u.origin===origin&&u.host===req.headers.host;}catch{return false;}
 };
 const send=(res:ServerResponse,status:number,value:unknown)=>{
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));
 };
 const body=async(req:IncomingMessage)=>{
  let bytes=0;const chunks:Buffer[]=[];
  for await(const c of req){bytes+=c.length;if(bytes>MAX_MESSAGE_BYTES)throw new LobbyFault(413,'请求内容过大');chunks.push(c);}
  try{return record(JSON.parse(Buffer.concat(chunks).toString()));}catch(e){if(e instanceof LobbyFault)throw e;throw new LobbyFault(400,'请求格式无效');}
 };
 const enter=(code:string,who:LobbyIdentity,mode:ReturnType<typeof joinMode>,socket?:WebSocket)=>{
  prune();let room=rooms.get(code);
  if(!room&&mode==='join')throw new LobbyFault(404,'房间不存在或服务器已重启，请重新创建房间');
  if(room&&mode==='create')throw new LobbyFault(409,'房间号已被使用');
  if(!room){if(rooms.size>=1000)throw new LobbyFault(503,'大厅暂时繁忙，请稍后再试');room={code,members:new Map()};}
  let member=room.members.get(who.deviceId);
  if(member&&member.keyHash!==digest(who.resumeKey))throw new LobbyFault(403,'设备验证失败');
  if(!member&&room.members.size>=capacity)throw new LobbyFault(409,'这个房间已满，请换一个房间号');
  if(member){
   tokens.delete(member.token);replaced.set(member.token,now()+ttl);
   const previous=member.socket;member.socket=undefined;previous?.close(4009,'session replaced');
  }
  member={id:member?.id??randomBytes(12).toString('hex'),deviceId:who.deviceId,keyHash:digest(who.resumeKey),playerId:who.playerId,
   ready:member?.ready??false,token:randomBytes(24).toString('hex'),seen:now(),socket,transport:socket?'websocket':'http'};
  room.members.set(who.deviceId,member);rooms.set(code,room);tokens.set(member.token,{room,member});
  return {room,member};
 };
 const server=createServer(async(req,res)=>{
  try {
   if(!originAllowed(req))throw new LobbyFault(403,'当前网页未被大厅服务授权');
   if(req.headers.origin){res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
   prune();const path=new URL(req.url??'/','http://lobby.local').pathname;
   if(path==='/api/lobby/health'&&req.method==='GET'){
    send(res,200,{ok:true,service:'velocity-water-city-lobby',transport:'websocket',protocol:1,capacity,rooms:rooms.size,instance,
     revision:process.env.RENDER_GIT_COMMIT??null,storage:'memory',reconnectGraceMs:ttl});return;
   }
   const files:Record<string,[string,string]>={'/':['index.html','text/html; charset=utf-8'],'/test':['index.html','text/html; charset=utf-8'],'/test.js':['test.js','text/javascript; charset=utf-8']};
   if(files[path]&&req.method==='GET'&&options.publicDir){
    const [file,type]=files[path];let data:Buffer;try{data=await readFile(join(options.publicDir,file));}catch{throw new LobbyFault(404,'测试页面尚未构建');}
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
     'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(data);return;
   }
   // Token/device budgets work behind Render's shared proxy without trusting spoofable forwarding headers.
   const b=req.method==='POST'?await body(req):undefined;
   const token=req.headers.authorization?.replace(/^Bearer /,'');
   const rateKey=digest(token??(typeof b?.deviceId==='string'?b.deviceId.slice(0,64):(req.socket.remoteAddress??'unknown')));
   const key=rateKey+':'+(req.method==='GET'?'read':'write');
   const rate=rates.get(key)??{count:0,until:now()+60_000};
   if(rate.until<now()){rate.count=0;rate.until=now()+60_000;}
   if(++rate.count>(req.method==='GET'?600:120))throw new LobbyFault(429,'操作较频繁，请稍后再试');rates.set(key,rate);
   if(rates.size>20_000)throw new LobbyFault(503,'大厅暂时繁忙');
   if(path==='/api/lobby/join'&&req.method==='POST'){
    const {room,member}=enter(roomCode(b!.code),identity(b),joinMode(b!.mode));
    send(res,200,{token:member.token,memberId:member.id,room:snapshot(room)});broadcast(room);return;
   }
   const session=token?tokens.get(token):undefined;
   if(!session){if(token&&replaced.has(token))throw new LobbyFault(409,'此档案已在另一个页面进入大厅，请关闭重复页面');throw new LobbyFault(401,'房间连接已失效，请重新进入');}
   const {room,member}=session;member.seen=now();
   if(path==='/api/lobby/state'&&req.method==='GET'){send(res,200,{room:snapshot(room)});return;}
   if(path==='/api/lobby/ready'&&req.method==='POST'){
    if(typeof b!.ready!=='boolean')throw new LobbyFault(400,'准备状态无效');member.ready=b!.ready;
   }else if(path==='/api/lobby/rename'&&req.method==='POST')member.playerId=playerName(b!.playerId);
   else if(path==='/api/lobby/leave'&&req.method==='POST'){const ws=member.socket;member.socket=undefined;remove(room,member);ws?.close(1000,'leave');send(res,200,{ok:true});return;}
   else throw new LobbyFault(404,'大厅操作不存在');
   broadcast(room);send(res,200,{room:snapshot(room)});
  }catch(e){if(!res.headersSent)send(res,e instanceof LobbyFault?e.status:500,{error:e instanceof LobbyFault?e.message:'大厅服务暂时不可用'});else res.end();}
 });
 server.on('upgrade',(req,socket,head)=>{
  const path=new URL(req.url??'/','http://lobby.local').pathname;
  const match=/^\/api\/lobby\/rooms\/(\d{4})\/socket$/.exec(path);
  if(closing||!originAllowed(req)||!match||wss.clients.size>=5000){
   const status=!originAllowed(req)?403:!match?404:503;socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);return;
  }
  const code=match[1];let pendingCount=0;
  for(const client of wss.clients)if(client.readyState===WebSocket.OPEN&&connectionRooms.get(client)===code)pendingCount++;
  if(pendingCount>=10){socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');return;}
  wss.handleUpgrade(req,socket,head,ws=>{
   connectionRooms.set(ws,code);wss.emit('connection',ws,code);
  });
 });
 const connectionRooms=new Map<WebSocket,string>();
 wss.on('connection',(ws:WebSocket,code:string)=>{
  let session:{room:Room;member:Member}|undefined,windowStart=now(),count=0;
  const login=setTimeout(()=>ws.close(4008,'join timeout'),10_000);login.unref();
  ws.on('error',()=>{/* ws emits an error for oversized frames; close handler releases the seat. */});
  ws.on('message',(raw,binary)=>{
   let id:string|undefined;
   try{
    if(binary){ws.close(1003,'text only');return;}
    if(now()-windowStart>=60_000){count=0;windowStart=now();}
    if(++count>40){emit(ws,{type:'error',code:429,message:'操作较频繁，请稍后重新进入'});ws.close(4029,'rate limit');return;}
    const text=raw.toString();
    if(text==='ping'){if(session){session.member.seen=now();ws.send('pong');return;}throw new LobbyFault(401,'请先加入房间');}
    let data:Record<string,unknown>;try{data=record(JSON.parse(text));}catch{throw new LobbyFault(400,'请求格式无效');}
    if(typeof data.id==='string'&&/^[\w-]{1,80}$/.test(data.id))id=data.id;
    if(data.v!==LOBBY_PROTOCOL||!id)throw new LobbyFault(400,'通信协议或请求编号无效');
    if(data.type==='join'){
     if(session)throw new LobbyFault(409,'已经进入房间');
     session=enter(code,identity(data.identity),joinMode(data.mode),ws);clearTimeout(login);
     emit(ws,{type:'welcome',id,memberId:session.member.id,room:snapshot(session.room)});broadcast(session.room);return;
    }
    if(!session||session.member.socket!==ws||session.room.members.get(session.member.deviceId)!==session.member)throw new LobbyFault(401,'房间连接已失效');
    const {room,member}=session;member.seen=now();
    if(data.type==='ready'){if(typeof data.ready!=='boolean')throw new LobbyFault(400,'准备状态无效');member.ready=data.ready;}
    else if(data.type==='rename')member.playerId=playerName(data.playerId);
    else if(data.type==='state'){emit(ws,{type:'room',room:snapshot(room)});emit(ws,{type:'ack',id});return;}
    else if(data.type==='leave'){member.socket=undefined;remove(room,member);session=undefined;emit(ws,{type:'ack',id});ws.close(1000,'leave');return;}
    else if(data.type==='start'){
     if(room.members.values().next().value!==member)throw new LobbyFault(403,'只有房主可以操作');
     throw new LobbyFault(501,'当前为大厅阶段，联机竞速尚未开放');
    }else throw new LobbyFault(400,'大厅操作不存在');
    broadcast(room);emit(ws,{type:'ack',id});
   }catch(e){
    emit(ws,{type:'error',...(id?{id}:{}),code:e instanceof LobbyFault?e.status:500,message:e instanceof LobbyFault?e.message:'大厅服务暂时不可用'});
    if(!session)ws.close(4003,'join rejected');
   }
  });
  ws.on('close',()=>{
   clearTimeout(login);connectionRooms.delete(ws);
   if(session&&session.member.socket===ws){session.member.socket=undefined;session.member.seen=now();broadcast(session.room);}
  });
 });
 // HTTP close alone does not close upgraded sockets. Bound shutdown and test teardown.
 const closeHttp=server.close.bind(server);
 server.close=(callback?:Parameters<typeof server.close>[0])=>{
  closing=true;clearInterval(timer);
  for(const ws of wss.clients){ws.close(1012,'server restart');const deadline=setTimeout(()=>ws.terminate(),1000);deadline.unref();}
  return closeHttp(callback);
 };
 server.on('close',()=>{clearInterval(timer);wss.close();});
 return server;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const port=Number(process.env.PORT??process.env.LOBBY_PORT??8787);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT 必须是 1–65535 的整数');
 const server=createLobbyServer({allowedOrigins:process.env.LOBBY_ALLOWED_ORIGINS?.split(',').map(s=>s.trim()).filter(Boolean),publicDir:join(dirname(fileURLToPath(import.meta.url)),'public')});
 server.listen(port,'0.0.0.0',()=>console.log(`Room lobby listening on 0.0.0.0:${port}`));
 const stop=()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();};
 process.once('SIGTERM',stop);process.once('SIGINT',stop);
}

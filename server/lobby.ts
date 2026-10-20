import{createServer,type IncomingMessage,type ServerResponse}from'node:http';
import{randomBytes,createHash}from'node:crypto';
import{resolve}from'node:path';import{fileURLToPath}from'node:url';
import type{LobbySnapshot}from'../src/lobby/types';
interface Member {id:string;deviceId:string;keyHash:string;playerId:string;ready:boolean;token:string;seen:number}
interface Room {code:string;members:Map<string,Member>}
interface Options {ttlMs?:number;capacity?:number;allowedOrigins?:string[];now?:()=>number}
class ApiError extends Error{constructor(readonly status:number,message:string){super(message);}}
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export function createLobbyServer(options:Options={}){
 const rooms=new Map<string,Room>(),tokens=new Map<string,{room:Room;member:Member}>(),replaced=new Map<string,number>(),rates=new Map<string,{count:number;until:number}>(),now=options.now??Date.now,ttl=options.ttlMs??30000,capacity=options.capacity??5;
 const prune=()=>{for(const[code,room]of rooms){for(const[id,m]of room.members)if(now()-m.seen>ttl){room.members.delete(id);tokens.delete(m.token);}if(!room.members.size)rooms.delete(code);}for(const[k,r]of rates)if(r.until<now())rates.delete(k);for(const[k,until]of replaced)if(until<now())replaced.delete(k);};
 const timer=setInterval(prune,Math.min(ttl,5000));timer.unref();
 const snapshot=(room:Room):LobbySnapshot=>({code:room.code,capacity,members:[...room.members.values()].map((m,i)=>({id:m.id,playerId:m.playerId,ready:m.ready,host:i===0}))});
 const send=(res:ServerResponse,status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const body=async(req:IncomingMessage)=>{let bytes=0;const chunks:Buffer[]=[];for await(const c of req){bytes+=c.length;if(bytes>2048)throw new ApiError(413,'请求内容过大');chunks.push(c);}try{const b=JSON.parse(Buffer.concat(chunks).toString());if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b as Record<string,unknown>;}catch{throw new ApiError(400,'请求格式无效');}};
 const name=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||[...v.trim()].length>16||/[\p{C}<>]/u.test(v))throw new ApiError(400,'游戏 ID 请输入 1–16 个普通字符');return v.trim();};
 const server=createServer(async(req,res)=>{
  try{
   const origin=req.headers.origin;
   if(origin){let sameHost=false;try{sameHost=new URL(origin).hostname===new URL('http://'+req.headers.host).hostname;}catch{/* invalid origin */}
    if(!sameHost&&!options.allowedOrigins?.includes(origin))throw new ApiError(403,'当前网页未被大厅服务授权');res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
   prune();const path=new URL(req.url??'/', 'http://lobby.local').pathname;
   if(path==='/api/lobby/health'&&req.method==='GET'){send(res,200,{ok:true,rooms:rooms.size});return;}
   const key=(req.socket.remoteAddress??'unknown')+':'+(req.method==='GET'?'read':'write'),rate=rates.get(key)??{count:0,until:now()+60000};if(++rate.count>(req.method==='GET'?600:120))throw new ApiError(429,'操作较频繁，请稍后再试');rates.set(key,rate);
   if(path==='/api/lobby/join'&&req.method==='POST'){
    const b=await body(req),code=b.code,deviceId=b.deviceId,resumeKey=b.resumeKey,playerId=name(b.playerId);
    if(typeof code!=='string'||!/^\d{4}$/.test(code))throw new ApiError(400,'房间号必须是四位数字');
    if(typeof deviceId!=='string'||!/^[a-f0-9]{32}$/.test(deviceId)||typeof resumeKey!=='string'||!/^[a-f0-9]{32}$/.test(resumeKey))throw new ApiError(400,'设备档案无效，请刷新后重试');
    let room=rooms.get(code);if(!room){if(rooms.size>=1000)throw new ApiError(503,'大厅暂时繁忙，请稍后再试');room={code,members:new Map()};}
    let member=room.members.get(deviceId);
    if(member&&member.keyHash!==digest(resumeKey))throw new ApiError(403,'设备验证失败');
    if(!member&&room.members.size>=capacity)throw new ApiError(409,'这个房间已满，请换一个房间号');
    const token=randomBytes(24).toString('hex');if(member){tokens.delete(member.token);replaced.set(member.token,now()+ttl);}
    member={id:member?.id??randomBytes(12).toString('hex'),deviceId,keyHash:digest(resumeKey),playerId,ready:member?.ready??false,token,seen:now()};room.members.set(deviceId,member);rooms.set(code,room);tokens.set(token,{room,member});send(res,200,{token,memberId:member.id,room:snapshot(room)});return;
   }
   const token=req.headers.authorization?.replace(/^Bearer /,''),session=token?tokens.get(token):undefined;
   if(!session){if(token&&replaced.has(token))throw new ApiError(409,'此档案已在另一个页面进入大厅，请关闭重复页面');throw new ApiError(401,'房间连接已失效，请重新进入');}const{room,member}=session;member.seen=now();
   if(path==='/api/lobby/state'&&req.method==='GET'){send(res,200,{room:snapshot(room)});return;}
   if(path==='/api/lobby/ready'&&req.method==='POST'){const b=await body(req);if(typeof b.ready!=='boolean')throw new ApiError(400,'准备状态无效');member.ready=b.ready;send(res,200,{room:snapshot(room)});return;}
   if(path==='/api/lobby/rename'&&req.method==='POST'){const b=await body(req);member.playerId=name(b.playerId);send(res,200,{room:snapshot(room)});return;}
   if(path==='/api/lobby/leave'&&req.method==='POST'){room.members.delete(member.deviceId);tokens.delete(member.token);if(!room.members.size)rooms.delete(room.code);send(res,200,{ok:true});return;}
   throw new ApiError(404,'大厅操作不存在');
  }catch(e){if(!res.headersSent)send(res,e instanceof ApiError?e.status:500,{error:e instanceof ApiError?e.message:'大厅服务暂时不可用'});else res.end();}
 });
 server.on('close',()=>clearInterval(timer));return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.LOBBY_PORT??8787),server=createLobbyServer({allowedOrigins:process.env.LOBBY_ALLOWED_ORIGINS?.split(',').map(s=>s.trim()).filter(Boolean)});
 server.listen(port,'0.0.0.0',()=>console.log(`Room lobby listening on ${port}`));
}

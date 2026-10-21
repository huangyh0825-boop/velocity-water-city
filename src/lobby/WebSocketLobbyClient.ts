import {isLobbySnapshot,LobbyFault,LOBBY_PROTOCOL,MAX_MESSAGE_BYTES,roomCode,type LobbyCommand,type LobbyEvent} from './protocol';
import type {LobbyConnection,LobbyIdentity} from './types';

type Pending={resolve:()=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>};
/** No simulation state, assets, or 3D imports. Only room events cross this socket. */
export class WebSocketLobbyClient {
 private socket?:WebSocket;private code='';private who?:LobbyIdentity;private memberId='';
 private active=false;private connected=false;private generation=0;private sequence=0;private failures=0;
 private retry?:ReturnType<typeof setTimeout>;private heartbeat?:ReturnType<typeof setTimeout>;private pong?:ReturnType<typeof setTimeout>;
 private pending=new Map<string,Pending>();
 private offline=()=>{if(!this.active)return;this.connected=false;clearTimeout(this.heartbeat);clearTimeout(this.pong);this.rejectPending(Error('网络已断开'));this.problem('网络已断开，恢复网络后自动重连…');this.socket?.close(4000,'offline');};
 private online=()=>{if(this.active&&!this.connected){clearTimeout(this.retry);void this.reconnect();}};
 private visible=()=>{if(this.active&&this.connected&&document.visibilityState==='visible')this.ping();};
 constructor(private update:(value:LobbyConnection)=>void,private problem:(message:string,retrying?:boolean)=>void,private base:string) {}
 async join(code:string,who:LobbyIdentity) {
  this.code=roomCode(code);this.who={...who};this.active=true;
  window.addEventListener('offline',this.offline);window.addEventListener('online',this.online);document.addEventListener('visibilitychange',this.visible);
  try{await this.connect();}catch(e){await this.leave();throw e;}
 }
 private connect():Promise<void> {
  const gen=++this.generation,url=new URL(`${this.base}/rooms/${this.code}/socket`,location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
  const ws=new WebSocket(url);this.socket=ws;
  return new Promise((resolve,reject)=>{
   let welcomed=false;
   const timeout=setTimeout(()=>{reject(Error('大厅连接超时，请稍后重试'));ws.close(4000,'timeout');},8000);
   ws.onopen=()=>{if(gen!==this.generation||!this.active){ws.close();return;}ws.send(JSON.stringify({v:LOBBY_PROTOCOL,type:'join',id:this.id(),identity:this.who}));};
   ws.onmessage=event=>{
    if(gen!==this.generation||!this.active)return;
    if(event.data==='pong'){clearTimeout(this.pong);return;}
    if(typeof event.data!=='string'||event.data.length>16_384){ws.close(1009,'invalid server message');return;}
    let data:LobbyEvent;try{data=JSON.parse(event.data);}catch{ws.close(1002,'invalid JSON');return;}
    if(!data||typeof data!=='object'||data.v!==LOBBY_PROTOCOL){ws.close(1002,'invalid protocol');return;}
    if((data.type==='welcome'||data.type==='room')&&(!isLobbySnapshot(data.room)||data.room.code!==this.code)){ws.close(1002,'invalid room');return;}
    if(data.type==='welcome'&&(typeof data.memberId!=='string'||!data.room.members.some(m=>m.id===data.memberId))){ws.close(1002,'invalid member');return;}
    if(data.type==='welcome') {
     welcomed=true;clearTimeout(timeout);this.connected=true;this.failures=0;this.memberId=data.memberId;
     this.update({room:data.room,memberId:this.memberId,status:'connected'});this.scheduleHeartbeat();resolve();
    } else if(data.type==='room')this.update({room:data.room,memberId:this.memberId,status:'connected'});
    else if(data.type==='ack')this.complete(data.id);
    else if(data.type==='error') {
     if(typeof data.message!=='string'||typeof data.code!=='number'){ws.close(1002,'invalid error');return;}
     if(!welcomed){clearTimeout(timeout);reject(new LobbyFault(data.code,data.message));}
     if(data.id)this.complete(data.id,new LobbyFault(data.code,data.message));
    }
   };
   ws.onerror=()=>{if(!welcomed){clearTimeout(timeout);reject(Error('无法建立大厅连接，请稍后重试'));}};
   ws.onclose=event=>{
    clearTimeout(timeout);if(!welcomed)reject(Error('大厅连接已关闭，请重新进入'));
    if(gen!==this.generation)return;
    this.connected=false;clearTimeout(this.heartbeat);clearTimeout(this.pong);this.rejectPending(Error('大厅连接中断，请重试操作'));
    if(!this.active)return;
    if(event.code===4009||event.code===4003||event.code===4029){this.active=false;this.problem(event.code===4009?'此档案已在另一个页面进入大厅，请关闭重复页面':event.code===4029?'操作较频繁，请稍后重新进入':'无法重新加入房间，请再次进入',false);return;}
    this.problem('大厅连接中断，正在重连…');this.scheduleReconnect();
   };
  });
 }
 private id() {return `${Date.now().toString(36)}-${++this.sequence}`;}
 private complete(id:string,error?:Error) {const p=this.pending.get(id);if(!p)return;this.pending.delete(id);clearTimeout(p.timer);if(error)p.reject(error);else p.resolve();}
 private rejectPending(error:Error) {for(const id of this.pending.keys())this.complete(id,error);}
 private scheduleReconnect() {
  clearTimeout(this.retry);if(!this.active||!navigator.onLine)return;
  const delay=Math.min(30_000,1000*2**Math.min(5,this.failures++))+Math.random()*250;
  this.retry=setTimeout(()=>void this.reconnect(),delay);
 }
 private async reconnect() {
  if(!this.active||!navigator.onLine)return;
  try{await this.connect();}catch{if(this.active)this.scheduleReconnect();}
 }
 private scheduleHeartbeat() {
  clearTimeout(this.heartbeat);if(!this.active||!this.connected)return;
  // Once a minute, the runtime auto-replies without waking the Durable Object.
  this.heartbeat=setTimeout(()=>{this.ping();this.scheduleHeartbeat();},60_000);
 }
 private ping() {
  if(!this.connected||this.socket?.readyState!==WebSocket.OPEN)return;
  clearTimeout(this.pong);this.socket.send('ping');this.pong=setTimeout(()=>this.socket?.close(4000,'connection timeout'),8000);
 }
 private command(command:Omit<Extract<LobbyCommand,{type:'ready'}>,'v'|'id'>|Omit<Extract<LobbyCommand,{type:'rename'}>,'v'|'id'>|{type:'leave'}) {
  if(!this.connected||this.socket?.readyState!==WebSocket.OPEN)return Promise.reject(Error('大厅正在重连，请稍后重试'));
  const id=this.id(),text=JSON.stringify({v:LOBBY_PROTOCOL,...command,id});if(new TextEncoder().encode(text).byteLength>MAX_MESSAGE_BYTES)return Promise.reject(Error('消息过大'));
  return new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{this.complete(id,Error('大厅响应超时，正在重连…'));this.socket?.close(4000,'request timeout');},8000);this.pending.set(id,{resolve,reject,timer});this.socket!.send(text);});
 }
 async ready(value:boolean) {await this.command({type:'ready',ready:value});}
 async rename(value:string) {await this.command({type:'rename',playerId:value});if(this.who)this.who.playerId=value;}
 async leave() {
  const ws=this.socket;this.active=false;this.generation++;clearTimeout(this.retry);clearTimeout(this.heartbeat);clearTimeout(this.pong);
  window.removeEventListener('offline',this.offline);window.removeEventListener('online',this.online);document.removeEventListener('visibilitychange',this.visible);
  this.rejectPending(Error('已离开房间'));
  if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify({v:LOBBY_PROTOCOL,type:'leave',id:this.id()}));ws.close(1000,'leave');}
  else if(ws&&ws.readyState!==WebSocket.CLOSED)ws.close();
  this.connected=false;this.socket=undefined;
 }
}

import {HttpLobbyClient} from './HttpLobbyClient';
import {WebSocketLobbyClient} from './WebSocketLobbyClient';
import {roomCode} from './protocol';
import type {LobbyConnection,LobbyIdentity} from './types';

/** Keep the old Node API available; Cloudflare advertises its push transport. */
export class LobbyClient {
 private backend?:HttpLobbyClient|WebSocketLobbyClient;
 private generation=0;
 private base=(import.meta.env.VITE_LOBBY_URL?.trim()||'/api/lobby').replace(/\/$/,'');
 constructor(private update:(value:LobbyConnection)=>void,private problem:(message:string,retrying?:boolean)=>void) {}
 async join(code:string,identity:LobbyIdentity) {
  roomCode(code);const gen=++this.generation;
  if(location.protocol==='https:'&&new URL(this.base,location.href).protocol!=='https:')throw Error('大厅必须使用 HTTPS 安全地址');
  let health:Response;
  try{health=await fetch(this.base+'/health',{signal:AbortSignal.timeout(6000)});}catch{throw Error('无法连接大厅，请稍后重试');}
  const data=await health.json().catch(()=>({}));
  if(!health.ok)throw Error(data.error??'大厅服务暂时不可用');
  if(gen!==this.generation)return;
  await this.backend?.leave();if(gen!==this.generation)return;
  this.backend=data.transport==='websocket'
   ?new WebSocketLobbyClient(this.update,this.problem,this.base)
   :new HttpLobbyClient(this.update,this.problem,this.base);
  await this.backend.join(code,identity);
 }
 async ready(value:boolean) {if(!this.backend)throw Error('请先进入房间');await this.backend.ready(value);}
 async rename(value:string) {if(!this.backend)throw Error('请先进入房间');await this.backend.rename(value);}
 async leave() {this.generation++;const backend=this.backend;this.backend=undefined;await backend?.leave();}
}

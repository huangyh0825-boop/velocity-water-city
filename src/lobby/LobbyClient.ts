import {HttpLobbyClient} from './HttpLobbyClient';
import {WebSocketLobbyClient} from './WebSocketLobbyClient';
import {roomCode} from './protocol';
import {connectLobby} from './connectLobby';
import type {LobbyConnection,LobbyIdentity} from './types';

/** Transport discovery with bounded wake-up/retry, preserving the HTTP fallback. */
export class LobbyClient {
 private backend?:HttpLobbyClient|WebSocketLobbyClient;
 private generation=0;
 private cancel?:AbortController;
 private base=(import.meta.env.VITE_LOBBY_URL?.trim()||'/api/lobby').replace(/\/$/,'');
 constructor(private update:(value:LobbyConnection)=>void,private problem:(message:string,retrying?:boolean)=>void) {}
 async join(code:string,identity:LobbyIdentity) {
  roomCode(code);await this.leave();const gen=++this.generation;
  if(location.protocol==='https:'&&new URL(this.base,location.href).protocol!=='https:')throw Error('大厅必须使用 HTTPS 安全地址');
  const cancel=new AbortController();this.cancel=cancel;
  const update=(value:LobbyConnection)=>{if(gen===this.generation)this.update(value);};
  const problem=(message:string,retrying?:boolean)=>{if(gen===this.generation)this.problem(message,retrying);};
  try{
   await connectLobby({base:this.base,signal:cancel.signal,progress:message=>problem(message),connect:async transport=>{
    if(gen!==this.generation)throw new DOMException('已取消连接','AbortError');
    const backend=transport==='websocket'?new WebSocketLobbyClient(update,problem,this.base):new HttpLobbyClient(update,problem,this.base);
    this.backend=backend;
    try{await backend.join(code,identity);}catch(error){if(this.backend===backend)this.backend=undefined;await backend.leave();throw error;}
   }});
  }catch(error){if(gen===this.generation){const backend=this.backend;this.backend=undefined;await backend?.leave();}throw error;}
  finally{if(this.cancel===cancel)this.cancel=undefined;}
 }
 async ready(value:boolean) {if(!this.backend)throw Error('请先进入房间');await this.backend.ready(value);}
 async rename(value:string) {if(!this.backend)throw Error('请先进入房间');await this.backend.rename(value);}
 async leave() {this.generation++;this.cancel?.abort();this.cancel=undefined;const backend=this.backend;this.backend=undefined;await backend?.leave();}
}

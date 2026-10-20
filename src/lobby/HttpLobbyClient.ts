import type{LobbyConnection,LobbyIdentity,LobbySnapshot}from'./types';
class LobbyError extends Error{constructor(message:string,readonly status:number){super(message);}}
export class HttpLobbyClient {
 private token='';private memberId='';private timer?:ReturnType<typeof setTimeout>;private active=false;private code='';

 private identity?:LobbyIdentity;private generation=0;
 constructor(private update:(value:LobbyConnection)=>void,private problem:(message:string,retrying?:boolean)=>void,private base:string){}
 private async api(path:string,data?:unknown){
  let response:Response;try{response=await fetch(this.base+'/'+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(this.token?{Authorization:'Bearer '+this.token}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(6000)});}catch{throw new LobbyError('无法连接大厅，请确认大厅服务已启动后重试',0);}
  const b=await response.json().catch(()=>({error:'大厅服务暂时不可用'}));if(!response.ok)throw new LobbyError(b.error??'大厅连接失败',response.status);return b;
 }
 private publish(room:LobbySnapshot,status:'connected'|'reconnecting'='connected'){this.update({room,memberId:this.memberId,status});}
 async join(code:string,identity:LobbyIdentity){
  if(!/^\d{4}$/.test(code))throw Error('房间号必须是四位数字');
  this.code=code;this.identity=identity;const gen=++this.generation;this.active=true;
  try{const b=await this.api('join',{code,...identity});if(gen!==this.generation){void fetch(this.base+'/leave',{method:'POST',headers:{Authorization:'Bearer '+b.token},keepalive:true}).catch(()=>{});return;}this.token=b.token;this.memberId=b.memberId;this.publish(b.room);this.poll(gen);}catch(e){if(gen===this.generation)this.active=false;throw e;}
 }
 private poll(gen:number){clearTimeout(this.timer);this.timer=setTimeout(async()=>{if(!this.active||gen!==this.generation)return;
  try{const b=await this.api('state');if(this.active&&gen===this.generation){this.publish(b.room);this.poll(gen);}}
  catch(e){if(!this.active||gen!==this.generation)return;
   if(e instanceof LobbyError&&e.status===409){this.active=false;this.problem(e.message,false);return;}
   this.problem('大厅连接中断，正在重连…');
   if(e instanceof LobbyError&&e.status===401){try{await this.join(this.code,this.identity!);}catch{this.active=true;this.poll(this.generation);}}else this.poll(gen);
  }
 },1000);}
 async ready(ready:boolean){const gen=this.generation,b=await this.api('ready',{ready});if(this.active&&gen===this.generation)this.publish(b.room);}
 async rename(playerId:string){const gen=this.generation,b=await this.api('rename',{playerId});if(this.identity)this.identity.playerId=playerId;if(this.active&&gen===this.generation)this.publish(b.room);}
 async leave(){const token=this.token;this.active=false;this.generation++;clearTimeout(this.timer);this.token='';if(token)try{await fetch(this.base+'/leave',{method:'POST',headers:{Authorization:'Bearer '+token},keepalive:true,signal:AbortSignal.timeout(2000)});}catch{/* TTL removes disconnected devices. */}}
}

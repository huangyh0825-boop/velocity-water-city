import {env,exports} from 'cloudflare:workers';
import {evictDurableObject,runInDurableObject,runDurableObjectAlarm} from 'cloudflare:test';
import {afterEach,describe,expect,it} from 'vitest';
const SELF=exports.default;
const origin='https://huangyh0825-boop.github.io';
const sockets:WebSocket[]=[];
const who=(n:number)=>({deviceId:n.toString(16).padStart(32,'0'),resumeKey:(n+100).toString(16).padStart(32,'0'),playerId:`玩家${n}`});
let sequence=0;
type Event={type:string;id?:string;[key:string]:any};
function client(ws:WebSocket) {
 const queue:Event[]=[],waiting:{test:(e:Event)=>boolean;resolve:(e:Event)=>void}[]=[];
 ws.addEventListener('message',event=>{if(event.data==='pong')return;const value=JSON.parse(String(event.data)),i=waiting.findIndex(w=>w.test(value));if(i>=0)waiting.splice(i,1)[0].resolve(value);else queue.push(value);});
 const next=(type:string,id?:string)=>new Promise<Event>(resolve=>{const test=(e:Event)=>e.type===type&&(id===undefined||e.id===id),i=queue.findIndex(test);if(i>=0)resolve(queue.splice(i,1)[0]);else waiting.push({test,resolve});});
 return {ws,next,async send(type:string,extra:object={},response='ack'){const id='request-'+(++sequence),pending=next(response,id);ws.send(JSON.stringify({v:1,type,id,...extra}));return pending;}};
}
async function connect(code:string,n:number,mode?:string) {
 const stub=env.ROOMS.getByName(code),response=await stub.fetch(`https://lobby.local/api/lobby/rooms/${code}/socket`,{headers:{Upgrade:'websocket','X-Lobby-Code':code}}),ws=response.webSocket!;
 expect(response.status).toBe(101);expect(ws).toBeTruthy();ws.accept();sockets.push(ws);const c=client(ws),welcome=await c.send('join',{identity:who(n),mode},'welcome');return {...c,welcome,stub};
}
afterEach(()=>{for(const ws of sockets.splice(0))try{ws.close(1000,'test done');}catch{}});
describe('actual workerd SQLite rooms and hibernatable WebSockets',()=>{
 it('health and ingress CORS checks reject untrusted origins and malformed routes before touching a room',async()=>{
  const health=await SELF.fetch('https://lobby.local/api/lobby/health');expect(await health.json()).toMatchObject({ok:true,transport:'websocket',protocol:1,capacity:5});
  const bad=await SELF.fetch('https://lobby.local/api/lobby/join',{method:'POST',headers:{Origin:'https://evil.invalid'},body:'{}'});expect(bad.status).toBe(403);expect(bad.headers.has('Access-Control-Allow-Origin')).toBe(false);
  const preflight=await SELF.fetch('https://lobby.local/api/lobby/join',{method:'OPTIONS',headers:{Origin:origin}});expect(preflight.status).toBe(204);expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  expect((await SELF.fetch('https://lobby.local/api/lobby/rooms/abc/socket',{headers:{Origin:origin,Upgrade:'websocket'}})).status).toBe(404);
  expect((await SELF.fetch('https://lobby.local/api/lobby/rooms/1234/socket',{headers:{Origin:origin}})).status).toBe(426);
 });
 it('two clients share room/ready/rename, isolate another room, and migrate host on explicit leave',async()=>{
  const a=await connect('1001',1),b=await connect('1001',2),other=await connect('1002',3);
  expect(b.welcome.room.members).toHaveLength(2);expect(other.welcome.room.members).toHaveLength(1);
  await b.send('ready',{ready:true});await b.send('rename',{playerId:'改名玩家'});
  await a.send('state');let state=await a.next('room');while(!state.room.members.some((m:any)=>m.playerId==='改名玩家'))state=await a.next('room');
  expect(state.room.members[1]).toMatchObject({playerId:'改名玩家',ready:true});expect(JSON.stringify(state)).not.toMatch(/deviceId|resumeKey|keyHash|token|sessionId/);
  await a.send('leave');await b.send('state');let migrated=await b.next('room');while(migrated.room.members.length!==1)migrated=await b.next('room');expect(migrated.room.members[0]).toMatchObject({host:true,playerId:'改名玩家'});
  await other.send('state');expect((await other.next('room')).room.members).toHaveLength(1);
 });
 it('hibernation really evicts the instance while preserving sockets, identity, readiness and host',async()=>{
  const a=await connect('1003',1),b=await connect('1003',2);await b.send('ready',{ready:true});
  await evictDurableObject(a.stub);await b.send('rename',{playerId:'唤醒后玩家'});await evictDurableObject(a.stub);
  await b.send('state');let state=await b.next('room');while(!state.room.members.some((m:any)=>m.playerId==='唤醒后玩家'))state=await b.next('room');
  expect(state.room.members).toHaveLength(2);expect(state.room.members[0].id).toBe(a.welcome.memberId);expect(state.room.members[0].host).toBe(true);expect(state.room.members[1]).toMatchObject({ready:true,playerId:'唤醒后玩家'});
  const pong=new Promise<string>(resolve=>a.ws.addEventListener('message',e=>{if(e.data==='pong')resolve('pong');},{once:true}));a.ws.send('ping');expect(await pong).toBe('pong');
 });
 it('duplicate device re-entry replaces its old connection and preserves one member and ready state',async()=>{
  const a=await connect('1004',1);await a.send('ready',{ready:true});const closed=new Promise<number>(resolve=>a.ws.addEventListener('close',e=>resolve(e.code)));
  const resumed=await connect('1004',1);expect(await closed).toBe(4009);expect(resumed.welcome.memberId).toBe(a.welcome.memberId);expect(resumed.welcome.room.members).toHaveLength(1);expect(resumed.welcome.room.members[0].ready).toBe(true);
 });
 it('concurrent joins enforce the capacity, and join-only reports a missing room',async()=>{
  const joined=await Promise.all([1,2,3,4,5].map(n=>connect('1005',n)));const stub=joined[0].stub;
  async function denied(code:string,n:number,extra:object={}){const response=await env.ROOMS.getByName(code).fetch(`https://lobby.local/api/lobby/rooms/${code}/socket`,{headers:{Upgrade:'websocket','X-Lobby-Code':code}}),ws=response.webSocket!;ws.accept();sockets.push(ws);return client(ws).send('join',{identity:who(n),...extra},'error');}
  expect((await denied('1005',6)).code).toBe(409);expect((await denied('1006',1,{mode:'join'})).code).toBe(404);
  await evictDurableObject(stub);await joined[0].send('state');let state=await joined[0].next('room');while(state.room.members.length!==5)state=await joined[0].next('room');expect(state.room.members).toHaveLength(5);
 });
 it('disconnect grace permits a reconnect; expiry removes ghosts, migrates the host and deletes an empty room',async()=>{
  const a=await connect('1007',1),b=await connect('1007',2);a.ws.close(1000,'network lost');
  let state=await b.next('room');while(state.room.members[0].connected!==false)state=await b.next('room');
  const resumed=await connect('1007',1);expect(resumed.welcome.memberId).toBe(a.welcome.memberId);expect(resumed.welcome.room.members).toHaveLength(2);
  resumed.ws.close(1000,'lost again');state=await b.next('room');while(state.room.members[0].connected!==false)state=await b.next('room');
  await runInDurableObject(b.stub,async(instance,ctx)=>{const data=(instance as unknown as {room:{members:{expiresAt?:number}[]}}).room;data.members[0].expiresAt=Date.now()-1;await ctx.storage.put('room',data);await ctx.storage.setAlarm(Date.now()+60_000);});
  expect(await runDurableObjectAlarm(b.stub)).toBe(true);await b.send('state');state=await b.next('room');while(state.room.members.length!==1)state=await b.next('room');expect(state.room.members[0].host).toBe(true);
  await b.send('leave');await runInDurableObject(b.stub,async(_instance,ctx)=>{expect((await ctx.storage.list()).size).toBe(0);expect(await ctx.storage.getAlarm()).toBeNull();});
 });
 it('server rejects spoofed host commands, racing frames and wrong ready data without changing room state',async()=>{
  const a=await connect('1008',1),b=await connect('1008',2);
  expect((await b.send('start',{},'error')).code).toBe(403);expect((await a.send('start',{},'error')).code).toBe(501);
  expect((await b.send('ready',{ready:'yes'},'error')).code).toBe(400);expect((await b.send('race.batch',{room:'1009',updates:[]},'error')).code).toBe(400);
  await b.send('state');let state=await b.next('room');while(state.room.members.length!==2)state=await b.next('room');expect(state.room.members.every((m:any)=>m.ready===false)).toBe(true);
 });
 it('legacy HTTP endpoints remain compatible and private tokens cannot address a different room',async()=>{
  const call=async(path:string,b?:unknown,token?:string)=>{const response=await SELF.fetch('https://lobby.local/api/lobby/'+path,{method:b===undefined?'GET':'POST',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.42',...(token?{Authorization:'Bearer '+token}:{})},body:b===undefined?undefined:JSON.stringify(b)});return {status:response.status,data:await response.json() as any};};
  const a=await call('join',{code:'1009',...who(1)});expect(a.status).toBe(200);const b=await connect('1009',2);expect(b.welcome.room.members).toHaveLength(2);
  expect((await call('ready',{ready:true},a.data.token)).status).toBe(200);expect((await call('state',undefined,a.data.token)).data.room.members[0].ready).toBe(true);
  expect((await call('state',undefined,'1010.'+a.data.token.split('.')[1])).status).toBe(401);expect((await call('leave',{},a.data.token)).data.ok).toBe(true);
 });
 it('wrong resume credentials and unauthenticated commands cannot impersonate existing members',async()=>{
  const a=await connect('1011',1),response=await a.stub.fetch('https://lobby.local/api/lobby/rooms/1011/socket',{headers:{Upgrade:'websocket','X-Lobby-Code':'1011'}}),ws=response.webSocket!;ws.accept();sockets.push(ws);const attacker=client(ws);
  expect((await attacker.send('join',{identity:{...who(1),resumeKey:'f'.repeat(32)}},'error')).code).toBe(403);
  const second=await a.stub.fetch('https://lobby.local/api/lobby/rooms/1011/socket',{headers:{Upgrade:'websocket','X-Lobby-Code':'1011'}}),anonymous=second.webSocket!;anonymous.accept();sockets.push(anonymous);
  expect((await client(anonymous).send('ready',{ready:true},'error')).code).toBe(401);
  await a.send('state');expect((await a.next('room')).room.members).toHaveLength(1);
 });
 it('oversized, binary and malformed messages are bounded and cannot change state',async()=>{
  const a=await connect('1012',1);expect((await a.send('ready',{ready:1},'error')).code).toBe(400);
  const invalid=a.next('error');a.ws.send('{');expect((await invalid).code).toBe(400);
  const closed=new Promise<number>(resolve=>a.ws.addEventListener('close',e=>resolve(e.code)));a.ws.send('x'.repeat(2049));expect(await closed).toBe(1009);
  const b=await connect('1013',1),binaryClosed=new Promise<number>(resolve=>b.ws.addEventListener('close',e=>resolve(e.code)));b.ws.send(new Uint8Array([1,2]));expect(await binaryClosed).toBe(1003);
  const response=await SELF.fetch('https://lobby.local/api/lobby/join',{method:'POST',headers:{Origin:origin},body:'x'.repeat(2049)});expect(response.status).toBe(413);
 });
 it('idle authenticated sockets need no alarms, and unauthenticated connection deadlines are cleaned',async()=>{
  const a=await connect('1014',1);await runInDurableObject(a.stub,async(_i,ctx)=>expect(await ctx.storage.getAlarm()).toBeNull());
  const response=await a.stub.fetch('https://lobby.local/api/lobby/rooms/1014/socket',{headers:{Upgrade:'websocket','X-Lobby-Code':'1014'}}),ws=response.webSocket!;ws.accept();sockets.push(ws);
  const closed=new Promise<number>(resolve=>ws.addEventListener('close',e=>resolve(e.code)));
  await runInDurableObject(a.stub,async(_i,ctx)=>{for(const socket of ctx.getWebSockets()){const attachment=socket.deserializeAttachment();if(!attachment.memberId)socket.serializeAttachment({...attachment,deadline:Date.now()-1});}});
  await runDurableObjectAlarm(a.stub);expect(await closed).toBe(4008);
  await a.send('state');expect((await a.next('room')).room.members).toHaveLength(1);
 });
 it('per-connection command budgets survive eviction and bound abuse',async()=>{
  const a=await connect('1015',1);for(let i=0;i<38;i++)await a.send('state');await evictDurableObject(a.stub);
  await a.send('state');expect((await a.send('state',{},'error')).code).toBe(429);
 });
 it('ingress connection limits bound repeated room creation attempts by client IP',async()=>{
  for(let i=0;i<21;i++){const response=await SELF.fetch('https://lobby.local/api/lobby/join',{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.99'},body:JSON.stringify({code:'1099',...who(1),mode:'join'})});expect(response.status).toBe(i<20?404:429);}
 });
});

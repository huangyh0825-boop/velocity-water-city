import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {WebSocket} from 'ws';
import {createLobbyServer} from '../server/lobby';
import {isLobbySnapshot} from '../src/lobby/protocol';

const identity=(n:number)=>({deviceId:n.toString(16).padStart(32,'0'),resumeKey:(n+100).toString(16).padStart(32,'0'),playerId:`玩家${n}`});
type Event=Record<string,any>;
class Peer {
 events:Event[]=[];waiters=new Set<()=>void>();seq=0;closed:Promise<number>;
 constructor(readonly socket:WebSocket){
  socket.on('error',()=>{});
  socket.on('message',raw=>{const text=raw.toString();this.events.push(text==='pong'?{type:'pong'}:JSON.parse(text));for(const wake of this.waiters)wake();});
  this.closed=new Promise(resolve=>socket.once('close',code=>resolve(code)));
 }
 async event(predicate:(v:Event)=>boolean):Promise<Event>{
  const find=()=>{const i=this.events.findIndex(predicate);return i<0?undefined:this.events.splice(i,1)[0];};
  const existing=find();if(existing)return existing;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.waiters.delete(check);reject(Error('event timeout: '+JSON.stringify(this.events)));},2500);
   const check=()=>{const value=find();if(value){clearTimeout(timer);this.waiters.delete(check);resolve(value);}};this.waiters.add(check);check();
  });
 }
 command(type:string,data:Record<string,unknown>={}){const id='test-'+ ++this.seq;this.socket.send(JSON.stringify({v:1,type,id,...data}));return id;}
 async join(n:number,mode?:string,custom?:Record<string,unknown>){const id=this.command('join',{identity:{...identity(n),...custom},mode});return this.event(e=>e.id===id);}
 async ack(type:string,data:Record<string,unknown>={}){const id=this.command(type,data);return this.event(e=>e.id===id);}
 async state(){const id=this.command('state');await this.event(e=>e.type==='ack'&&e.id===id);const rooms=this.events.filter(e=>e.type==='room');this.events=this.events.filter(e=>e.type!=='room');return rooms.at(-1)!.room;}
 async leave(){await this.ack('leave');assert.equal(await this.closed,1000);}
}
async function fixture(options:Parameters<typeof createLobbyServer>[0]={}){
 const server=createLobbyServer(options);server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address()as AddressInfo).port}`;const peers:Peer[]=[];
 return {base,server,async peer(code='0042',origin?:string){const ws=new WebSocket(base.replace('http:','ws:')+`/api/lobby/rooms/${code}/socket`,{origin});const p=new Peer(ws);peers.push(p);await once(ws,'open');return p;},
  async close(){for(const p of peers)p.socket.terminate();await new Promise<void>(resolve=>server.close(()=>resolve()));server.closeAllConnections();}};
}
test('v1 WebSocket clients create/join, broadcast counts/ready/rename, enforce host and migrate on leave',async()=>{
 const f=await fixture();try{
  const health=await(await fetch(f.base+'/api/lobby/health')).json();assert.equal(health.transport,'websocket');assert.equal(health.protocol,1);
  const a=await f.peer(),aw=await a.join(1,'create');assert.equal(aw.type,'welcome');assert.ok(isLobbySnapshot(aw.room));
  const b=await f.peer(),bw=await b.join(2,'join');assert.equal(bw.room.members.length,2);assert.equal((await a.state()).members.length,2);
  await b.ack('ready',{ready:true});await b.ack('rename',{playerId:'新名字'});
  const state=await a.state();assert.equal(state.members[1].ready,true);assert.equal(state.members[1].playerId,'新名字');
  assert.equal((await b.ack('start')).code,403);assert.equal((await a.ack('start')).code,501);
  const serialized=JSON.stringify(state);assert.ok(!/deviceId|resumeKey|keyHash|token/.test(serialized));
  const other=await f.peer('4242');assert.equal((await other.join(3)).room.members.length,1);
  a.socket.send('ping');await a.event(e=>e.type==='pong');
  await a.leave();const migrated=await b.state();assert.equal(migrated.members.length,1);assert.equal(migrated.members[0].host,true);
 }finally{await f.close();}
});
test('disconnection grace keeps member ID/ready/host, duplicate tab closes 4009, expiry removes offline seats',async()=>{
 let clock=10000;const f=await fixture({ttlMs:100,now:()=>clock});try{
  const a=await f.peer();const first=await a.join(1);await a.ack('ready',{ready:true});
  const b=await f.peer();await b.join(2);a.socket.terminate();await a.closed;
  const offline=await b.event(e=>e.type==='room'&&e.room.members[0].connected===false);assert.equal(offline.room.members[0].host,true);
  const resumed=await f.peer();const welcome=await resumed.join(1);assert.equal(welcome.memberId,first.memberId);assert.equal(welcome.room.members[0].ready,true);
  const duplicate=await f.peer();assert.equal((await duplicate.join(1)).memberId,first.memberId);assert.equal(await resumed.closed,4009);
  duplicate.socket.terminate();await duplicate.closed;await b.event(e=>e.type==='room'&&e.room.members[0].connected===false);
  clock+=101;await fetch(f.base+'/api/lobby/health');const room=await b.state();assert.equal(room.members.length,1);assert.equal(room.members[0].host,true);
 }finally{await f.close();}
});
test('room existence, capacity, identity ownership and protocol validation are enforced',async()=>{
 const f=await fixture();try{
  const missing=await f.peer();assert.equal((await missing.join(1,'join')).code,404);assert.equal(await missing.closed,4003);
  const peers=[];for(let n=1;n<=5;n++){const p=await f.peer();assert.equal((await p.join(n)).type,'welcome');peers.push(p);}
  const full=await f.peer();assert.equal((await full.join(6)).code,409);
  const forged=await f.peer();assert.equal((await forged.join(1,undefined,{resumeKey:'f'.repeat(32)})).code,403);
  const occupied=await f.peer();assert.equal((await occupied.join(7,'create')).code,409);
  assert.equal((await peers[0].ack('race.batch',{updates:[]})).code,400);
  assert.equal((await peers[0].ack('ready',{ready:'true'})).code,400);
  assert.equal((await peers[0].ack('rename',{playerId:'<script>'})).code,400);
 }finally{await f.close();}
});
test('WebSocket unauthorized origins/routes fail upgrade; binary, oversized and excessive frames close',async()=>{
 const f=await fixture();try{
  for(const [path,origin,status] of [['/api/lobby/rooms/0042/socket','https://evil.invalid',403],['/api/lobby/rooms/42/socket',undefined,404]]as const){
   const ws=new WebSocket(f.base.replace('http:','ws:')+path,{origin});ws.on('error',()=>{});
   const [,res]=await once(ws,'unexpected-response');assert.equal(res.statusCode,status);res.resume();ws.terminate();
  }
  const binary=await f.peer();binary.socket.send(Buffer.from('test'));assert.equal(await binary.closed,1003);
  const huge=await f.peer();huge.socket.send('x'.repeat(2049));assert.equal(await huge.closed,1009);
  const spam=await f.peer();await spam.join(1);for(let n=0;n<40;n++)spam.command('state');assert.equal(await spam.closed,4029);
 }finally{await f.close();}
});
test('HTTP and WebSocket users share rooms, and server restart clears rooms without losing device identity',async()=>{
 const f=await fixture();const who=identity(2);let oldMember='';try{
  const a=await f.peer();await a.join(1);
  const response=await fetch(f.base+'/api/lobby/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'0042',...who})});
  const joined=await response.json();oldMember=joined.memberId;assert.equal((await a.state()).members.length,2);
  const resumed=await f.peer();assert.equal((await resumed.join(2)).memberId,oldMember);
  assert.equal((await fetch(f.base+'/api/lobby/state',{headers:{Authorization:'Bearer '+joined.token}})).status,409);
  await resumed.ack('ready',{ready:true});
 }finally{await f.close();}
 const restarted=await fixture();try{
  const p=await restarted.peer();const welcome=await p.join(2);assert.notEqual(welcome.memberId,oldMember);assert.equal(welcome.room.members[0].ready,false);assert.equal(welcome.room.members[0].host,true);
 }finally{await restarted.close();}
});
test('graceful shutdown closes upgraded sockets with restart code',async()=>{
 const f=await fixture();try{const p=await f.peer();await p.join(1);const close=new Promise<void>(resolve=>f.server.close(()=>resolve()));assert.equal(await p.closed,1012);await close;}finally{await f.close();}
});

test('real race sockets enforce host/all-ready/loading barrier, reconnect countdown, locked roster and independent state rate',async()=>{
 let clock=1000;const f=await fixture({now:()=>clock});try{
  const a=await f.peer(),b=await f.peer();
  for(const [p,n]of [[a,1],[b,2]]as const){const id=p.command('join',{identity:identity(n),features:['race-v1']});assert.equal((await p.event(e=>e.id===id)).type,'welcome');}
  assert.equal((await b.ack('start')).code,403);assert.equal((await a.ack('start')).code,409);
  await a.ack('ready',{ready:true});assert.equal((await a.ack('start')).code,409);await b.ack('ready',{ready:true});assert.equal((await a.ack('start')).type,'ack');
  let room=await a.state();const raceId=room.race.id;assert.equal(room.race.phase,'loading');
  const c=await f.peer();assert.equal((await c.join(3)).code,409);
  await a.ack('race.loaded',{raceId});room=await a.state();assert.equal(room.race.phase,'loading');
  await b.ack('race.loaded',{raceId});room=await a.state();assert.equal(room.race.startAt-room.race.countdownAt,5000);
  const refresh=await f.peer(),refreshId=refresh.command('join',{identity:identity(2),features:['race-v1']});await refresh.event(e=>e.id===refreshId);assert.equal(await b.closed,4009);
  room=await a.state();assert.equal(room.race.phase,'loading');assert.equal(room.race.participants[1].loaded,false);await refresh.ack('race.loaded',{raceId});
  refresh.socket.terminate();await refresh.closed;await a.event(e=>e.type==='room'&&e.room.race?.phase==='loading');
  const resumed=await f.peer();const joinId=resumed.command('join',{identity:identity(2),features:['race-v1']});await resumed.event(e=>e.id===joinId);
  assert.equal((await a.state()).race.phase,'loading');await resumed.ack('race.loaded',{raceId});room=await a.state();clock=room.race.startAt+1000;
  const first=await a.event(e=>e.type==='race.frame'&&e.frame.phase==='racing'),pose=first.frame.states.find((p:any)=>p.id===room.members[0].id);
  // 60 updates within one minute exceed the lobby command budget, but remain valid at 10 Hz.
  for(let n=1;n<=60;n++){clock+=100;a.socket.send(JSON.stringify({v:1,type:'race.state',raceId,state:{...pose,seq:n,t:(clock-room.race.startAt)/1000}}));await new Promise(r=>setTimeout(r,2));}
  assert.equal((await a.ack('clock')).type,'ack');assert.equal(a.socket.readyState,WebSocket.OPEN);
  assert.equal((await resumed.ack('race.recover',{raceId:'f'.repeat(24)})).code,409);
  await resumed.leave();room=await a.state();assert.equal(room.race.participants[1].dnf,true);
 }finally{await f.close();}
});

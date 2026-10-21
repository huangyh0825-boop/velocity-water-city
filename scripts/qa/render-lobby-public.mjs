import {WebSocket} from 'ws';
import {randomBytes,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL(process.env.QA_URL??'');assert.equal(root.protocol,'https:','Set QA_URL to the verified Render HTTPS address');
const output=process.env.QA_OUTPUT??'work/render-lobby-public-protocol';await mkdir(output,{recursive:true});
const result={url:root.origin,checkedAt:new Date().toISOString(),testNetwork:'本机公网测试；地区、运营商及 VPN 状态未验证，不代表中国大陆无 VPN',checks:{},mainlandNoVpn:'pending-real-user-test'};
const origin='https://huangyh0825-boop.github.io';
const peers=[];result.initialRequestFailures=[];
async function get(path,headers={}){
 for(let attempt=1;attempt<=3;attempt++){
  try{return await fetch(new URL(path,root),{headers,signal:AbortSignal.timeout(30_000)});}
  catch(e){result.initialRequestFailures.push({path,attempt,error:e.message,code:e.cause?.code??null});if(attempt===3)throw e;await new Promise(resolve=>setTimeout(resolve,2000));}
 }
}
try{
const start=performance.now();const response=await get('/api/lobby/health',{Origin:origin});
result.http={status:response.status,elapsedMs:Math.round(performance.now()-start),corsOrigin:response.headers.get('access-control-allow-origin'),health:await response.json()};
assert.equal(response.status,200);assert.equal(result.http.corsOrigin,origin);assert.equal(result.http.health.transport,'websocket');
for(const [path,local] of [['/','dist-lobby/public/index.html'],['/test.js','dist-lobby/public/test.js']]){
 const r=await get(path);assert.equal(r.status,200);
 const remote=Buffer.from(await r.arrayBuffer()),expected=await readFile(local);
 assert.equal(createHash('sha256').update(remote).digest('hex'),createHash('sha256').update(expected).digest('hex'));
}result.checks.publicAssetsMatchBuild=true;
const who=()=>({deviceId:randomBytes(16).toString('hex'),resumeKey:randomBytes(16).toString('hex'),playerId:'公网协议测试'});
const code=String(1000+Math.floor(Math.random()*9000));
async function peer(identity,mode='auto'){
 const events=[],listeners=new Set();let seq=0;const url=new URL(`/api/lobby/rooms/${code}/socket`,root);url.protocol='wss:';
 const ws=new WebSocket(url,{origin,handshakeTimeout:20_000});peers.push(ws);let closeCode=null,upgrade=null;
 ws.on('upgrade',r=>{upgrade=r.statusCode;});ws.on('error',e=>{events.push({type:'socket-error',message:e.message});for(const wake of listeners)wake();});
 ws.on('message',raw=>{const text=raw.toString();events.push(text==='pong'?{type:'pong'}:JSON.parse(text));for(const wake of listeners)wake();});
 const closed=new Promise(resolve=>ws.once('close',code=>{closeCode=code;resolve(code);}));
 const event=(predicate,timeout=20_000)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{listeners.delete(check);reject(Error('WSS response timeout'));},timeout);
  function check(){const i=events.findIndex(predicate);if(i>=0){clearTimeout(timer);listeners.delete(check);resolve(events.splice(i,1)[0]);}}listeners.add(check);check();
 });
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 const command=(type,data={})=>{const id='probe-'+ ++seq;ws.send(JSON.stringify({v:1,type,id,...data}));return id;};
 const ack=async(type,data={})=>{const id=command(type,data);return event(e=>e.id===id);};
 const welcome=await ack('join',{identity,mode});assert.equal(welcome.type,'welcome');
 const state=async()=>{await ack('state');const rooms=events.filter(e=>e.type==='room');return rooms.at(-1).room;};
 const ping=async()=>{ws.send('ping');await event(e=>e.type==='pong');};
 return {ws,event,ack,state,ping,welcome,upgrade,closed,get closeCode(){return closeCode;}};
}
 const wssStart=performance.now(),identityA=who(),identityB=who();identityA.playerId='公网房主';identityB.playerId='公网访客';
 const a=await peer(identityA,'create'),b=await peer(identityB,'join');
 result.wss={httpUpgrade:a.upgrade,firstWelcomeMs:Math.round(performance.now()-wssStart)};assert.equal(a.upgrade,101);
 assert.equal((await a.state()).members.length,2);assert.equal((await b.state()).members.length,2);result.checks.createJoinSync=true;
 await b.ack('ready',{ready:true});await b.ack('rename',{playerId:'公网改名'});identityB.playerId='公网改名';
 const synced=await a.state();assert.equal(synced.members[1].ready,true);assert.equal(synced.members[1].playerId,'公网改名');result.checks.readyRename=true;
 assert.equal((await b.ack('start')).code,403);assert.equal((await a.ack('start')).code,501);result.checks.hostPermissions=true;
 const abruptStart=performance.now();let abruptError;
 // A TCP loss need not reach the origin immediately through a reverse proxy.
 // Keep the observer active while allowing the server's 150-second silence detector to run.
 const observerHeartbeat=setInterval(()=>{void a.ping().catch(e=>{abruptError=e;});},20_000);
 b.ws.terminate();await b.closed;
 try{await a.event(e=>e.type==='room'&&e.room.members.some(m=>!m.connected),180_000);}finally{clearInterval(observerHeartbeat);}
 if(abruptError)throw abruptError;
 result.abruptDisconnectDetectionMs=Math.round(performance.now()-abruptStart);
 const resumed=await peer(identityB);assert.equal(resumed.welcome.memberId,b.welcome.memberId);assert.equal(resumed.welcome.room.members[1].ready,true);result.checks.disconnectAndResume=true;
 await a.ack('leave');await a.closed;const room=await resumed.state();assert.equal(room.members.length,1);assert.equal(room.members[0].host,true);result.checks.leaveAndHostMigration=true;
 const seconds=Math.min(600,Math.max(300,Number(process.env.QA_STABILITY_SECONDS??300)));
 const observationStart=performance.now();let pongs=0;const latency=[];
 while(performance.now()-observationStart<seconds*1000){
  const t=performance.now();await resumed.ping();pongs++;latency.push(Math.round(performance.now()-t));
  const elapsed=Math.floor((performance.now()-observationStart)/1000);console.log(JSON.stringify({phase:'stability',elapsedSeconds:elapsed,requiredSeconds:seconds,pongs}));
  await new Promise(resolve=>setTimeout(resolve,Math.min(30_000,Math.max(1,seconds*1000-(performance.now()-observationStart)))));
 }
 await resumed.ping();assert.equal(resumed.closeCode,null);assert.equal((await resumed.state()).members.length,1);
 result.stability={requestedSeconds:seconds,elapsedSeconds:Math.floor((performance.now()-observationStart)/1000),disconnects:0,pongs:pongs+1,latencyMs:latency,passed:true};
 const leaveAck=await resumed.ack('leave');assert.equal(leaveAck.type,'ack');
 const closeCode=await resumed.closed;result.finalLeave={acknowledged:true,closeCode};
 assert.ok([1000,1006].includes(closeCode));
 if(closeCode===1006)result.transportWarnings=['Server acknowledged leave; client observed 1006 without a normal close frame. Cause unconfirmed. This occurred after the stability observation.'];
 result.checks.finalLeave=true;
 await writeFile(output+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(e){result.error=e.message;await writeFile(output+'/failure.json',JSON.stringify(result,null,2));throw e;}
finally{for(const p of peers)p.terminate();}

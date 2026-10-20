import{test}from'node:test';import assert from'node:assert/strict';import{once}from'node:events';import type{AddressInfo}from'node:net';
import{createLobbyServer}from'../server/lobby';
async function fixture(options:Parameters<typeof createLobbyServer>[0]={}){const server=createLobbyServer(options);server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address()as AddressInfo).port}/api/lobby/`;return{async call(path:string,data?:unknown,token?:string,origin?:string){const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})},body:data===undefined?undefined:JSON.stringify(data)});return{status:r.status,data:await r.json()};},close:()=>new Promise<void>((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections();})};}
const identity=(n:number)=>({deviceId:n.toString(16).padStart(32,'0'),resumeKey:(n+100).toString(16).padStart(32,'0'),playerId:`玩家${n}`});
test('real independent clients join the same four-digit room, see ready and rename updates, and migrate host on leave',async()=>{
 const f=await fixture();try{const a=await f.call('join',{code:'0042',...identity(1)}),b=await f.call('join',{code:'0042',...identity(2)});assert.equal(a.status,200);assert.equal(b.data.room.members.length,2);assert.equal(b.data.room.code,'0042');
 await f.call('ready',{ready:true},b.data.token);await f.call('rename',{playerId:'已改名'},b.data.token);let state=await f.call('state',undefined,a.data.token);assert.equal(state.data.room.members[1].playerId,'已改名');assert.equal(state.data.room.members[1].ready,true);
 const other=await f.call('join',{code:'4242',...identity(3)});assert.equal(other.data.room.members.length,1);
 const text=JSON.stringify(state.data);assert.equal(text.includes('resumeKey'),false);assert.equal(text.includes('deviceId'),false);assert.equal(text.includes(a.data.token),false);
 await f.call('leave',{},a.data.token);state=await f.call('state',undefined,b.data.token);assert.equal(state.data.room.members.length,1);assert.equal(state.data.room.members[0].host,true);
 }finally{await f.close();}
});
test('room capacity, device resumption, duplicate tab, invalid IDs, and unauthorized origins are enforced',async()=>{
 const f=await fixture();try{const first=await f.call('join',{code:'1234',...identity(1)});for(let n=2;n<=5;n++)assert.equal((await f.call('join',{code:'1234',...identity(n)})).status,200);
 assert.equal((await f.call('join',{code:'1234',...identity(6)})).status,409);
 assert.equal((await f.call('join',{code:'1234',...identity(1),resumeKey:'f'.repeat(32)})).status,403);
 const again=await f.call('join',{code:'1234',...identity(1)});assert.equal(again.data.memberId,first.data.memberId);assert.equal(again.data.room.members.length,5);assert.equal((await f.call('state',undefined,first.data.token)).status,409);
 assert.equal((await f.call('join',{code:'123',...identity(7)})).status,400);assert.equal((await f.call('join',{code:'abcd',...identity(7)})).status,400);assert.equal((await f.call('join',{code:'9999',...identity(7)},undefined,'https://evil.invalid')).status,403);assert.equal((await f.call('ready',{ready:true},'wrong')).status,401);
 }finally{await f.close();}
});
test('disconnected devices expire and empty rooms are removed instead of leaving phantom players',async()=>{
 let now=10000;const f=await fixture({ttlMs:100,now:()=>now});try{const a=await f.call('join',{code:'0000',...identity(1)});now+=101;assert.equal((await f.call('state',undefined,a.data.token)).status,401);assert.equal((await f.call('health')).data.rooms,0);}finally{await f.close();}
});

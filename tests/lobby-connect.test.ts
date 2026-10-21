import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type ServerResponse} from 'node:http';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {connectLobby} from '../src/lobby/connectLobby';
import {LobbyFault} from '../src/lobby/protocol';

async function fixture(reply:(response:ServerResponse,index:number)=>void){
 let calls=0;const server=createServer((req,res)=>{assert.equal(req.url,'/api/lobby/health');reply(res,++calls);});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 return {base:`http://127.0.0.1:${(server.address()as AddressInfo).port}/api/lobby`,get calls(){return calls;},
  async close(){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
const healthy=(res:ServerResponse)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,transport:'websocket',protocol:1}));};
test('cold-start 503 and wake-up HTML retry before a real transport connection; timers stop after success',async()=>{
 const f=await fixture((res,i)=>{if(i===1){res.statusCode=503;res.end('waking');}else if(i===2)res.end('<html>starting</html>');else healthy(res);});
 try{
  const messages:string[]=[];let connected=0;
  await connectLobby({base:f.base,signal:new AbortController().signal,progress:m=>messages.push(m),retryDelayMs:1,timeoutMs:2000,connect:async transport=>{assert.equal(transport,'websocket');connected++;}});
  assert.equal(f.calls,3);assert.equal(connected,1);const count=messages.length;await new Promise(r=>setTimeout(r,30));assert.equal(messages.length,count);
 }finally{await f.close();}
});
test('a transient initial socket failure retries; a room-full rejection is preserved without retry',async()=>{
 const f=await fixture(healthy);try{
  let attempts=0;await connectLobby({base:f.base,signal:new AbortController().signal,progress:()=>{},retryDelayMs:1,connect:async()=>{if(++attempts===1)throw Error('socket unavailable');}});assert.equal(attempts,2);
  const before=f.calls;await assert.rejects(connectLobby({base:f.base,signal:new AbortController().signal,progress:()=>{},connect:async()=>{throw new LobbyFault(409,'这个房间已满');}}),e=>e instanceof LobbyFault&&e.status===409);assert.equal(f.calls,before+1);
 }finally{await f.close();}
});
test('unauthorized origins fail immediately instead of retrying for three minutes; legacy HTTP discovery remains supported',async()=>{
 const forbidden=await fixture(res=>{res.statusCode=403;res.end(JSON.stringify({error:'当前网页未被大厅服务授权'}));});
 try{await assert.rejects(connectLobby({base:forbidden.base,signal:new AbortController().signal,progress:()=>{},connect:async()=>{assert.fail('must not connect');}}),/未被大厅服务授权/);assert.equal(forbidden.calls,1);}finally{await forbidden.close();}
 const legacy=await fixture(res=>res.end(JSON.stringify({ok:true,rooms:0})));try{await connectLobby({base:legacy.base,signal:new AbortController().signal,progress:()=>{},connect:async transport=>{assert.equal(transport,'http');}});}finally{await legacy.close();}
});
test('cancel aborts a stalled health request and prevents any later connection or progress',async()=>{
 const controller=new AbortController();let connected=0;const messages:string[]=[];
 const f=await fixture(()=>{controller.abort();});try{
  await assert.rejects(connectLobby({base:f.base,signal:controller.signal,progress:m=>messages.push(m),connect:async()=>{connected++;}}),e=>e instanceof DOMException&&e.name==='AbortError');
  const count=messages.length;await new Promise(r=>setTimeout(r,30));assert.equal(messages.length,count);assert.equal(connected,0);assert.equal(f.calls,1);
 }finally{await f.close();}
});
test('unavailable services hit a finite deadline; cancelling before join performs no request',async()=>{
 const f=await fixture(()=>{});try{
  const start=performance.now();await assert.rejects(connectLobby({base:f.base,signal:new AbortController().signal,progress:()=>{},timeoutMs:80,requestTimeoutMs:20,retryDelayMs:1,connect:async()=>{assert.fail();}}),/大厅连接超时/);assert.ok(performance.now()-start<2000);
  const before=f.calls,controller=new AbortController();controller.abort();await assert.rejects(connectLobby({base:f.base,signal:controller.signal,progress:()=>{},connect:async()=>{assert.fail();}}),/已取消/);assert.equal(f.calls,before);
 }finally{await f.close();}
});

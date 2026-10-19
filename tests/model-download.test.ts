import{test}from'node:test';import assert from'node:assert/strict';import{downloadModel}from'../src/player/downloadModel';
test('range model downloads preserve all bytes and resume just the interrupted chunk',async()=>{
 const bytes=new Uint8Array(Array.from({length:39},(_,i)=>(i*13)%256)),seen:number[]=[];let failed=false,updates=0;
 const fetcher:typeof fetch=async(_url,init)=>{if(init?.method==='HEAD')return new Response(null,{status:405});const start=Number(new Headers(init?.headers).get('Range')!.match(/bytes=(\d+)-/)![1]);seen.push(start);if(start===8&&!failed){failed=true;throw Error('Connection closed');}const end=Math.min(bytes.length,start+8);return new Response(bytes.slice(start,end),{status:206,headers:{'content-range':`bytes ${start}-${end-1}/${bytes.length}`}});};
 const result=await downloadModel('https://game.test/model',()=>updates++,fetcher,8);assert.deepEqual(new Uint8Array(result.data),bytes);assert.deepEqual(seen,[0,8,8,16,24,32]);assert.equal(result.ranged,true);assert.equal(result.transportBytes,null);assert.equal(result.sourceBytes,39);assert.ok(updates>0);
});
test('model transport accepts complete responses and retries truncated range bodies without dropping a byte',async()=>{
 const bytes=new Uint8Array([1,2,3,4,5]),plain=await downloadModel('https://game.test/model',()=>{},async()=>new Response(bytes,{headers:{'content-length':'5'}}));assert.deepEqual(new Uint8Array(plain.data),bytes);assert.equal(plain.ranged,false);assert.equal(plain.transportBytes,5);let calls=0;
 const corrected=await downloadModel('https://game.test/model',()=>{},async(_url,init)=>{if(init?.method==='HEAD')return new Response(null);calls++;const start=Number(new Headers(init?.headers).get('Range')!.match(/bytes=(\d+)-/)![1]),end=Math.min(4+start,5),body=bytes.slice(start,calls===1?end-1:end);return new Response(body,{status:206,headers:{'content-range':`bytes ${start}-${end-1}/5`}});},4);assert.deepEqual(new Uint8Array(corrected.data),bytes);assert.equal(calls,3);
});
test('encoded servers use HEAD then a complete decoded body before a browser can reject partial gzip',async()=>{
 const seen:string[]=[],bytes=new Uint8Array([1,2,3]);const result=await downloadModel('https://game.test/model',()=>{},async(_url,init)=>{seen.push(init?.method??'GET');assert.equal(new Headers(init?.headers).get('Range'),null);return init?.method==='HEAD'?new Response(null,{headers:{'content-encoding':'gzip'}}):new Response(bytes);});assert.deepEqual(seen,['HEAD','GET']);assert.deepEqual(new Uint8Array(result.data),bytes);assert.equal(result.ranged,false);
});

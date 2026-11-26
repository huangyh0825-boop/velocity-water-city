import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {downloadAssetParts,type AssetParts} from '../src/player/AssetParts';
import type {CachedAsset,DownloadCache} from '../src/player/AssetCache';
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function fixture(raw=Uint8Array.from({length:130},(_,i)=>i*7)){
 const partBytes=32,parts:AssetParts={bytes:raw.length,partBytes,sha256:sha(raw),hashes:[]};
 for(let i=0;i<raw.length;i+=partBytes)parts.hashes.push(sha(raw.slice(i,i+partBytes)));
 const rows=new Map<string,CachedAsset>(),cache:DownloadCache={read:async k=>rows.get(k),write:async(k,v)=>{rows.set(k,v);},clear:async()=>{rows.clear();}};
 return{raw,parts,rows,cache};
}
test('static parts use ordinary GETs, reconstruct exact bytes out of order, and bound concurrency',async()=>{
 const f=fixture();let active=0,peak=0;const finished:number[]=[];
 const result=await downloadAssetParts('https://game.test/velocity/models/city-sample/a.glb.gz',f.parts,()=>{},async(url,init)=>{
  assert.equal(new Headers(init?.headers).has('Range'),false);assert.equal(init?.method,undefined);
  assert.ok(String(url).startsWith('https://game.test/velocity/asset-parts/'+f.parts.sha256+'/'));
  const i=Number(/\/(\d+)\.bin$/.exec(String(url))![1]);peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,i%2?2:10));active--;finished.push(i);
  return new Response(f.raw.slice(i*32,(i+1)*32));
 },{cache:f.cache,retries:0});
 assert.equal(peak,2);assert.equal(finished[0],1);assert.deepEqual(new Uint8Array(result.data),f.raw);assert.equal(result.requests,5);assert.equal(result.transportBytes,f.raw.length);
 const warm=await downloadAssetParts('https://game.test/velocity/models/a.glb.gz',f.parts,()=>{},async()=>{throw Error('must be cached');},{cache:f.cache});assert.equal(warm.requests,0);assert.deepEqual(new Uint8Array(warm.data),f.raw);
});
test('bad or short pieces retry individually before committing a complete resource',async()=>{
 const f=fixture(),calls=new Map<number,number>();let retries=0;
 const result=await downloadAssetParts('https://game.test/models/a',f.parts,()=>{},async url=>{
  const i=Number(/\/(\d+)\.bin$/.exec(String(url))![1]),n=(calls.get(i)??0)+1;calls.set(i,n);
  return new Response(i===2&&n===1?new Uint8Array(32):i===3&&n===1?f.raw.slice(i*32,i*32+2):f.raw.slice(i*32,(i+1)*32));
 },{cache:f.cache,retryDelayMs:0,onRetry:()=>retries++});
 assert.deepEqual(new Uint8Array(result.data),f.raw);assert.equal(retries,2);assert.equal(calls.get(0),1);assert.equal(calls.get(2),2);assert.equal(calls.get(3),2);
});
test('interrupted static downloads resume verified pieces and replace corrupt cached pieces',async()=>{
 const f=fixture();let online=false;const seen:number[]=[];
 const fetcher:typeof fetch=async url=>{const i=Number(/\/(\d+)\.bin$/.exec(String(url))![1]);seen.push(i);if(!online&&i>=2)throw Error('offline');return new Response(f.raw.slice(i*32,(i+1)*32));};
 await assert.rejects(downloadAssetParts('https://game.test/models/a',f.parts,()=>{},fetcher,{cache:f.cache,retries:0}),/offline/);assert.equal(f.rows.has('complete'),false);assert.ok(f.rows.has('segment:0'));assert.ok(f.rows.has('segment:32'));
 f.rows.get('segment:32')!.data=new Uint8Array(32).buffer;seen.length=0;online=true;let cached=0;
 const result=await downloadAssetParts('https://game.test/models/a',f.parts,(n,hit)=>{if(hit)cached+=n;},fetcher,{cache:f.cache,retries:0});assert.deepEqual(new Uint8Array(result.data),f.raw);assert.equal(cached,32);assert.deepEqual(seen.sort((a,b)=>a-b),[1,2,3,4]);
});
test('whole-file hash rejects a mismatched manifest even when individual pieces are valid',async()=>{
 const f=fixture();f.parts.sha256='f'.repeat(64);
 await assert.rejects(downloadAssetParts('https://game.test/models/a',f.parts,()=>{},async url=>{const i=Number(/\/(\d+)\.bin$/.exec(String(url))![1]);return new Response(f.raw.slice(i*32,(i+1)*32));},{cache:f.cache,retries:0}),/整体校验/);assert.equal(f.rows.size,0);
});
test('earlier complete caches survive the new publication format, including HTTP-decoded gzip models',async()=>{
 const f=fixture(),decoded=new Uint8Array([103,108,84,70,3,4,5]);f.parts.decodedBytes=decoded.length;f.parts.decodedSHA256=sha(decoded);
 f.rows.set('complete',{data:decoded.buffer,start:0,end:decoded.length-1,total:decoded.length});
 const result=await downloadAssetParts('https://game.test/models/a.gz',f.parts,()=>{},async()=>{throw Error('existing complete model must not be downloaded again');},{cache:f.cache});
 assert.deepEqual(new Uint8Array(result.data),decoded);assert.equal(result.requests,0);
});
test('corrupt complete caches do not bypass the new integrity checks',async()=>{
 const f=fixture();f.rows.set('complete',{data:new Uint8Array(f.raw.length).buffer,start:0,end:f.raw.length-1,total:f.raw.length});
 const result=await downloadAssetParts('https://game.test/models/a',f.parts,()=>{},async url=>{const i=Number(/\/(\d+)\.bin$/.exec(String(url))![1]);return new Response(f.raw.slice(i*32,(i+1)*32));},{cache:f.cache});
 assert.deepEqual(new Uint8Array(result.data),f.raw);assert.equal(result.requests,5);
});

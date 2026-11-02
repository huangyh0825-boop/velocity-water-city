import {test} from 'node:test';import assert from 'node:assert/strict';
import {assetCache,settleAssetCacheMaintenance,requestAssetCacheMaintenance} from '../src/player/AssetCache';
function fixture(t:import('node:test').TestContext,usage?:number){
 const rows=new Map<string,Response>();let headerLookups=0,stall=false;
 const backend={match:async(key:string|Request)=>{if(key instanceof Request){headerLookups++;if(stall)return new Promise<Response>(()=>{});}return rows.get(typeof key==='string'?key:key.url)?.clone();},put:async(key:string,value:Response)=>{rows.set(key,value.clone());},keys:async()=>[...rows.keys()].map(k=>new Request(k)),delete:async(key:string|Request)=>rows.delete(typeof key==='string'?key:key.url)};
 const storage={open:async()=>backend} as unknown as CacheStorage,oldCaches=Object.getOwnPropertyDescriptor(globalThis,'caches'),oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'caches',{configurable:true,value:storage});Object.defineProperty(globalThis,'navigator',{configurable:true,value:usage===undefined?{}:{storage:{estimate:async()=>({usage})}}});
 t.after(async()=>{await settleAssetCacheMaintenance(storage);if(oldCaches)Object.defineProperty(globalThis,'caches',oldCaches);else Reflect.deleteProperty(globalThis,'caches');if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else Reflect.deleteProperty(globalThis,'navigator');});
 return{rows,storage,lookups:()=>headerLookups,stall:()=>{stall=true;}};
}
const value=(n:number)=>({data:new Uint8Array([n]).buffer,start:0,end:0,total:1});
test('under-budget stores avoid a full per-entry metadata scan on every downloaded texture',async t=>{
 const f=fixture(t,1024);for(let i=0;i<8;i++)await assetCache('https://game.test/texture-'+i,'v1',100)!.write('complete',value(i));await settleAssetCacheMaintenance(f.storage);assert.equal(f.rows.size,8);assert.equal(f.lookups(),0);const hit=await assetCache('https://game.test/texture-7','v1',100)!.read('complete');assert.equal(new Uint8Array(hit!.data)[0],7);
});
test('stalled eviction does not hold downloaded bytes or disable otherwise working cache reads and writes',async t=>{
 const f=fixture(t);f.stall();const cache=assetCache('https://game.test/asset','v1',20)!;await cache.write('complete',value(1));assert.equal(new Uint8Array((await cache.read('complete'))!.data)[0],1);await settleAssetCacheMaintenance(f.storage);await cache.write('complete',value(2));assert.equal(new Uint8Array((await cache.read('complete'))!.data)[0],2);assert.ok(f.lookups()>0);
});
test('background quota pruning still evicts the oldest assets and retains the new complete file',async t=>{
 const f=fixture(t,256*1024*1024);for(let i=0;i<7;i++)f.rows.set(`https://game.test/old-${i}?__water_asset=old&__water_part=complete`,new Response('old',{headers:{'x-asset-bytes':String(32*1024*1024),'x-asset-stored':String(i)}}));
 const cache=assetCache('https://game.test/new','v1',1000)!;await cache.write('complete',value(9));await settleAssetCacheMaintenance(f.storage);assert.equal(f.rows.has('https://game.test/old-0?__water_asset=old&__water_part=complete'),false);assert.equal(f.rows.has('https://game.test/old-1?__water_asset=old&__water_part=complete'),false);assert.equal(f.rows.size,6);assert.equal(new Uint8Array((await cache.read('complete'))!.data)[0],9);
});
test('the page can finish quota maintenance after a model worker has delivered its result',async t=>{
 const f=fixture(t,256*1024*1024);for(let i=0;i<7;i++)f.rows.set(`https://game.test/worker-${i}`,new Response('body',{headers:{'x-asset-bytes':String(32*1024*1024),'x-asset-stored':String(i)}}));await requestAssetCacheMaintenance(f.storage,1000);await settleAssetCacheMaintenance(f.storage);assert.equal(f.rows.size,6);assert.equal(f.rows.has('https://game.test/worker-0'),false);
});

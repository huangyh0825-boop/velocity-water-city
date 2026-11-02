/** Optional, versioned raw-byte cache. Never stores player data or changes art. */
export interface CachedAsset{data:ArrayBuffer;start:number;end:number;total:number;etag?:string}
export interface DownloadCache{read(part:string):Promise<CachedAsset|undefined>;write(part:string,value:CachedAsset):Promise<void>;clear():Promise<void>}
export const assetVersion=typeof __RUNTIME_ASSET_VERSION__==='string'?__RUNTIME_ASSET_VERSION__:undefined;
const NAME='velocity-water-assets-v1',MAX_BYTES=192*1024*1024;
interface CacheState{read:boolean;write:boolean;dirty:boolean;maintenance?:Promise<void>}
const availability=new WeakMap<CacheStorage,CacheState>();
async function cacheWork<T>(work:()=>Promise<T>,ms:number){let timer:ReturnType<typeof setTimeout>;try{return await Promise.race([work(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Asset storage unavailable')),ms);})]);}finally{clearTimeout(timer!);}}
function maintain(cache:Cache,state:CacheState,budgetMs:number){
 state.dirty=true;if(state.maintenance)return;
 state.maintenance=(async()=>{do{
  state.dirty=false;let usage:number|undefined;
  try{if(typeof navigator!=='undefined')usage=(await navigator.storage?.estimate?.())?.usage;}catch{/* Missing estimates use the bounded scan. */}
  if(usage!==undefined&&usage<=MAX_BYTES)continue;
  // Eviction is optional maintenance, never part of delivering downloaded
  // bytes. A slow scan must not disable an otherwise working asset cache.
  await cacheWork(async()=>{const rows=await Promise.all((await cache.keys()).map(async r=>{const hit=await cache.match(r);return{r,bytes:Number(hit?.headers.get('x-asset-bytes'))||0,time:Number(hit?.headers.get('x-asset-stored'))||0};}));let total=rows.reduce((n,r)=>n+r.bytes,0);for(const row of rows.sort((a,b)=>a.time-b.time)){if(total<=MAX_BYTES)break;await cache.delete(row.r);total-=row.bytes;}},budgetMs).catch(()=>{});
 }while(state.dirty);})().finally(()=>{state.maintenance=undefined;if(state.dirty)maintain(cache,state,budgetMs);});
}
/** Test/diagnostic drain; normal loading never waits for cache eviction. */
export async function settleAssetCacheMaintenance(storage?:CacheStorage){const target=storage??(typeof caches==='undefined'?undefined:caches);if(target){const state=availability.get(target);while(state?.maintenance)await state.maintenance;}}
/** Model workers transfer their result and can terminate before maintenance.
 * Request the same coalesced, optional check in the surviving page context. */
export async function requestAssetCacheMaintenance(storage?:CacheStorage,budgetMs=5000){
 const target=storage??(typeof caches==='undefined'?undefined:caches);if(!target)return;
 const state=availability.get(target)??{read:true,write:true,dirty:false};availability.set(target,state);if(!state.write)return;
 try{const cache=await cacheWork(()=>target.open(NAME),budgetMs);maintain(cache,state,budgetMs);}catch{/* Optional maintenance never changes transport availability. */}
}
export function assetCache(url:string,version=assetVersion,budgetMs=5000):DownloadCache|undefined{
 if(!version||typeof caches==='undefined'||!/^https?:/.test(url))return;
 const state=availability.get(caches)??{read:true,write:true,dirty:false};availability.set(caches,state);
 const key=(part:string)=>{const u=new URL(url);u.searchParams.set('__water_asset',version);u.searchParams.set('__water_part',part);return u.href;};
 const belongs=(r:Request)=>{const u=new URL(r.url),original=new URL(url);return u.origin===original.origin&&u.pathname===original.pathname&&u.searchParams.get('__water_asset')===version;};
 return {
  async read(part){if(!state.read)return;try{return await cacheWork(async()=>{const cache=await caches.open(NAME),response=await cache.match(key(part));if(!response)return;const data=await response.arrayBuffer(),start=Number(response.headers.get('x-asset-start')),end=Number(response.headers.get('x-asset-end')),total=Number(response.headers.get('x-asset-total'));
   if(!Number.isSafeInteger(total)||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>=total||end-start+1!==data.byteLength||(part==='complete'&&(start!==0||end!==total-1))){await cache.delete(key(part));return;}return{data,start,end,total,etag:response.headers.get('etag')??undefined};},budgetMs);}catch{state.read=state.write=false;return;}},
  async write(part,value){if(!state.write)return;try{await cacheWork(async()=>{const cache=await caches.open(NAME);await cache.put(key(part),new Response(value.data,{headers:{'x-asset-start':String(value.start),'x-asset-end':String(value.end),'x-asset-total':String(value.total),'x-asset-bytes':String(value.data.byteLength),'x-asset-stored':String(Date.now()),...(value.etag?{etag:value.etag}:{})}}));
   if(part==='complete'){
    for(const r of await cache.keys())if(belongs(r)&&new URL(r.url).searchParams.get('__water_part')!=='complete')await cache.delete(r);
    maintain(cache,state,budgetMs);
   }
  },budgetMs);}catch{state.write=false;/* Storage unavailable/full is never a download failure. */}},
  async clear(){if(!state.read)return;try{await cacheWork(async()=>{const cache=await caches.open(NAME);for(const r of await cache.keys())if(belongs(r))await cache.delete(r);},budgetMs);}catch{state.read=state.write=false;}},
 };
}

import{assetProgress,assetRetry,assetRequest}from'../core/AssetActivity';import{downloadModel}from'./downloadModel';import{assetCache,assetVersion}from'./AssetCache';
const pending:(()=>void)[]=[],inflight=new Map<string,Promise<ArrayBuffer>>();let active=0;
async function slot<T>(task:()=>Promise<T>){if(active>=3)await new Promise<void>(resolve=>pending.push(resolve));else active++;try{return await task();}finally{const next=pending.shift();if(next)next();else active--;}}
export async function fetchAssetBytes(url:string,backgroundWorker=false):Promise<ArrayBuffer>{
 let promise=inflight.get(url);if(promise)return promise;
 assetRequest(1);promise=slot(async()=>{
  if(!backgroundWorker||typeof Worker==='undefined'){
   const {data}=await downloadModel(url,assetProgress,fetch,1024*1024,{cache:assetCache(url),inspectEncoding:url.endsWith('.gz'),onRetry:assetRetry});return backgroundWorker?decompressModel(data):data;
  }
  return new Promise<ArrayBuffer>((resolve,reject)=>{
   const start=performance.now(),worker=new Worker(new URL('./ModelTransport.worker.ts',import.meta.url),{type:'module'});let timeout:ReturnType<typeof setTimeout>;
   const hidden=()=>typeof document!=='undefined'&&document.hidden;
   const heartbeat=()=>{clearTimeout(timeout);timeout=setTimeout(()=>{if(hidden())heartbeat();else{finish();reject(Error('资源下载长时间没有进展，请重试；已完成片段会保留'));}},120000);};
   const visibility=()=>{worker.postMessage({type:'visibility',hidden:hidden()});heartbeat();};
   const finish=()=>{clearTimeout(timeout);worker.terminate();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visibility);};heartbeat();
   if(typeof document!=='undefined')document.addEventListener('visibilitychange',visibility);
   worker.onmessage=event=>{const value=event.data;if(value.retry){assetRetry();return;}if(value.progress){assetProgress(value.bytes??0,value.cached??false);heartbeat();return;}finish();if(value.error)reject(Error(value.error));else{assetProgress();performance.measure('model-transport',{start,detail:{url,transportBytes:value.transportBytes}});resolve(value.data);}};
   worker.onerror=event=>{finish();reject(Error(event.message||'模型解压失败'));};worker.postMessage({url,version:assetVersion,hidden:hidden()});
  });
 }).finally(()=>{inflight.delete(url);assetRequest(-1);});inflight.set(url,promise);return promise;
}
export async function decompressModel(data:ArrayBuffer){const bytes=new Uint8Array(data);return bytes[0]===0x1f&&bytes[1]===0x8b?new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():data;}
export const fetchRuntimeModel=(url:string)=>fetchAssetBytes(url,true);

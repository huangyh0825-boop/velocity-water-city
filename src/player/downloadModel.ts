import{readWithActivity}from'./readWithActivity';import type{DownloadCache,CachedAsset}from'./AssetCache';
export interface DownloadOptions{cache?:DownloadCache;headerMs?:number;idleMs?:number;headMs?:number;retries?:number;retryDelayMs?:number;inspectEncoding?:boolean;onRetry?:(attempt:number)=>void;isBackground?:()=>boolean;parallelism?:number;whole?:boolean}
interface Part extends CachedAsset{partial:boolean;transportBytes:number|null}
/** Byte-exact, bounded retries; checkpoints survive interrupted page loads. */
export async function downloadModel(url:string,onProgress:(bytes:number,cached?:boolean)=>void,fetcher:typeof fetch=fetch,chunkSize=1024*1024,options:DownloadOptions={}){
 const cache=options.cache,whole=await cache?.read('complete');if(whole){onProgress(whole.data.byteLength,true);return{data:whole.data,sourceBytes:whole.data.byteLength,transportBytes:0,requests:0,ranged:false};}
 // A small first range survives buffering proxies that stall larger responses.
 // Fast links may grow to the caller's budget; a failed range shrinks again.
 let requests=0,rangeBytes=Math.min(chunkSize,256*1024);const wholeEncodedBody=Symbol('whole encoded body'),background=options.isBackground??(()=>typeof document!=='undefined'&&document.hidden);
 const guarded=async<T>(ms:number,run:(signal:AbortSignal,activity:(ms?:number)=>void)=>Promise<T>)=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>,delay=ms;
  const arm=(next=delay)=>{delay=next;clearTimeout(timer);timer=setTimeout(()=>{if(background())arm();else controller.abort(Error('资源连接暂时中断，正在重试'));},delay);};arm();
  const aborted=new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(controller.signal.reason),{once:true}));
  try{return await Promise.race([run(controller.signal,arm),aborted]);}finally{clearTimeout(timer!);}
 };
 const part=async(start?:number,etag?:string,end?:number):Promise<Part>=>{
  if(start!==undefined){const saved=await cache?.read(String(start));if(saved&&saved.start===start&&(!etag||!saved.etag||saved.etag===etag)){
   // Older checkpoints may be wider than this download's assigned interval.
   // Reuse only that interval so parallel workers never overlap or skip bytes.
   const last=Math.min(saved.end,end??saved.end),data=last===saved.end?saved.data:saved.data.slice(0,last-start+1);
   onProgress(data.byteLength,true);return{...saved,data,end:last,partial:true,transportBytes:0};
  }}
  for(let attempt=0;;attempt++)try{
   const began=performance.now();return await guarded(options.headerMs??20000,async(signal,activity)=>{
    requests++;const headers:Record<string,string>={};if(start!==undefined)headers.Range=`bytes=${start}-${Math.min(start+rangeBytes-1,end??Infinity)}`;if(etag&&!etag.startsWith('W/'))headers['If-Range']=etag;
    const response=await fetcher(url,{signal,headers});activity(options.idleMs??30000);
    if(!response.ok)throw Error(`资源下载失败 (${response.status})`);
    if(response.status===206&&response.headers.get('content-encoding')){await response.body?.cancel();if(start===undefined)throw Error('服务器返回了不完整的压缩资源');throw wholeEncodedBody;}
    const tag=response.headers.get('etag')??undefined;if(etag&&tag&&tag!==etag){await response.body?.cancel();await cache?.clear();throw Error('资源版本已更新，请刷新网页');}
    const data=await readWithActivity(response,n=>onProgress(n),()=>activity());
    if(response.status===206){const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range')??'');if(!range||Number(range[1])!==start||Number(range[2])-Number(range[1])+1!==data.byteLength||Number(range[2])>=Number(range[3])||(end!==undefined&&Number(range[2])>end))throw Error('资源片段不完整');const value={data,start:Number(range[1]),end:Number(range[2]),total:Number(range[3]),etag:tag};await cache?.write(String(start),value);if(performance.now()-began<100&&data.byteLength>=rangeBytes)rangeBytes=Math.min(chunkSize,rangeBytes*2);return{...value,partial:true,transportBytes:null};}
    const expected=Number(response.headers.get('content-length'));if(expected&&!response.headers.get('content-encoding')&&expected!==data.byteLength)throw Error('资源内容不完整');
    return{data,start:0,end:data.byteLength-1,total:data.byteLength,etag:tag,partial:false,transportBytes:expected||null};
   });
  }catch(error){if(error===wholeEncodedBody)return part();/* The range guard must be cleared before a long, progressing whole response. */if(String(error).includes('资源版本已更新')||attempt>=(options.retries??3))throw error;if(start!==undefined)rangeBytes=Math.min(rangeBytes,256*1024);options.onRetry?.(attempt+1);await new Promise(r=>setTimeout(r,(options.retryDelayMs??500)*(attempt+1)));}
 };
 let encoded=false;
 if(!options.whole&&options.inspectEncoding!==false)try{encoded=await guarded(options.headMs??5000,async signal=>{requests++;const metadata=await fetcher(url,{method:'HEAD',signal});const result=metadata.ok&&!!metadata.headers.get('content-encoding');await metadata.body?.cancel();return result;});}catch{encoded=false;/* Unknown encoding still probes ranges; part() handles encoded replies. */}
 const first=await part(options.whole||encoded?undefined:0);let data=first.data;
 if(first.partial){const bytes=new Uint8Array(first.total);bytes.set(new Uint8Array(first.data));let next=first.end+1,complete:Part|undefined;
  // Three asset slots in ModelTransport, at most two requests per asset: six
  // network bodies total, including model workers. Keep small proxy-safe parts
  // in flight instead of serializing an RTT (and cache write) for every 256 KiB.
  const parallelism=Math.max(1,Math.min(2,Math.floor(options.parallelism??2)));
  while(next<bytes.length&&!complete){
   const jobs:Promise<void>[]=[];
   for(let i=0;i<parallelism&&next<bytes.length;i++){
    const start=next,end=Math.min(bytes.length-1,start+rangeBytes-1);next=end+1;
    jobs.push((async()=>{let offset=start;while(offset<=end){
     const chunk=await part(offset,first.etag,end);
     if(!chunk.partial){if(chunk.total!==bytes.length)throw Error('资源下载内容发生变化，请刷新网页');complete=chunk;return;}
     if(chunk.total!==bytes.length||chunk.start!==offset||chunk.end<offset||chunk.end>end)throw Error('资源下载内容发生变化，请刷新网页');
     bytes.set(new Uint8Array(chunk.data),offset);offset=chunk.end+1;
    }})());
   }
   // Drain both writers before clearing a changed revision. A late successful
   // response must not repopulate the cache after its sibling invalidates it.
   const settled=await Promise.allSettled(jobs),failed=settled.find(r=>r.status==='rejected');
   if(failed?.status==='rejected'){if(String(failed.reason).includes('变化')||String(failed.reason).includes('版本已更新'))await cache?.clear();throw failed.reason;}
  }
  data=complete?.data??bytes.buffer;
 }
 await cache?.write('complete',{data,start:0,end:data.byteLength-1,total:data.byteLength,etag:first.etag});
 return{data,sourceBytes:data.byteLength,transportBytes:first.partial?null:first.transportBytes,requests,ranged:first.partial};
}

import {downloadModel,type DownloadOptions} from './downloadModel';
export interface AssetParts {bytes:number;partBytes:number;sha256:string;hashes:string[];decodedBytes?:number;decodedSHA256?:string;brotli?:AssetParts}
export type AssetPartManifest=Record<string,AssetParts>;
const manifest:AssetPartManifest=typeof __RUNTIME_ASSET_PARTS__==='undefined'?{}:__RUNTIME_ASSET_PARTS__;
export function assetParts(url:string){
 const parsed=new URL(url),index=parsed.pathname.lastIndexOf('/models/');
 return index<0?undefined:manifest[decodeURIComponent(parsed.pathname.slice(index+1))];
}
const hash=async(data:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
type Progress=(bytes:number,cached?:boolean)=>void;
type PublishedOptions=DownloadOptions & {
 brotliCache?:DownloadOptions['cache'];
 decodeBrotli?:(data:ArrayBuffer)=>Promise<ArrayBuffer>;
};

async function readComplete(parts:AssetParts,onProgress:Progress,cache:DownloadOptions['cache']){
 const whole=await cache?.read('complete');
 // Earlier hosts may have applied HTTP gzip decoding before storing a model.
 // Accept those exact decoded bytes too, preserving already downloaded caches.
 const expectedWhole=whole?.data.byteLength===parts.bytes?parts.sha256:whole?.data.byteLength===parts.decodedBytes?parts.decodedSHA256:undefined;
 if(whole&&expectedWhole&&await hash(whole.data)===expectedWhole){onProgress(whole.data.byteLength,true);return{data:whole.data,sourceBytes:whole.data.byteLength,transportBytes:0,requests:0,ranged:false};}
 if(whole)await cache?.clear();
}
/** Ordinary immutable GET files, reassembled and verified before decoding. */
export async function downloadAssetParts(url:string,parts:AssetParts,onProgress:Progress,fetcher:typeof fetch=fetch,options:DownloadOptions={}){
 const cache=options.cache,cached=await readComplete(parts,onProgress,cache);
 if(cached)return cached;
 if(parts.hashes.length!==Math.ceil(parts.bytes/parts.partBytes)||parts.partBytes<1)throw Error('资源分片清单无效');
 const bytes=new Uint8Array(parts.bytes),etag='"sha256-'+parts.sha256+'"';let cursor=0,requests=0,networkBytes=0,failed:unknown;
 const worker=async()=>{while(cursor<parts.hashes.length&&!failed){
  const index=cursor++,start=index*parts.partBytes,end=Math.min(parts.bytes,start+parts.partBytes)-1,key='segment:'+start,expected=parts.hashes[index];
  try{
   const saved=await cache?.read(key);
   if(saved&&saved.start===start&&saved.end===end&&saved.total===parts.bytes&&saved.etag===etag&&await hash(saved.data)===expected){bytes.set(new Uint8Array(saved.data),start);onProgress(saved.data.byteLength,true);continue;}
   const base=new URL(url);base.pathname=base.pathname.slice(0,base.pathname.lastIndexOf('/models/')+1);base.search=base.hash='';
   const partURL=new URL('asset-parts/'+parts.sha256+'/'+index+'.bin',base).href;
   for(let attempt=0;;attempt++){
    try{
     // downloadModel provides foreground-aware idle/header deadlines. Retry
     // integrity failures too, not only errors obtaining a response body.
     const result=await downloadModel(partURL,n=>{networkBytes+=n;onProgress(n);},async(u,init)=>{requests++;return fetcher(u,init);},parts.partBytes,{...options,cache:undefined,whole:true,retries:0});
     if(result.data.byteLength!==end-start+1||await hash(result.data)!==expected)throw Error('资源分片校验失败');
     bytes.set(new Uint8Array(result.data),start);await cache?.write(key,{data:result.data,start,end,total:parts.bytes,etag});break;
    }catch(error){if(attempt>=(options.retries??2)||String(error).includes('(404)'))throw error;options.onRetry?.(attempt+1);await new Promise(r=>setTimeout(r,(options.retryDelayMs??500)*(attempt+1)));}
   }
  }catch(error){failed=error;}
 }};
 // ModelTransport limits concurrent assets; each gets at most two parts.
 await Promise.all([worker(),worker()]);if(failed)throw failed;
 const data=bytes.buffer;if(await hash(data)!==parts.sha256){await cache?.clear();throw Error('资源整体校验失败');}
 await cache?.write('complete',{data,start:0,end:parts.bytes-1,total:parts.bytes,etag});
 return{data,sourceBytes:parts.bytes,transportBytes:networkBytes,requests,ranged:false};
}
function brotliStream(){
 try{return new DecompressionStream('brotli' as CompressionFormat);}catch{return undefined;}
}

export async function downloadTransportVariants(url:string,parts:AssetParts,onProgress:Progress,fetcher:typeof fetch=fetch,options:PublishedOptions={}){
 const stream=parts.brotli&&brotliStream();
 if(parts.brotli&&(stream||options.decodeBrotli)){
  const cached=await readComplete(parts,onProgress,options.cache);
  if(cached)return cached;
  try{
   const packed=await downloadAssetParts(url,parts.brotli,onProgress,fetcher,{
    ...options,cache:options.brotliCache,headerMs:options.headerMs??10000,idleMs:options.idleMs??15000,retries:1,
   });
   const data=stream
    ?await new Response(new Blob([packed.data]).stream().pipeThrough(stream)).arrayBuffer()
    :await options.decodeBrotli!(packed.data);
   if(data.byteLength!==parts.decodedBytes||await hash(data)!==parts.decodedSHA256)throw Error('解压后的模型校验失败');
   return {...packed,data,sourceBytes:data.byteLength};
  }catch{
   // Keep partial checkpoints, and use the previous byte-identical transport.
   options.onRetry?.(1);
  }
 }
 return downloadAssetParts(url,parts,onProgress,fetcher,options);
}

export async function downloadPublishedAsset(url:string,onProgress:Progress,fetcher:typeof fetch=fetch,options:PublishedOptions={}){
 const parts=assetParts(url);
 if(parts)try{return await downloadTransportVariants(url,parts,onProgress,fetcher,options);}catch{options.onRetry?.(1);/* Original files support older mirrors and failed static parts. */}
 return downloadModel(url,onProgress,fetcher,1024*1024,options);
}

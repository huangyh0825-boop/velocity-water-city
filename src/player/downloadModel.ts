import{readWithActivity}from'./readWithActivity';
interface Part{response:Response;data:ArrayBuffer;start:number;end:number;total:number}
/** Retry incomplete chunks; preserve every byte and support plain servers. */
export async function downloadModel(url:string,onProgress:()=>void,fetcher:typeof fetch=fetch,chunkSize=4*1024*1024){
 let requests=0;
 const part=async(start?:number):Promise<Part>=>{
  for(let attempt=0;;attempt++)try{
   requests++;const response=await fetcher(url,start===undefined?undefined:{headers:{Range:`bytes=${start}-${start+chunkSize-1}`}});
   if(!response.ok)throw Error(`模型下载失败 (${response.status})`);
   if(response.status===206&&response.headers.get('content-encoding')){await response.body?.cancel();return part();}
   const data=await readWithActivity(response,onProgress);
   if(response.status===206){const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range')??'');if(!range||Number(range[1])!==start||Number(range[2])-Number(range[1])+1!==data.byteLength||Number(range[2])>=Number(range[3]))throw Error('模型片段不完整');return{response,data,start:Number(range[1]),end:Number(range[2]),total:Number(range[3])};}
   return{response,data,start:0,end:data.byteLength-1,total:data.byteLength};
  }catch(error){if(attempt>=2)throw error;await new Promise(r=>setTimeout(r,500*(attempt+1)));}
 };
 // Some servers label .gz responses Content-Encoding:gzip. Browsers can reject
 // a partial gzip body before exposing its headers, so inspect HEAD first.
 let encoded=false;try{requests++;const metadata=await fetcher(url,{method:'HEAD'});encoded=metadata.ok&&!!metadata.headers.get('content-encoding');await metadata.body?.cancel();}catch{/* HEAD is optional; a plain GET still works. */}
 const first=await part(encoded?undefined:0);if(first.response.status!==206)return{data:first.data,sourceBytes:first.data.byteLength,transportBytes:Number(first.response.headers.get('content-length'))||null,requests,ranged:false};
 const bytes=new Uint8Array(first.total);bytes.set(new Uint8Array(first.data));let next=first.end+1;
 while(next<bytes.length){const chunk=await part(next);if(chunk.response.status!==206||chunk.total!==bytes.length||chunk.start!==next)throw Error('模型下载内容发生变化，请重试');bytes.set(new Uint8Array(chunk.data),next);next=chunk.end+1;}
 // Failed partial transfers are not fully observable: keep exact file size,
 // not an invented encoded network-byte total.
 return{data:bytes.buffer,sourceBytes:bytes.byteLength,transportBytes:null,requests,ranged:true};
}

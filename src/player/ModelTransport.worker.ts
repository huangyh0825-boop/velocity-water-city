// Network decompression never occupies the game/UI thread.
self.onmessage=async(event:MessageEvent<string>)=>{
 try{
  const response=await fetch(event.data);if(!response.ok)throw Error(`模型下载失败 (${response.status})`);
  let data=await readWithActivity(response,()=>self.postMessage({progress:true}));const bodyBytes=data.byteLength;
  // A server may set Content-Encoding:gzip and let fetch decompress for us.
  // Decoded body size must not be reported as compressed network transfer.
  const timing=performance.getEntriesByName(event.data).at(-1) as PerformanceResourceTiming|undefined;
  const transportBytes=timing?.encodedBodySize||Number(response.headers.get('content-length'))||(response.headers.get('content-encoding')?null:bodyBytes);
  if(new Uint8Array(data,0,2)[0]===0x1f&&new Uint8Array(data,0,2)[1]===0x8b)data=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  self.postMessage({data,transportBytes,bodyBytes},{transfer:[data]});
 }catch(error){self.postMessage({error:String(error)});}
};
import{readWithActivity}from'./readWithActivity';

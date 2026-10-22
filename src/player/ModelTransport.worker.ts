import{downloadModel}from'./downloadModel';import{assetCache}from'./AssetCache';
let hidden=false;
// Download/retry/decompression remain off the game/UI thread.
self.onmessage=async(event:MessageEvent<{type?:string;url:string;version?:string;hidden:boolean}>)=>{
 hidden=event.data.hidden;if(event.data.type==='visibility')return;
 try{
  const {url,version}=event.data,result=await downloadModel(url,(bytes,cached)=>self.postMessage({progress:true,bytes,cached}),fetch,1024*1024,{cache:assetCache(url,version),inspectEncoding:url.endsWith('.gz'),isBackground:()=>hidden,onRetry:()=>self.postMessage({retry:true})}),bodyBytes=result.data.byteLength;
  const bytes=new Uint8Array(result.data);if(bytes[0]===0x1f&&bytes[1]===0x8b)result.data=await new Response(new Blob([result.data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  self.postMessage({...result,bodyBytes},{transfer:[result.data]});
 }catch(error){self.postMessage({error:String(error)});}
};

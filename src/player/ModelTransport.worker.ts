import{downloadModel}from'./downloadModel';
// Network retries and decompression never occupy the game/UI thread.
self.onmessage=async(event:MessageEvent<string>)=>{
 try{
  const result=await downloadModel(event.data,()=>self.postMessage({progress:true})),bodyBytes=result.data.byteLength;
  if(new Uint8Array(result.data,0,2)[0]===0x1f&&new Uint8Array(result.data,0,2)[1]===0x8b)result.data=await new Response(new Blob([result.data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  self.postMessage({...result,bodyBytes},{transfer:[result.data]});
 }catch(error){self.postMessage({error:String(error)});}
};

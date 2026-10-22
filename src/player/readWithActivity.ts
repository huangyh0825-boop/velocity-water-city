/** Preserve the exact response bytes while signalling forward progress. */
export async function readWithActivity(response:Response,onProgress:(bytes:number)=>void,onChunk?:()=>void):Promise<ArrayBuffer>{
 if(!response.body){const data=await response.arrayBuffer();onProgress(data.byteLength);return data;}let last=-Infinity,pending=0;
 const stream=response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){onChunk?.();pending+=chunk.byteLength;const now=performance.now();if(now-last>=250){onProgress(pending);pending=0;last=now;}controller.enqueue(chunk);}}));
 const data=await new Response(stream).arrayBuffer();if(pending)onProgress(pending);return data;
}

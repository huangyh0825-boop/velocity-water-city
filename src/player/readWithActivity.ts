/** Preserve the exact response bytes while signalling forward progress. */
export async function readWithActivity(response:Response,onProgress:()=>void):Promise<ArrayBuffer>{
 if(!response.body)return response.arrayBuffer();let last=-Infinity;
 const stream=response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){const now=performance.now();if(now-last>=250){onProgress();last=now;}controller.enqueue(chunk);}}));
 const data=await new Response(stream).arrayBuffer();onProgress();return data;
}

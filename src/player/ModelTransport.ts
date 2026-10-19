export async function fetchRuntimeModel(url:string):Promise<ArrayBuffer>{
 if(typeof Worker==='undefined'){
  const response=await fetch(url);if(!response.ok)throw Error(`模型下载失败 (${response.status})`);
  const data=await response.arrayBuffer(),bytes=new Uint8Array(data);
  return bytes[0]===0x1f&&bytes[1]===0x8b?new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():data;
 }
 return new Promise((resolve,reject)=>{
  const start=performance.now(),worker=new Worker(new URL('./ModelTransport.worker.ts',import.meta.url),{type:'module'});
  const timeout=setTimeout(()=>{worker.terminate();reject(Error('模型下载超时，请重试'));},120000);
  const finish=()=>{clearTimeout(timeout);worker.terminate();};
  worker.onmessage=event=>{finish();if(event.data.error)reject(Error(event.data.error));else{performance.measure('model-transport',{start,detail:{url,transportBytes:event.data.transportBytes}});resolve(event.data.data);}};
  worker.onerror=event=>{finish();reject(Error(event.message||'模型解压失败'));};worker.postMessage(url);
 });
}

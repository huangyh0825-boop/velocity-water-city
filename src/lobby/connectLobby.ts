import {LobbyFault} from './protocol';

type Transport='http'|'websocket';
interface Options {
 base:string;signal:AbortSignal;progress:(message:string)=>void;
 connect:(transport:Transport)=>Promise<void>;
 timeoutMs?:number;requestTimeoutMs?:number;retryDelayMs?:number;
}
const cancelled=()=>new DOMException('已取消连接','AbortError');
function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T> {
 if(signal.aborted)return Promise.reject(cancelled());
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(cancelled());signal.addEventListener('abort',abort,{once:true});
  promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });
}
function pause(ms:number,signal:AbortSignal) {
 return new Promise<void>((resolve,reject)=>{
  if(signal.aborted){reject(cancelled());return;}
  const abort=()=>{clearTimeout(timer);reject(cancelled());};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
  signal.addEventListener('abort',abort,{once:true});
 });
}
/** Bounded, user-initiated wake-up only; no background polling or keep-alive service. */
export async function connectLobby(options:Options) {
 const {base,signal:external,progress,connect}=options;
 const started=performance.now(),controller=new AbortController(),signal=controller.signal;
 let attempts=0,phase='正在连接大厅；服务休眠时首次唤醒约需一分钟';
 const notify=()=>progress(`${phase}…已等待 ${Math.floor((performance.now()-started)/1000)} 秒，可取消`);
 const cancel=()=>controller.abort();external.addEventListener('abort',cancel,{once:true});if(external.aborted)cancel();
 const deadline=setTimeout(cancel,options.timeoutMs??180_000),ticker=setInterval(notify,1000);
 let lastError='';
 try {
  while(!signal.aborted) {
   notify();
   try {
    const request=new AbortController(),stop=()=>request.abort();signal.addEventListener('abort',stop,{once:true});
    const timeout=setTimeout(()=>request.abort(),options.requestTimeoutMs??20_000);
    let transport:Transport;
    try {
     const response=await fetch(base+'/health',{signal:request.signal,cache:'no-store'});
     const data=await response.json().catch(()=>null);
     if(!response.ok){
      if(response.status>=400&&response.status<500&&response.status!==408)throw new LobbyFault(response.status,data?.error??`大厅请求失败（HTTP ${response.status}）`);
      throw Error(`大厅尚未就绪（HTTP ${response.status}）`);
     }
     if(!data||data.ok!==true)throw Error('大厅正在启动，尚未返回健康状态');
     if(data.transport==='websocket'&&data.protocol!==1)throw new LobbyFault(400,'大厅通信版本不兼容，请刷新网页');
     if(data.transport!==undefined&&data.transport!=='websocket')throw new LobbyFault(400,'大厅通信方式不兼容');
     transport=data.transport==='websocket'?'websocket':'http';
    }finally{clearTimeout(timeout);signal.removeEventListener('abort',stop);}
    if(signal.aborted)throw cancelled();
    phase='大厅已唤醒，正在加入房间';notify();
    await abortable(connect(transport),signal);return;
   }catch(error){
    if(signal.aborted)break;
    if(error instanceof LobbyFault&&error.status<500&&error.status!==408)throw error;
    lastError=error instanceof Error?error.message:'连接失败';
    phase=`连接暂未成功，正在重试（第 ${++attempts} 次）`;
    await pause(options.retryDelayMs??Math.min(10_000,1000*2**Math.min(attempts,3)),signal);
   }
  }
 }catch(error){if(!signal.aborted)throw error;}
 finally{clearTimeout(deadline);clearInterval(ticker);external.removeEventListener('abort',cancel);}
 if(external.aborted)throw cancelled();
 throw Error(`大厅连接超时，请重新尝试${lastError?`；${lastError}`:''}`);
}

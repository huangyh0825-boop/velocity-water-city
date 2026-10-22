/** Background-tab suspension must not consume a foreground GPU warmup budget. */
export function foregroundDeadline<T>(work:Promise<T>,ms:number,message:string){
 let remaining=ms,last=performance.now(),visible=typeof document==='undefined'||!document.hidden,timer:ReturnType<typeof setTimeout>;
 let expire:(reason:Error)=>void;const deadline=new Promise<never>((_,reject)=>{expire=reject;});
 const schedule=()=>{clearTimeout(timer);if(visible)timer=setTimeout(()=>expire(Error(message)),Math.max(0,remaining));};
 const visibility=()=>{const now=performance.now();if(visible)remaining-=now-last;last=now;visible=!document.hidden;schedule();};
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',visibility);schedule();
 return Promise.race([work,deadline]).finally(()=>{clearTimeout(timer);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visibility);});
}

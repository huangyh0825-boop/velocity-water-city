import{DefaultLoadingManager,type LoadingManager}from'three';
let lastProgress=0,networkBytes=0,cachedBytes=0,retries=0,pending=0;
const listeners=new Set<(s:ReturnType<typeof assetSnapshot>)=>void>();
export function assetSnapshot(){return{networkBytes,cachedBytes,retries,pending};}
const notify=()=>{const s=assetSnapshot();listeners.forEach(f=>f(s));};
export function observeAssets(listener:(s:ReturnType<typeof assetSnapshot>)=>void){listeners.add(listener);listener(assetSnapshot());return()=>{listeners.delete(listener);};}
export function assetProgress(bytes=0,cached=false){lastProgress=performance.now();if(cached)cachedBytes+=bytes;else networkBytes+=bytes;notify();}
export function assetRequest(delta:number){pending=Math.max(0,pending+delta);notify();}
export function assetRetry(){retries++;notify();}
export function assetWaitExpired(start:number,now=performance.now()){
 // An active slow download is not a failure, even after ten minutes. Requests
 // have their own finite idle/header deadlines and bounded retry counts.
 return !(typeof document!=='undefined'&&document.hidden)&&now-Math.max(start,lastProgress)>120000;
}
export function watchAssetActivity(manager:LoadingManager=DefaultLoadingManager){
 networkBytes=cachedBytes=retries=0;assetProgress();
 const resume=()=>{if(!document.hidden)assetProgress();};if(typeof document!=='undefined')document.addEventListener('visibilitychange',resume);
 const previous=manager.onProgress,observe:typeof manager.onProgress=(url,loaded,total)=>{assetProgress();previous?.call(manager,url,loaded,total);};
 manager.onProgress=observe;return()=>{if(manager.onProgress===observe)manager.onProgress=previous;if(typeof document!=='undefined')document.removeEventListener('visibilitychange',resume);};
}

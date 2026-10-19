import{DefaultLoadingManager,type LoadingManager}from'three';
let lastProgress=0;
export function assetProgress(){lastProgress=performance.now();}
export function assetWaitExpired(start:number,now=performance.now()){
 // Keep a finite overall deadline, but don't mistake active slow downloads for
 // an idle connection. Applies only before play; no per-frame work is added.
 return now-start>600000||now-Math.max(start,lastProgress)>120000;
}
export function watchAssetActivity(manager:LoadingManager=DefaultLoadingManager){
 const previous=manager.onProgress,observe:typeof manager.onProgress=(url,loaded,total)=>{assetProgress();previous?.call(manager,url,loaded,total);};
 manager.onProgress=observe;return()=>{if(manager.onProgress===observe)manager.onProgress=previous;};
}

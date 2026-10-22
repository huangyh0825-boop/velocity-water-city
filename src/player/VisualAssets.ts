import * as THREE from 'three';import {loadAssetGLTF} from './AssetGLTF';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
// Decode on background threads; keep at least one core for the UI and driver.
if(typeof Worker!=='undefined')MeshoptDecoder.useWorkers(Math.min(2,Math.max(1,(navigator.hardwareConcurrency||2)-1)));
const cache=new Map<string,Promise<THREE.Group>>();
export async function loadVisual(name:'watercraft'|'rider',low:boolean){
 const mobile=!low&&typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
 const key=`${name}${low?'-low':mobile?'-mobile':''}`;let promise=cache.get(key);
 if(!promise){
  const base=new URL(`${import.meta.env.BASE_URL}models/`,document.baseURI).href;
  promise=loadAssetGLTF(`${base}${key}${low?'.glb':`${mobile?'':'-packed'}.glb.gz`}`,loader=>loader.setMeshoptDecoder(MeshoptDecoder)).then(g=>g.scene).catch(error=>{cache.delete(key);throw error;});cache.set(key,promise);
 }
 const result=clone(await promise),skeletons=new Map<string,THREE.Skeleton>();
 result.userData.visualAsset=key;
 result.traverse(o=>{if(o instanceof THREE.SkinnedMesh){const key=o.skeleton.bones.map(b=>b.uuid).join('|'),shared=skeletons.get(key);if(shared)o.skeleton=shared;else skeletons.set(key,o.skeleton);}});
 return result;
}
if(import.meta.hot)import.meta.hot.dispose(()=>MeshoptDecoder.useWorkers(0));

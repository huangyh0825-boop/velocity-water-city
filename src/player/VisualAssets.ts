import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {fetchRuntimeModel} from './ModelTransport';
// Decode on background threads; keep at least one core for the UI and driver.
if(typeof Worker!=='undefined')MeshoptDecoder.useWorkers(Math.min(2,Math.max(1,(navigator.hardwareConcurrency||2)-1)));
const cache=new Map<string,Promise<THREE.Group>>();
export async function loadVisual(name:'watercraft'|'rider',low:boolean){
 const key=`${name}${low?'-low':''}`;let promise=cache.get(key);
 if(!promise){
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),base=new URL(`${import.meta.env.BASE_URL}models/`,document.baseURI).href;
  promise=(low?loader.loadAsync(`${base}${key}.glb`):fetchRuntimeModel(`${base}${key}-packed.glb.gz`).then(data=>loader.parseAsync(data,base))).then(g=>g.scene).catch(error=>{cache.delete(key);throw error;});cache.set(key,promise);
 }
 const result=clone(await promise),skeletons=new Map<string,THREE.Skeleton>();
 result.userData.visualAsset=key;
 result.traverse(o=>{if(o instanceof THREE.SkinnedMesh){const key=o.skeleton.bones.map(b=>b.uuid).join('|'),shared=skeletons.get(key);if(shared)o.skeleton=shared;else skeletons.set(key,o.skeleton);}});
 return result;
}
if(import.meta.hot)import.meta.hot.dispose(()=>MeshoptDecoder.useWorkers(0));

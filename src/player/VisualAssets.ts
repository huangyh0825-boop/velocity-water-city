import * as THREE from 'three';import {loadAssetGLTF} from './AssetGLTF';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {disposeRacecraftDetails} from './RacecraftDetails';
// Decode on background threads; keep at least one core for the UI and driver.
const startWorkers=()=>{if(typeof Worker!=='undefined')MeshoptDecoder.useWorkers(Math.min(2,Math.max(1,(navigator.hardwareConcurrency||2)-1)));};
interface Entry{promise:Promise<THREE.Group>;users:number}
const cache=new Map<string,Entry>(),leases=new WeakMap<THREE.Object3D,{key:string;entry:Entry}>();
function release(key:string,entry:Entry){if(--entry.users>0)return;if(cache.get(key)===entry)cache.delete(key);if(!cache.size&&typeof Worker!=='undefined')MeshoptDecoder.useWorkers(0);void entry.promise.then(root=>{
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>(),skins=new Set<THREE.Skeleton>();
 root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}if(o instanceof THREE.SkinnedMesh)skins.add(o.skeleton);});
 geometries.forEach(g=>{disposeRacecraftDetails(g);g.dispose();});for(const m of materials){for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);m.dispose();}textures.forEach(t=>t.dispose());skins.forEach(s=>s.dispose());
 }).catch(()=>{});}
export function releaseVisual(root:THREE.Object3D|undefined){if(!root)return;const lease=leases.get(root);if(!lease)return;leases.delete(root);
 // SkeletonUtils clones own their bone palette textures; geometry and maps
 // belong to the shared source, but these palettes do not.
 const skeletons=new Set<THREE.Skeleton>();root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skeletons.add(o.skeleton);});skeletons.forEach(s=>s.dispose());release(lease.key,lease.entry);
}
export function visualResourceStats(){return{entries:cache.size,users:[...cache.values()].reduce((s,e)=>s+e.users,0)};}
export async function loadVisual(name:'watercraft'|'rider',low:boolean){
 const mobile=!low&&typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
 const key=`${name}${low?'-low':mobile?'-mobile':''}`;let entry=cache.get(key);
 if(!entry){
  if(!cache.size)startWorkers();
  const base=new URL(`${import.meta.env.BASE_URL}models/`,document.baseURI).href;
  const original=`${base}${key}${low?'.glb':`${mobile?'':'-packed'}.glb.gz`}`,primary=!low&&!mobile?`${base}${name}-efficient.glb.gz`:original,load=(url:string)=>loadAssetGLTF(url,loader=>loader.setMeshoptDecoder(MeshoptDecoder));
  entry={users:0,promise:load(primary).catch(error=>{if(primary===original)throw error;return load(original);}).then(g=>g.scene)};cache.set(key,entry);
 }
 entry.users++;let source:THREE.Group;try{source=await entry.promise;}catch(error){release(key,entry);throw error;}
 const result=clone(source),skeletons=new Map<string,THREE.Skeleton>();leases.set(result,{key,entry});
 result.userData.visualAsset=key;
 result.traverse(o=>{if(o instanceof THREE.SkinnedMesh){const key=o.skeleton.bones.map(b=>b.uuid).join('|'),shared=skeletons.get(key);if(shared)o.skeleton=shared;else skeletons.set(key,o.skeleton);}});
 return result;
}
if(import.meta.hot)import.meta.hot.dispose(()=>MeshoptDecoder.useWorkers(0));

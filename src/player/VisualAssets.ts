import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const cache=new Map<string,Promise<THREE.Group>>();
export async function loadVisual(name:'watercraft'|'rider',low:boolean){
 const key=`${name}${low?'-low':''}`;let promise=cache.get(key);
 if(!promise){promise=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${key}.glb`).then(g=>g.scene);cache.set(key,promise);}
 const result=clone(await promise),skeletons=new Map<string,THREE.Skeleton>();
 result.userData.visualAsset=key;
 result.traverse(o=>{if(o instanceof THREE.SkinnedMesh){const key=o.skeleton.bones.map(b=>b.uuid).join('|'),shared=skeletons.get(key);if(shared)o.skeleton=shared;else skeletons.set(key,o.skeleton);}});
 return result;
}

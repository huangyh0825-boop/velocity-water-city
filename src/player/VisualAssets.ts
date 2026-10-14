import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const cache=new Map<string,Promise<THREE.Group>>();
export async function loadVisual(name:'watercraft'|'rider',low:boolean){
 const key=`${name}${low?'-low':''}`;let promise=cache.get(key);
 if(!promise){promise=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${key}.glb`).then(g=>g.scene);cache.set(key,promise);}return(await promise).clone(true);
}

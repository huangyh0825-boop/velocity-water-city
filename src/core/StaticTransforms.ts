import type {Object3D} from 'three';
/** Only for scenery whose Object3D transforms never animate. Instance buffers,
 * visibility, materials and shader time remain live. Never apply to racers. */
export function cacheStaticTransforms(root:Object3D){
 root.traverse(o=>{o.updateMatrix();o.matrixWorldAutoUpdate=true;});
 root.updateWorldMatrix(true,true);
 root.traverse(o=>{o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;});
}

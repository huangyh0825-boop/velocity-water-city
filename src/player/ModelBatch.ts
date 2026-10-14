import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/** Merge static parts by material to keep small detailed models inexpensive. */
export class ModelBatch {
  private groups=new Map<THREE.Material,THREE.BufferGeometry[]>();
  add(geometry:THREE.BufferGeometry,material:THREE.Material,position:THREE.Vector3,scale=new THREE.Vector3(1,1,1),rotation=new THREE.Euler()){
    geometry.applyMatrix4(new THREE.Matrix4().compose(position,new THREE.Quaternion().setFromEuler(rotation),scale));
    const list=this.groups.get(material)??[];list.push(geometry);this.groups.set(material,list);
  }
  build(parent:THREE.Object3D){
    for(const [material,parts] of this.groups){const geometry=mergeGeometries(parts,false)!;const mesh=new THREE.Mesh(geometry,material);parent.add(mesh);parts.forEach(p=>p.dispose());}
    this.groups.clear();
  }
}

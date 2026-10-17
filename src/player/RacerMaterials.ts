import * as THREE from 'three';
import {sharePackedMaterialSampling} from './PackedMaterialSampling';

/** Independent finishes, shared geometry/textures. No AI-specific asset downgrade. */
export class RacerMaterials {
 private owned=new Set<THREE.Material>();
 apply(root:THREE.Object3D,color:string){
  const copies=new Map<THREE.Material,THREE.Material>();
  root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
   const copy=(source:THREE.Material)=>{
    let material=copies.get(source);if(material)return material;
    material=source.clone();copies.set(source,material);this.owned.add(material);
    if(material instanceof THREE.MeshStandardMaterial){
     if(source.name==='Paint')material.color.set(color);
     if(/Team woven flotation|Hero blue leather panels/.test(source.name))material.color.copy(new THREE.Color(color)).multiplyScalar(.62);
     sharePackedMaterialSampling(material);
    }
    return material;
   };
   o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
  });
 }
 dispose(){this.owned.forEach(m=>m.dispose());this.owned.clear();}
}

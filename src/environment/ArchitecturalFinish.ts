import * as THREE from 'three';

/** Reuses the authored PBR channels, geometry and material batches. Finishes
 * distinguish pale ceramic cladding, brushed alloy and warm precast stone. */
export function architecturalFinish(material:THREE.MeshStandardMaterial){
 if(material.userData.architecturalFinish)return;material.userData.architecturalFinish=true;
 if(/Concrete034/.test(material.name)){
  material.color.set('#ced0c8');material.roughness=1;material.normalScale.setScalar(.38);material.envMapIntensity=.38;
 }else if(/Coated architectural alloy/.test(material.name)){
  material.color.set('#e0e7e7');material.roughness=.94;material.metalness=.52;material.envMapIntensity=.55;
 }else if(/Metal032/.test(material.name)){
  material.color.set('#c8d6dc');material.metalness=.82;material.roughness=.95;material.normalScale.setScalar(.30);
 }else if(/Graphite joint/.test(material.name)){
  material.color.set('#27363d');material.metalness=.08;material.roughness=.76;
 }else if(/Amber anodized/.test(material.name)){
  material.roughness=.42;material.metalness=.66;
 }
}

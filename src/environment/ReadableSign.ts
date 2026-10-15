import * as THREE from 'three';

/** Canvas cells are counted from the top; texture V is counted from the bottom. */
export function atlasCellUV(index:number,columns:number,rows:number,u:number,v:number):[number,number]{
 return [((index%columns)+u)/columns,(rows-1-Math.floor(index/columns)+v)/rows];
}

/** Local +Z is travel. Approach face points -Z; each side owns readable UVs. */
export function readableSign(map:THREE.Texture,width:number,height:number,name:string,depth=.08,emissive=false){
 const group=new THREE.Group();group.name=name;group.userData.readableSign=true;
 const geometry=new THREE.PlaneGeometry(width,height),material=emissive?new THREE.MeshStandardMaterial({map,emissiveMap:map,emissive:'#ffffff',emissiveIntensity:.65,roughness:.4,side:THREE.FrontSide}):new THREE.MeshBasicMaterial({map,side:THREE.FrontSide});
 for(const approach of [true,false]){
  const face=new THREE.Mesh(geometry,material);face.name=approach?'approach-face':'return-face';face.position.z=(approach?-1:1)*depth/2;face.rotation.y=approach?Math.PI:0;group.add(face);
 }
 return group;
}
export function disposeSign(sign:THREE.Object3D){
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 sign.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}}});
 geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());sign.removeFromParent();
}

import*as THREE from'three';import{mergeGeometries,mergeVertices}from'three/addons/utils/BufferGeometryUtils.js';import{type CityPart}from'./CityMaterialBatch';
/** Authored CC0 anatomical meshes, shared static poses, per-vertex outfit/skin
 * variation. No skinned update and no low-quality fallback after loading. */
export function publicCitizens(scene:THREE.Group,parts:Map<string,CityPart[]>,owned:Set<THREE.Material>,geometries:THREE.BufferGeometry[],textures:THREE.Texture[]){
 const palette=['#4b8795','#bb795c','#c0ae89','#596c83'],skin=['#ad7959','#d4ad88','#80583f','#bd9270'],materials=new Map<THREE.Material,THREE.MeshStandardMaterial>();scene.updateMatrixWorld(true);
 for(let i=0;i<4;i++)for(const tier of['near','mid','far']){
  const root=scene.getObjectByName(`spectator-${i}${tier==='near'?'':'__'+tier}`);if(!root)throw Error(`Missing anatomical spectator pose ${i}/${tier}`);const grouped=new Map<THREE.Material,THREE.BufferGeometry[]>();
  root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;let g=o.geometry.clone();if(g.index){const src=g;g=g.toNonIndexed();src.dispose()}g.applyMatrix4(o.matrixWorld);const source=o.material as THREE.MeshStandardMaterial;let m=materials.get(source);if(!m){m=source.clone();m.vertexColors=true;materials.set(source,m);owned.add(m)}
   if(/woven|skin/.test(m.name))m.color.set('#ffffff');
   const color=new THREE.Color(/woven/.test(m.name)?palette[i]:/skin/.test(m.name)?skin[i]:'#ffffff'),values=new Float32Array(g.attributes.position.count*3);for(let v=0;v<values.length;v+=3){values[v]=color.r;values[v+1]=color.g;values[v+2]=color.b}g.setAttribute('color',new THREE.BufferAttribute(values,3));const a=grouped.get(m)??[];a.push(g);grouped.set(m,a);
  });
  const list:CityPart[]=[];for(const[material,gs]of grouped){const merged=mergeGeometries(gs,false)!,geometry=mergeVertices(merged,1e-6);merged.dispose();gs.forEach(g=>g.dispose());geometries.push(geometry);list.push({geometry,material})}parts.set(`spectator-${i}:${tier}`,list);
 }
 const used=new Set<THREE.Texture>();for(const m of materials.values())for(const value of Object.values(m))if(value instanceof THREE.Texture)used.add(value);textures.push(...used);
 scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose()});materials.forEach((_,source)=>source.dispose());
}

import * as THREE from 'three';

export interface CityPart {geometry:THREE.BufferGeometry;material:THREE.Material}
interface Placement {kind:string;tint:number}
interface Slot {mesh:THREE.BatchedMesh;id:number;geometry:(number|undefined)[]}
/** One multi-draw per shared material, with independent culling and LOD per building. */
export class CityMaterialBatch {
 readonly meshes:THREE.BatchedMesh[]=[];
 private slots:Slot[][];
 constructor(parts:Map<string,CityPart[]>,sites:Placement[],poses:THREE.Matrix4[]){
  this.slots=sites.map(()=>[]);
  const groups=new Map<THREE.Material,Map<string,THREE.BufferGeometry>>();
  for(const [key,list] of parts)for(const p of list){let group=groups.get(p.material);if(!group){group=new Map();groups.set(p.material,group);}group.set(key,p.geometry);}
  const tints=['#ffffff','#cbdbe1','#e7dcc6','#c9dcd4'];
  for(const [material,geometries] of groups){
   const mesh=new THREE.BatchedMesh(sites.length,[...geometries.values()].reduce((n,g)=>n+g.attributes.position.count,0),[...geometries.values()].reduce((n,g)=>n+(g.index?.count??0),0),material);
   mesh.name='city-material-batch-'+material.name;mesh.castShadow=true;mesh.receiveShadow=true;
   // Each instance is culled using its current geometry. The aggregate near-LOD
   // bound must not clip a taller far silhouette after an LOD change.
   mesh.frustumCulled=false;
   const ids=new Map([...geometries].map(([k,g])=>[k,mesh.addGeometry(g)]));
   sites.forEach((s,i)=>{
    const geometry=['near','mid','far'].map(t=>ids.get(`${s.kind}:${t}`)),first=geometry.find(id=>id!==undefined);if(first===undefined)return;
    const id=mesh.addInstance(first);mesh.setMatrixAt(id,poses[i]);mesh.setColorAt(id,new THREE.Color(tints[s.tint]));mesh.setVisibleAt(id,false);this.slots[i].push({mesh,id,geometry});
   });
   mesh.computeBoundingBox();mesh.computeBoundingSphere();this.meshes.push(mesh);
  }
 }
 setLOD(index:number,tier:number){for(const s of this.slots[index]){const id=s.geometry[tier];s.mesh.setVisibleAt(s.id,id!==undefined);if(id!==undefined)s.mesh.setGeometryIdAt(s.id,id);}}
 dispose(){for(const mesh of this.meshes){mesh.removeFromParent();mesh.dispose();}}
}

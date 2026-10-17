import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CityTrack} from '../track/CityTrack';
import {cityServices,SERVICE_MODULES} from './CityServicesLayout';
import {CityMaterialBatch,type CityPart} from './CityMaterialBatch';

/** One authored engineering kit, material-shared and instanced across the map. */
export class CityServices {
 readonly root=new THREE.Group();readonly sites;loaded=false;
 private geometries:THREE.BufferGeometry[]=[];private meshes:THREE.InstancedMesh[]=[];
 private parts=new Map<string,CityPart[]>();private combined?:CityMaterialBatch;
 constructor(track:CityTrack){this.root.name='authored-city-engineering';this.sites=cityServices(track);}
 async load(materials:Map<string,THREE.Material>){
  if(this.loaded)return;
  const gltf=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/city-sample/city-services.glb`);gltf.scene.updateMatrixWorld(true);
  const discarded=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  for(const kind of Object.keys(SERVICE_MODULES)){
   const original=gltf.scene.getObjectByName(kind);if(!original)throw Error(`Missing engineering asset ${kind}`);
   const sites=this.sites.filter(s=>s.kind===kind);
   original.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
    const old=o.material as THREE.Material,material=materials.get(old.name);if(!material)throw Error(`Unshared engineering PBR ${old.name}`);
    discarded.add(old);const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);this.geometries.push(geometry);
    const key=kind+':near',parts=this.parts.get(key)??[];parts.push({geometry,material});this.parts.set(key,parts);
    const mesh=new THREE.InstancedMesh(geometry,material,sites.length);mesh.name='city-service-'+kind;mesh.castShadow=mesh.receiveShadow=true;
    sites.forEach((s,i)=>mesh.setMatrixAt(i,new THREE.Matrix4().makeRotationY(s.heading).scale(new THREE.Vector3(s.scaleX??1,s.scaleY??1,1)).setPosition(s.x,0,s.z)));mesh.computeBoundingSphere();this.root.add(mesh);this.meshes.push(mesh);
   });
  }
  gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
  for(const m of discarded){for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap']){const t=(m as any)[key];if(t instanceof THREE.Texture)textures.add(t);}m.dispose();}textures.forEach(t=>t.dispose());
  this.loaded=true;
 }
 enableBatches(renderer:THREE.WebGLRenderer){
  if(this.combined||!this.loaded||!renderer.getContext().getExtension('WEBGL_multi_draw'))return;
  this.meshes.forEach(m=>{m.removeFromParent();m.dispose();});this.meshes=[];
  this.combined=new CityMaterialBatch(this.parts,this.sites.map(s=>({kind:s.kind,tint:0})),this.sites.map(s=>new THREE.Matrix4().makeRotationY(s.heading).scale(new THREE.Vector3(s.scaleX??1,s.scaleY??1,1)).setPosition(s.x,0,s.z)));
  this.sites.forEach((_,i)=>this.combined!.setLOD(i,0));this.root.add(...this.combined.meshes);
 }
 dispose(){this.root.removeFromParent();this.combined?.dispose();this.meshes.forEach(m=>m.dispose());this.geometries.forEach(g=>g.dispose());}
}

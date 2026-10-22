import * as THREE from 'three';import {ModelBatch} from '../player/ModelBatch';import {marineMaterial} from '../environment/MarineSurfaces';
import type {RampData} from './Ramps';import type {Track} from './Track';

/** Visual kit follows the existing ramp footprint/slope. Launch/contact logic
 * remains in Ramps; all six ramps still render in two merged material groups. */
export function rampVisuals(scene:THREE.Scene,track:Track,ramps:readonly RampData[]){
 const batch=new ModelBatch(),deck=marineMaterial('ramp',{color:'#e3ecee',metalness:.48,roughness:1,side:THREE.DoubleSide}),trim=new THREE.MeshStandardMaterial({color:'#a9cad0',metalness:.7,roughness:.32});
 deck.name='marine-ramp-deck';trim.name='marine-ramp-trim';
 for(const ramp of ramps){
  const p=track.point(ramp.angle),group=new THREE.Group();group.position.set(p.x,(ramp.baseHeight??0)+.10,p.z);group.rotation.y=ramp.heading;group.scale.set(ramp.width/10,ramp.height/2,ramp.length/12);
  const pos:number[]=[],uv:number[]=[];
  const face=(corners:number[][])=>{for(const k of [0,1,2,0,2,3]){const [x,y,z]=corners[k];pos.push(x,y,z);uv.push((x+5)/10,(z+12)/12);}};
  face([[-4.82,0,-12],[-4.82,2,0],[4.82,2,0],[4.82,0,-12]]);
  for(const s of [-1,1]){
   face([[s*4.82,0,-12],[s*5,-.12,-12],[s*5,1.88,0],[s*4.82,2,0]]);
   face([[s*5,-.12,-12],[s*5,-.32,-12],[s*5,-.32,0],[s*5,1.88,0]]);
  }
  face([[-5,-.32,0],[5,-.32,0],[5,1.88,0],[-5,1.88,0]]);
  face([[-5,1.88,0],[-4.82,2,0],[4.82,2,0],[5,1.88,0]]);
  face([[-5,-.32,-12],[-5,-.12,-12],[5,-.12,-12],[5,-.32,-12]]);
  face([[-5,-.12,-12],[-4.82,0,-12],[4.82,0,-12],[5,-.12,-12]]);
  face([[-5,-.32,-12],[5,-.32,-12],[5,-.32,0],[-5,-.32,0]]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();group.add(new THREE.Mesh(geometry,deck));
  const part=(g:THREE.BufferGeometry,x:number,y:number,z:number,sloped=false)=>{const mesh=new THREE.Mesh(g,trim);mesh.position.set(x,y,z);if(sloped)mesh.rotation.x=-Math.atan2(2,12);group.add(mesh);};
  for(const s of [-1,1]){
   part(new THREE.BoxGeometry(.10,.055,Math.hypot(12,2)),s*4.78,1.04,-6,true);
   part(new THREE.BoxGeometry(.22,.35,11.5),s*3.9,-.13,-6);
  }
  part(new THREE.BoxGeometry(9.7,.18,.16),0,1.92,-.12);
  group.updateMatrixWorld(true);group.traverse(o=>{if(o instanceof THREE.Mesh){const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);batch.add(g,o.material as THREE.Material,new THREE.Vector3());o.geometry.dispose();}});
 }
 const root=new THREE.Group();root.name='ramp-visuals';batch.build(root);root.traverse(o=>{if(o instanceof THREE.Mesh){o.name=(o.material as THREE.Material).name;o.receiveShadow=true;}});scene.add(root);
}

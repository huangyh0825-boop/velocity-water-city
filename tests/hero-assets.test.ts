import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {visualDocument,visualGeometry} from './helpers/visual-glb';
import {AnatomicalRider} from '../src/player/AnatomicalRider';

test('hero craft contains authored PBR finishes, clearcoat and original LCD with unchanged mounts',async()=>{
 const {json}=visualDocument('watercraft');
 for(const name of ['Paint','Forged carbon composite','Molded traction rubber','Perforated marine saddle','Brushed titanium','Original LCD display'])assert.ok(json.materials.some((m:any)=>m.name===name),name);
 for(const material of json.materials.filter((m:any)=>m.name==='Paint'||m.name==='Perforated marine saddle')){
  assert.ok(material.normalTexture);assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture);assert.ok(material.pbrMetallicRoughness.baseColorTexture);
 }
 assert.ok(json.materials.some((m:any)=>m.extensions?.KHR_materials_clearcoat));
 const {scene}=await visualGeometry('watercraft');
 const seat=scene.getObjectByName('RiderSeat')!;assert.ok(seat.position.distanceTo(new THREE.Vector3(0,.88,-.10))<1e-5);
 for(const side of [-1,1]){
  const grip=scene.getObjectByName(side<0?'Grip_L':'Grip_R')!;
  assert.ok(grip.position.distanceTo(new THREE.Vector3(side*.41181977,.99953005,.47436001))<1e-5);
 }
});

test('hero skin has 28 articulated glove bones and holds both grip position and orientation during riding poses',async()=>{
 const {scene}=await visualGeometry('rider');const root=new THREE.Group();root.add(scene);
 assert.equal(scene.getObjectByName('RaceRig')!.userData.heroDetailVersion,2);
 const digits:THREE.Object3D[]=[];scene.traverse(o=>{if(o instanceof THREE.Bone&&/^(Finger|Thumb)/.test(o.name))digits.push(o);});assert.equal(digits.length,28);
 const {scene:boat}=await visualGeometry('watercraft'),seat=boat.getObjectByName('RiderSeat')!.position;
 const grips=['Grip_L','Grip_R'].map(n=>boat.getObjectByName(n)!.position.clone().sub(seat));
 const ik=new AnatomicalRider(root,scene.getObjectByName('RiderTorso')!,grips);ik.update(.15,0);root.updateMatrixWorld(true);
 const rest=[-1,1].map(s=>scene.getObjectByName(`Hand_${s}`)!.getWorldQuaternion(new THREE.Quaternion()));
 for(const lean of [.15,.29,.38])for(const bank of [-.18,0,.18]){
  root.rotation.set(.8,.4,.2);ik.update(lean,bank);root.updateMatrixWorld(true);
  for(const [i,side] of [-1,1].entries()){
   const hand=scene.getObjectByName(`Hand_${side}`)!;assert.ok(root.worldToLocal(hand.getWorldPosition(new THREE.Vector3())).distanceTo(grips[i])<.012);
   const q=root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()));assert.ok(q.normalize().angleTo(rest[i].clone().normalize())<1e-5);
  }
 }
 // Exported skin weights and vertex positions must remain finite under the full pose.
 scene.traverse(o=>{if(o instanceof THREE.SkinnedMesh){o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i+=137){const v=o.getVertexPosition(i,new THREE.Vector3());assert.ok([v.x,v.y,v.z].every(Number.isFinite));assert.ok(v.length()<3);}}});
});


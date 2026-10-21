import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
const document=(data:Buffer)=>{const n=data.readUInt32LE(12);return{json:JSON.parse(data.subarray(20,20+n).toString()),bin:data.subarray(28+n)};};
import * as THREE from 'three';import {visualGeometry} from './helpers/visual-glb';import {AnatomicalRider} from '../src/player/AnatomicalRider';
test('phone-standard models retain materials, rig and sockets with valid compact geometry between low and desktop',()=>{
 for(const name of ['watercraft','rider']){
  const original=document(readFileSync(`public/models/${name}.glb`)).json,phone=document(gunzipSync(readFileSync(`public/models/${name}-mobile.glb.gz`))),low=document(readFileSync(`public/models/${name}-low.glb`)).json;
  const triangles=(g:any)=>g.meshes.flatMap((m:any)=>m.primitives).reduce((n:number,p:any)=>n+g.accessors[p.indices].count/3,0);
  assert.ok(triangles(low)<triangles(phone.json));assert.ok(triangles(phone.json)<triangles(original)*.1);
  assert.deepEqual(phone.json.materials,original.materials);assert.deepEqual(phone.json.nodes,original.nodes);
  assert.deepEqual(phone.json.skins?.map((s:any)=>s.joints),original.skins?.map((s:any)=>s.joints));
  for(const image of phone.json.images)assert.ok(existsSync('public/models/'+image.uri));
  for(const mesh of phone.json.meshes)for(const p of mesh.primitives){
   const position=phone.json.accessors[p.attributes.POSITION],index=phone.json.accessors[p.indices],v=phone.json.bufferViews[index.bufferView];
   for(let i=0;i<index.count;i++)assert.ok(phone.bin.readUInt32LE(v.byteOffset+i*4)<position.count,`${name}: out of bounds index`);
   for(const id of Object.values(p.attributes) as number[])assert.equal(phone.json.accessors[id].count,position.count);
   for(const key of ['POSITION','NORMAL','TEXCOORD_0','WEIGHTS_0'])if(p.attributes[key]!==undefined){const a=phone.json.accessors[p.attributes[key]],view=phone.json.bufferViews[a.bufferView];if(a.componentType===5126)for(let i=0;i<view.byteLength;i+=4)assert.ok(Number.isFinite(phone.bin.readFloatLE(view.byteOffset+i)));}
  }
 }
});
test('phone-standard rider stays seated and holds grips while its compact skin deforms',async()=>{
 const {scene}=await visualGeometry('rider-mobile',true),{scene:boat}=await visualGeometry('watercraft-mobile',true),root=new THREE.Group();root.add(scene);
 const seat=boat.getObjectByName('RiderSeat')!.position,grips=['Grip_L','Grip_R'].map(n=>boat.getObjectByName(n)!.position.clone().sub(seat));
 const ik=new AnatomicalRider(root,scene.getObjectByName('RiderTorso')!,grips);
 for(const lean of [.15,.29,.38])for(const bank of [-.18,0,.18]){
  root.rotation.set(.8,.4,.2);ik.update(lean,bank,2);root.updateMatrixWorld(true);
  for(const [i,side]of [-1,1].entries())assert.ok(root.worldToLocal(scene.getObjectByName(`Hand_${side}`)!.getWorldPosition(new THREE.Vector3())).distanceTo(grips[i])<.012);
  scene.traverse(o=>{if(o instanceof THREE.SkinnedMesh){o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i+=137){const v=o.getVertexPosition(i,new THREE.Vector3());assert.ok([v.x,v.y,v.z].every(Number.isFinite));assert.ok(v.length()<3);}}});
 }
});

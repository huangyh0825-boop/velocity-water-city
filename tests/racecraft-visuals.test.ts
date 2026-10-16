import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {readFileSync} from 'node:fs';import path from 'node:path';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {visualDocument,visualGeometry} from './helpers/visual-glb';
import {AnatomicalRider} from '../src/player/AnatomicalRider';
import {waterNormalData} from '../src/effects/WaterNormals';
import {BoosterJet} from '../src/effects/BoosterJet';

test('PWC ships portable textures and visual mounts in both geometry tiers',async()=>{
 for(const name of ['watercraft','watercraft-low']){
  const {json}=visualDocument(name);assert.ok(json.images.length>=5);assert.ok(json.images.every((i:any)=>{
   if(Number.isInteger(i.bufferView)&&!i.uri)return true;
   if(typeof i.uri!=='string'||i.uri.includes('..')||!/^pwc-r[78]\/textures\/[A-Za-z0-9_-]+\.png$/.test(i.uri))return false;
   const bytes=readFileSync(path.join('public/models',i.uri));return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  }));assert.ok(json.materials.some((m:any)=>m.name==='Paint'));
  const {scene}=await visualGeometry(name);for(const id of ['RiderSeat','Grip_L','Grip_R','Foot_L','Foot_R'])assert.ok(scene.getObjectByName(id));
  const seat=scene.getObjectByName('RiderSeat')!,left=scene.getObjectByName('Grip_L')!,right=scene.getObjectByName('Grip_R')!;assert.ok(left.position.x<0&&right.position.x>0);assert.ok(left.position.y>seat.position.y);
 }
});

test('anatomical racer clones have independent bones and reach fixed grips through lean and tricks',async()=>{
 const source=(await visualGeometry('rider')).scene,root=new THREE.Group(),a=clone(source),b=clone(source);root.add(a);root.updateMatrixWorld(true);
 const {scene:boat}=await visualGeometry('watercraft');const seat=boat.getObjectByName('RiderSeat')!.position,grips=['Grip_L','Grip_R'].map(n=>boat.getObjectByName(n)!.position.clone().sub(seat));
 const torso=a.getObjectByName('RiderTorso')!,rig=new AnatomicalRider(root,torso,grips),untouched=b.getObjectByName('RiderTorso')!.quaternion.clone();
 for(const lean of [.15,.29,.38])for(const bank of [-.15,0,.15]){
  root.rotation.set(.8,.4,.2);rig.update(lean,bank);root.updateMatrixWorld(true);
  for(const [i,side]of [-1,1].entries()){
   const hand=root.worldToLocal(a.getObjectByName(`Hand_${side}`)!.getWorldPosition(new THREE.Vector3()));assert.ok(hand.distanceTo(grips[i])<.012,`grip miss ${hand.distanceTo(grips[i])}`);
  }
 }
 assert.ok(b.getObjectByName('RiderTorso')!.quaternion.equals(untouched));
 const skins:THREE.SkinnedMesh[]=[];a.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skins.push(o);});assert.ok(skins.length>0);for(const skin of skins){assert.ok(skin.skeleton.bones.every(bone=>{let o:THREE.Object3D|null=bone;while(o){if(o===a)return true;o=o.parent;}return false;}));}
});

test('periodic water normal spectrum is bounded, unit length and deterministic',()=>{
 const a=waterNormalData(32),b=waterNormalData(32);assert.deepEqual(a,b);assert.ok(new Set(a).size>90);
 for(let i=0;i<a.length;i+=4){const n=new THREE.Vector3(a[i]/255*2-1,a[i+1]/255*2-1,a[i+2]/255*2-1);assert.ok(Math.abs(n.length()-1)<.012);assert.equal(a[i+3],255);assert.ok(n.z>.8);}
});

test('boost visual remains attached to the new pump socket while its flame pulses',()=>{
 const root=new THREE.Group(),socket=new THREE.Object3D();socket.name='JetOutlet';socket.position.set(0,.28,-2.12);root.add(socket);root.rotation.set(.4,.7,0);root.position.set(20,5,10);const jet=new BoosterJet(root);
 for(const time of [0,.1,1,8]){jet.update(time,true);assert.ok(jet.object.position.distanceTo(socket.position)<1e-8);assert.equal(jet.object.visible,true);}jet.update(9,false);assert.equal(jet.object.visible,false);
});

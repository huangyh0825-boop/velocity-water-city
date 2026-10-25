import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {visualGeometry} from './helpers/visual-glb';
import {refineRacecraft} from '../src/player/RacecraftDetails';
import {AnatomicalRider} from '../src/player/AnatomicalRider';
import {ImpactRipples} from '../src/effects/ImpactRipples';
import {Water} from '../src/effects/Water';import {WakePool} from '../src/effects/WakePool';

test('shared finish details preserve authored geometry channels, skeletons and driving sockets',async()=>{
 const {scene:boat}=await visualGeometry('watercraft'),{scene:rider}=await visualGeometry('rider');boat.userData.visualAsset='watercraft';
 const copyBoat=boat.clone(true),copyRider=rider.clone(true),meshes:{mesh:THREE.Mesh;base:THREE.BufferGeometry}[]=[];let bones=0;
 for(const root of[boat,rider])root.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push({mesh:o,base:o.geometry});if(o instanceof THREE.Bone)bones++;});
 const sockets=['RiderSeat','Grip_L','Grip_R','JetOutlet'].map(n=>boat.getObjectByName(n)!.position.toArray());
 refineRacecraft(boat,rider);let changed=0,added=0;
 for(const {mesh,base}of meshes){const g=mesh.geometry;if(g===base)continue;changed++;added+=g.userData.finishTriangles;
  for(const[name,attr]of Object.entries(base.attributes)){
   const next=g.getAttribute(name);assert.equal(next.itemSize,attr.itemSize);assert.equal(next.normalized,attr.normalized);
   for(const i of[0,Math.floor(attr.count/2),attr.count-1])for(let k=0;k<attr.itemSize;k++)assert.equal(next.getComponent(i,k),attr.getComponent(i,k));
  }
  assert.deepEqual(Array.from(g.index!.array.subarray(0,base.index!.count)),Array.from(base.index!.array));
  if(mesh instanceof THREE.SkinnedMesh){const weights=g.attributes.skinWeight,indices=g.attributes.skinIndex;for(let i=base.attributes.position.count;i<g.attributes.position.count;i++){
   let sum=0;for(let k=0;k<4;k++){sum+=weights.getComponent(i,k);assert.ok(indices.getComponent(i,k)<mesh.skeleton.bones.length);}assert.ok(Math.abs(sum-1)<1e-6);
  }}assert.ok(g.boundingSphere&&Number.isFinite(g.boundingSphere.radius));
 }
 assert.equal(changed,5);assert.ok(added>100&&added<10000);assert.deepEqual(['RiderSeat','Grip_L','Grip_R','JetOutlet'].map(n=>boat.getObjectByName(n)!.position.toArray()),sockets);
 let afterBones=0;rider.traverse(o=>{if(o instanceof THREE.Bone)afterBones++;});assert.equal(afterBones,bones);
 refineRacecraft(copyBoat,copyRider);const copies:THREE.Mesh[]=[];for(const root of[copyBoat,copyRider])root.traverse(o=>{if(o instanceof THREE.Mesh)copies.push(o);});
 assert.equal(copies.length,meshes.length);copies.forEach((m,i)=>assert.equal(m.geometry,meshes[i].mesh.geometry));
 const counts=meshes.map(v=>v.mesh.geometry.attributes.position.count);refineRacecraft(boat,rider);assert.deepEqual(meshes.map(v=>v.mesh.geometry.attributes.position.count),counts);
 const mounted=new THREE.Group();mounted.add(rider);const seat=boat.getObjectByName('RiderSeat')!.position,grips=['Grip_L','Grip_R'].map(n=>boat.getObjectByName(n)!.position.clone().sub(seat)),ik=new AnatomicalRider(mounted,rider.getObjectByName('RiderTorso')!,grips);
 for(const bank of[-.18,0,.18]){ik.update(.29,bank);mounted.updateMatrixWorld(true);for(const {mesh,base}of meshes)if(mesh instanceof THREE.SkinnedMesh&&mesh.geometry!==base){mesh.skeleton.update();for(let i=base.attributes.position.count;i<mesh.geometry.attributes.position.count;i+=7){const p=mesh.getVertexPosition(i,new THREE.Vector3());assert.ok([p.x,p.y,p.z].every(Number.isFinite));assert.ok(p.length()<3);}}}
});

test('view-aware water spends its fixed sample budget on visible wakes rather than boats behind the camera',()=>{
 const water=new Water(new THREE.Scene()),pool=new WakePool();water.bindWake(pool);
 for(let i=0;i<90;i++)pool.spawn(i*.05,180+i,0,50);for(let i=0;i<24;i++)pool.spawn(i*.05,-20-i,0,50);pool.update(.1);
 const camera=new THREE.PerspectiveCamera(60,1,.1,500);camera.lookAt(0,0,-1);water.update(.1,camera);
 assert.equal(water.mesh.material.uniforms.wakeCount.value,24);for(let i=0;i<24;i++)assert.ok(water.mesh.material.uniforms.wakePositions.value[i].y<0);
 camera.lookAt(0,0,1);water.update(.2,camera);assert.equal(water.mesh.material.uniforms.wakeCount.value,32);
 for(let i=0;i<32;i++)assert.ok(water.mesh.material.uniforms.wakePositions.value[i].y>0);water.dispose();
});

test('landing pressure rings have a finite lifetime and retain elevated contact height',()=>{
 const ring=new ImpactRipples(new THREE.Scene()),time={value:12};ring.bindTime(time);
 for(let i=0;i<30;i++)ring.burst(i,-i,18,9,'landing');ring.update(.15);assert.equal(ring.mesh.count,8);
 const matrix=new THREE.Matrix4();for(let i=0;i<8;i++){ring.mesh.getMatrixAt(i,matrix);const position=new THREE.Vector3().setFromMatrixPosition(matrix);assert.equal(position.y,9);assert.ok(matrix.elements.every(Number.isFinite));}
 assert.equal((ring.mesh.material as THREE.ShaderMaterial).uniforms.time,time);ring.update(2);assert.equal(ring.mesh.count,0);ring.reset();assert.equal(ring.mesh.count,0);ring.setLow(true);assert.equal(ring.mesh.visible,false);
});

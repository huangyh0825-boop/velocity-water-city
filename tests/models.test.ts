import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Watercraft } from '../src/player/Watercraft';
test('riders follow visual tricks without changing hull heading, and keep grips fixed',()=>{
 const craft=new Watercraft(new THREE.Scene());craft.model.heading=.7;craft.model.speed=50;
 craft.sync(1,craft.model,5,{pitch:Math.PI,yaw:Math.PI/2});
 assert.equal(craft.object.rotation.y,.7);assert.equal(craft.visual.rotation.x,Math.PI);assert.equal(craft.rider.root.parent,craft.visual);
 const grips=craft.rider.grips.map(v=>v.clone());
 for(let i=0;i<120;i++)craft.sync(1+i/60,craft.model,0);
 assert.equal(craft.visual.rotation.x,0);assert.equal(craft.visual.rotation.y,0);
 assert.ok(craft.rider.torso.rotation.x>.2);grips.forEach((v,i)=>assert.ok(v.equals(craft.rider.grips[i])));
 craft.model.yawRate=.6;for(let i=0;i<30;i++)craft.sync(3+i/60);assert.ok(craft.rider.torso.rotation.z<-.04);
});
test('merged craft and AI rider have finite low-poly geometry, and do not change the driving model',()=>{
 const craft=new Watercraft(new THREE.Scene(),'#ee7953',undefined,true);let triangles=0,draws=0;
 craft.object.traverse(o=>{if(o instanceof THREE.Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;
  for(const n of o.geometry.getAttribute('position').array)assert.ok(Number.isFinite(n));}});
 assert.ok(draws<=20&&triangles<6000);assert.equal(craft.model.speed,0);assert.equal(craft.model.heading,0);
});

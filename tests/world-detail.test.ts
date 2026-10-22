import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {quayProfile,marineMaterial,marineSurface} from '../src/environment/MarineSurfaces';
import {architecturalFinish} from '../src/environment/ArchitecturalFinish';import {CityTrack} from '../src/track/CityTrack';import {Ramps} from '../src/track/Ramps';

test('chamfered quay stays inside the original collision and camera envelope',()=>{
 const g=quayProfile(),p=g.attributes.position;assert.ok(p.count/3<=20);assert.deepEqual(g.groups,[]);
 for(let i=0;i<p.count;i++)for(const a of [0,1,2])assert.ok(Math.abs(p.getComponent(i,a))<=.500001);
 assert.ok(g.boundingBox!.min.equals(new THREE.Vector3(-.5,-.5,-.5)));assert.ok(g.boundingBox!.max.equals(new THREE.Vector3(.5,.5,.5)));
 for(const attr of Object.values(g.attributes))for(const n of attr.array)assert.ok(Number.isFinite(n));g.dispose();
});
test('marine color and roughness share one bounded texture sample and opaque pass',()=>{
 const a=marineSurface('quay'),b=marineSurface('quay');assert.deepEqual(a.map.image.data,b.map.image.data);assert.equal(a.map.image.width,256);
 const data=a.map.image.data as Uint8Array;assert.ok(data.some((n,i)=>i%4===3&&n<255));assert.equal(a.map.colorSpace,THREE.SRGBColorSpace);
 const m=marineMaterial('ramp',{roughness:1}),shader={fragmentShader:'#include <roughnessmap_fragment>'};m.onBeforeCompile(shader as any,{} as any);
 assert.ok(shader.fragmentShader.includes('sampledDiffuseColor.a'));assert.ok(!shader.fragmentShader.includes('texture2D'));assert.equal(m.roughnessMap,null);assert.equal(m.transparent,false);assert.equal(m.alphaTest,0);
 a.map.dispose();b.map.dispose();m.map!.dispose();m.dispose();
});
test('architectural finish reuses every original PBR channel and is idempotent',()=>{
 const map=new THREE.Texture(),normal=new THREE.Texture(),m=new THREE.MeshStandardMaterial({map,normalMap:normal,roughnessMap:map,aoMap:map,metalnessMap:map});m.name='CC0_Concrete034';
 architecturalFinish(m);const color=m.color.getHex();architecturalFinish(m);assert.equal(m.color.getHex(),color);for(const name of ['map','aoMap','roughnessMap','metalnessMap']as const)assert.equal(m[name],map);assert.equal(m.normalMap,normal);
 assert.equal(m.transparent,false);assert.equal(m.vertexColors,false);map.dispose();normal.dispose();m.dispose();
});
test('six detailed ramps keep identical launch data and two merged visual groups',()=>{
 const track=new CityTrack(),scene=new THREE.Scene(),physics=new Ramps(track),visual=new Ramps(track,scene);assert.deepEqual(visual.data,physics.data);
 const root=scene.getObjectByName('ramp-visuals')!;assert.equal(root.children.length,2);let triangles=0;
 for(const o of root.children as THREE.Mesh[]){const g=o.geometry,p=g.attributes.position;triangles+=p.count/3;for(const n of p.array)assert.ok(Number.isFinite(n));assert.equal(g.attributes.uv.count,p.count);g.dispose();const m=o.material as THREE.MeshStandardMaterial;m.map?.dispose();m.dispose();}
 assert.ok(triangles<700);assert.deepEqual(scene.userData,{});
});

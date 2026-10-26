import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as THREE from 'three';
import {visualDocument,visualGeometry} from './helpers/visual-glb';import {raceFinish} from '../src/player/FinishMaterials';

test('efficient racers keep every original triangle, material, animation, rig and mount',async()=>{
 for(const name of['watercraft','rider']){const original=visualDocument(name).json,packed=visualDocument(name+'-efficient',true).json;
  assert.deepEqual(packed.nodes,original.nodes);assert.deepEqual((packed.skins??[]).map((s:any)=>({...s,inverseBindMatrices:0})),(original.skins??[]).map((s:any)=>({...s,inverseBindMatrices:0})));assert.deepEqual(packed.animations??[],original.animations??[]);
  assert.deepEqual(packed.materials,original.materials);let triangles=0;
  for(let i=0;i<original.meshes.length;i++)for(let j=0;j<original.meshes[i].primitives.length;j++){const a=original.meshes[i].primitives[j],b=packed.meshes[i].primitives[j];assert.equal(packed.accessors[b.indices].count,original.accessors[a.indices].count);triangles+=packed.accessors[b.indices].count/3;
   const ap=original.accessors[a.attributes.POSITION],bp=packed.accessors[b.attributes.POSITION];assert.deepEqual(bp.min,ap.min);assert.deepEqual(bp.max,ap.max);assert.equal(bp.componentType,5126);
  }
  const {scene}=await visualGeometry(name+'-efficient',true);let loaded=0;scene.traverse((o:any)=>{if(o.isMesh)loaded+=o.geometry.index.count/3;});assert.equal(loaded,triangles);
 }
});
test('GPU texture copies retain the full source dimensions and complete mip chains',()=>{
 const manifest=JSON.parse(readFileSync('public/models/gpu-textures/manifest.json','utf8')),entries=Object.values(manifest.byHash) as {path:string;width:number;height:number}[];assert.ok(entries.length>=40);
 for(const entry of entries){const b=readFileSync('public/models/'+entry.path);assert.equal(b.subarray(0,12).toString('hex'),'ab4b5458203230bb0d0a1a0a');assert.equal(b.readUInt32LE(20),entry.width);assert.equal(b.readUInt32LE(24),entry.height);assert.equal(b.readUInt32LE(40),Math.floor(Math.log2(Math.max(entry.width,entry.height)))+1);}
});
test('city transport changes image storage only, keeping every geometry and material byte',()=>{
 for(const name of['waterfront','waterfront-low','city-modules','city-modules-low','city-services','public-citizens']){const a=visualDocument('city-sample/'+name),b=visualDocument('city-sample/'+name+'-efficient',true);assert.deepEqual(b.json.nodes,a.json.nodes);assert.deepEqual(b.json.meshes,a.json.meshes);assert.deepEqual(b.json.materials,a.json.materials);
  for(let i=0;i<a.json.accessors.length;i++){const x=a.json.accessors[i],y=b.json.accessors[i];assert.deepEqual({...x,bufferView:0},{...y,bufferView:0});if(x.bufferView!==undefined){const av=a.json.bufferViews[x.bufferView],bv=b.json.bufferViews[y.bufferView];assert.ok(a.bin.subarray(av.byteOffset??0,(av.byteOffset??0)+av.byteLength).equals(b.bin.subarray(bv.byteOffset??0,(bv.byteOffset??0)+bv.byteLength)));}}
  for(const im of b.json.images)assert.ok(im.uri.startsWith('../city-textures/'));
 }
});
test('cloth finish preserves maps and shader hooks while keeping the ORM from becoming polished plastic',()=>{
 const material=new THREE.MeshPhysicalMaterial(),map=new THREE.Texture();material.name='R4 articulated technical race suit';material.roughnessMap=map;let chained=false;material.onBeforeCompile=()=>{chained=true;};raceFinish(material);
 const shader={fragmentShader:'#include <roughnessmap_fragment>'} as any;material.onBeforeCompile(shader,{} as any);assert.ok(chained);assert.equal(material.roughnessMap,map);assert.ok(shader.fragmentShader.includes('roughnessFactor=max'));assert.equal(material.clearcoat,0);assert.equal(material.metalness,0);assert.ok(material.specularIntensity<.5);
});
test('water lateral rejection removes only float32-zero original wake contributions',()=>{
 for(let i=0;i<=145;i++){const age=i/100,aft=8+age*3,spread=.22+aft*.27+age*.35,width=.16+age*.20;assert.equal(Math.fround(Math.exp(-(((12-spread)/width)**2))),0);assert.equal(Math.fround(Math.exp(-144/(.32+age*.7))),0);}
});

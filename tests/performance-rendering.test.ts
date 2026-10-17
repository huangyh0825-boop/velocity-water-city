import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import{HeroLighting}from'../src/player/HeroLighting';
import{sharePackedMaterialSampling}from'../src/player/PackedMaterialSampling';
import{Water}from'../src/effects/Water';import{WakePool}from'../src/effects/WakePool';

test('reused wake selection preserves the original stable age order and 32-stamp distribution',()=>{
 const water=new Water(new THREE.Scene()),pool=new WakePool();water.bindWake(pool);
 for(let round=0;round<12;round++){
  for(let i=0;i<21;i++)pool.spawn(round*21+i,-i,i*.07,15+i);pool.update(.017+round*.01);
  const expected=pool.stamps.filter(p=>p.age<pool.lifetime).sort((a,b)=>a.age-b.age),count=Math.min(32,expected.length);water.update(round*.017);
  assert.equal(water.mesh.material.uniforms.wakeCount.value,count);
  for(let i=0;i<count;i++){const p=expected[Math.floor(i*expected.length/count)],value=water.mesh.material.uniforms.wakePositions.value[i] as THREE.Vector4;assert.deepEqual(value.toArray(),[p.x,p.z,p.heading,Math.min(1,p.speed/50)]);}
 }
 water.dispose();
});

test('packed ORM sharing requires identical texture objects, preserves materials and has a distinct shader key',()=>{
 const packed=new THREE.Texture(),different=new THREE.Texture(),material=new THREE.MeshStandardMaterial({roughnessMap:packed,metalnessMap:packed,aoMap:packed});
 const other=material.clone();other.aoMap=different;other.metalnessMap=different;
 sharePackedMaterialSampling(material);sharePackedMaterialSampling(other);
 assert.equal(material.roughnessMap,packed);assert.equal(material.aoMap,packed);assert.notEqual(material.customProgramCacheKey(),other.customProgramCacheKey());
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader} as Parameters<THREE.Material['onBeforeCompile']>[0];material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
 assert.match(shader.fragmentShader,/texelMetalness = texelRoughness/);assert.match(shader.fragmentShader,/texelRoughness.r - 1.0/);
 assert.match(shader.vertexShader,/#define vMetalnessMapUv vRoughnessMapUv/);assert.doesNotMatch(shader.vertexShader,/vMetalnessMapUv = \(/);assert.doesNotMatch(shader.vertexShader,/vAoMapUv = \(/);
 const untouched={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader} as Parameters<THREE.Material['onBeforeCompile']>[0];other.onBeforeCompile(untouched,{} as THREE.WebGLRenderer);assert.equal(untouched.fragmentShader,THREE.ShaderLib.standard.fragmentShader);
});

test('local depth traversal uses only the racer graph, preserves original materials and invalidates after visual reload',()=>{
 const lighting=new HeroLighting(),scene=new THREE.Scene(),root=new THREE.Group();root.userData.visualRevision=1;scene.add(root);
 const material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);root.add(mesh);
 let current:THREE.WebGLRenderTarget|null=null,calls=0;
 const renderer={xr:{enabled:true},shadowMap:{autoUpdate:true},getRenderTarget:()=>current,setRenderTarget:(r:THREE.WebGLRenderTarget|null)=>current=r,clear:()=>{},render:(target:THREE.Object3D)=>{calls++;assert.equal(target,root);assert.ok(mesh.material instanceof THREE.MeshDepthMaterial);}} as unknown as THREE.WebGLRenderer;
 lighting.update(renderer,scene,root);assert.equal(mesh.material,material);assert.equal(current,null);
 const replacement=new THREE.MeshStandardMaterial();mesh.material=replacement;root.userData.visualRevision++;
 lighting.update(renderer,scene,root);assert.equal(mesh.material,replacement);assert.equal(calls,2);
 (renderer as any).render=()=>{throw Error('GPU test failure');};assert.throws(()=>lighting.update(renderer,scene,root),/GPU test failure/);assert.equal(mesh.material,replacement);assert.equal(current,null);assert.equal(renderer.xr.enabled,true);
 lighting.dispose();mesh.geometry.dispose();material.dispose();replacement.dispose();
});

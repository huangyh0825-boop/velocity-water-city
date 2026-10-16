import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import * as THREE from 'three';
import {Water} from '../src/effects/Water';
import {waterGrid} from '../src/effects/WaterSurface';
import {WakePool} from '../src/effects/WakePool';
import {HeroLighting} from '../src/player/HeroLighting';
import {visualDocument,visualGeometry} from './helpers/visual-glb';

test('water grid resolves small near waves while covering the existing full water plane',()=>{
 const grid=waterGrid(320),p=grid.attributes.position;
 const center=160*321+160;
 assert.ok(Math.abs(p.getX(center))<1e-6);
 assert.ok(p.getX(center+1)-p.getX(center)<.16);
 assert.equal(grid.boundingBox!.min.x,-1300);assert.equal(grid.boundingBox!.max.x,1300);
 for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
 grid.dispose();
});

test('water consumes bounded world-space wake history, clears after flight/restart, and owns its reflection target',()=>{
 const water=new Water(new THREE.Scene()),pool=new WakePool();water.bindWake(pool);
 for(let i=0;i<200;i++)pool.spawn(i,-i,i*.1,45);
 pool.update(.1);water.update(4);
 const m=water.mesh.material;
 assert.equal(m.uniforms.wakeCount.value,32);
 for(let i=0;i<32;i++){
  const stamp=m.uniforms.wakePositions.value[i] as THREE.Vector4;
  assert.ok(stamp.toArray().every(Number.isFinite));assert.ok(stamp.w>=0&&stamp.w<=1);
 }
 const target=(m.uniforms.mirrorSampler.value as THREE.Texture).renderTarget!;let disposed=false;
 target.addEventListener('dispose',()=>{disposed=true;});
 water.setLow(true);assert.equal(m.uniforms.reflectionEnabled.value,0);
 water.setLow(false);assert.equal(m.uniforms.reflectionEnabled.value,1);
 pool.update(2);water.update(6);assert.equal(m.uniforms.wakeCount.value,0);
 pool.spawn(10,20,.7,50);pool.reset();water.update(7);assert.equal(m.uniforms.wakeCount.value,0);
 water.dispose();assert.equal(disposed,true);
});

test('hero shadow restores render state on failure and restores shared material hooks on disposal',()=>{
 const lighting=new HeroLighting(),scene=new THREE.Scene(),hero=new THREE.Group();
 const mat=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),mat);hero.add(mesh);scene.add(hero);
 const original=mat.onBeforeCompile,cache=mat.customProgramCacheKey,background=new THREE.Color('blue');scene.background=background;
 const district=new THREE.Group(),env=new THREE.Texture(),districtMaterial=new THREE.MeshStandardMaterial({envMap:env});district.name='blender-waterfront-sample';district.add(new THREE.Mesh(new THREE.BoxGeometry(),districtMaterial));scene.add(district);
 const previous=new THREE.WebGLRenderTarget(1,1);let current:THREE.WebGLRenderTarget|null=previous;
 const renderer={xr:{enabled:true},shadowMap:{autoUpdate:true},getRenderTarget:()=>current,setRenderTarget:(t:THREE.WebGLRenderTarget|null)=>{current=t;},clear:()=>{},render:()=>{throw Error('test render failure');}};
 assert.throws(()=>lighting.update(renderer as unknown as THREE.WebGLRenderer,scene,hero),/test render failure/);
 assert.equal(current,previous);assert.equal(scene.overrideMaterial,null);assert.equal(scene.background,background);assert.equal(renderer.xr.enabled,true);assert.equal(renderer.shadowMap.autoUpdate,true);
 assert.notEqual(mat.onBeforeCompile,original);assert.equal(mesh.receiveShadow,false);assert.ok(mesh.layers.isEnabled(2));assert.equal(mat.envMap,env);
 lighting.dispose();assert.equal(mat.onBeforeCompile,original);assert.equal(mat.customProgramCacheKey,cache);assert.equal(mat.envMap,null);
 mesh.geometry.dispose();mat.dispose();previous.dispose();
});

test('R8 foot mats are exposed to the rider feet, not buried under the new hull deck',async()=>{
 const {scene}=await visualGeometry('watercraft');scene.updateMatrixWorld(true);
 for(const side of [-1,1]){
  const socket=scene.getObjectByName(side<0?'Foot_L':'Foot_R')!;
  const point=socket.getWorldPosition(new THREE.Vector3());point.y+=.03;
  const ray=new THREE.Raycaster(point,new THREE.Vector3(0,-1,0),0,.08);
  const first=ray.intersectObject(scene,true)[0];assert.ok(first);
  assert.match(first.object.name,/FootMat/);assert.ok(first.distance<.042);
 }
});

test('R4 anatomical garment exports interpolated colour panels, portable maps and the articulated seated rig',async()=>{
 const {json}=visualDocument('rider');
 assert.ok(json.materials.some((m:any)=>m.name==='R4 articulated technical race suit'));
 const garment=json.materials.findIndex((m:any)=>m.name==='R4 articulated technical race suit');
 assert.ok(json.meshes.some((m:any)=>m.primitives.some((p:any)=>p.material===garment&&p.attributes.COLOR_0!==undefined)));
 for(const image of json.images){assert.match(image.uri,/^rider-r4\/textures\/[A-Za-z0-9_-]+\.png$/);assert.ok(statSync('public/models/'+image.uri).size>0);}
 const manifest=JSON.parse(readFileSync('public/models/manifest.json','utf8'));
 assert.equal(manifest.pwcRebuild.design,'VECTOR R8');assert.equal(manifest.riderRebuild.bones,46);
 const {scene}=await visualGeometry('rider');assert.ok(scene.getObjectByName('RaceRig')!.userData.riderRebuild);
});

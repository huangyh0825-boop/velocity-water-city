import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RacerMaterials} from '../src/player/RacerMaterials';
import {AnatomicalRider} from '../src/player/AnatomicalRider';
import {HeroLighting} from '../src/player/HeroLighting';
import {visualGeometry} from './helpers/visual-glb';

test('racer palettes isolate finishes/shadow hooks while sharing the original geometry and maps',()=>{
 const texture=new THREE.Texture(),paint=new THREE.MeshStandardMaterial({map:texture});paint.name='Paint';
 const suit=paint.clone();suit.name='Team woven flotation panels';
 const template=new THREE.Group();template.add(new THREE.Mesh(new THREE.BoxGeometry(),paint),new THREE.Mesh(new THREE.BoxGeometry(),suit));
 const a=template.clone(true),b=template.clone(true),pa=new RacerMaterials(),pb=new RacerMaterials();pa.apply(a,'#126bba');pb.apply(b,'#ee7953');
 const am=(a.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial,bm=(b.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
 assert.notEqual(am,bm);assert.notEqual(am,paint);assert.equal(am.map,texture);assert.equal(bm.map,texture);assert.equal((a.children[0] as THREE.Mesh).geometry,(b.children[0] as THREE.Mesh).geometry);assert.notEqual(am.color.getHex(),bm.color.getHex());
 const original=bm.onBeforeCompile;am.onBeforeCompile=()=>{};assert.equal(bm.onBeforeCompile,original);
 let disposed=0,textureDisposed=false;am.addEventListener('dispose',()=>disposed++);texture.addEventListener('dispose',()=>textureDisposed=true);
 pa.dispose();pa.dispose();assert.equal(disposed,1);assert.equal(textureDisposed,false);assert.equal(bm.map,texture);pb.dispose();
});

test('articulated spine and clavicles preserve fixed hands and feet through riding, landing, bank and aerial poses',async()=>{
 const {scene}=await visualGeometry('rider'),root=new THREE.Group();root.add(scene);root.updateMatrixWorld(true);
 const rig=scene.getObjectByName('RaceRig')!;assert.equal(rig.userData.articulatedSpine,true);
 for(const name of ['RiderChest','Clavicle_-1','Clavicle_1'])assert.ok(scene.getObjectByName(name));
 const grips=[-1,1].map(side=>new THREE.Vector3(side*.41181977,.11953005,.57436001));
 const ik=new AnatomicalRider(root,scene.getObjectByName('RiderTorso')!,grips);
 const feet=[-1,1].map(side=>scene.getObjectByName('Foot_'+side)!.getWorldPosition(new THREE.Vector3()));
 for(const height of [0,3,8])for(const lean of [.15,.29,.40])for(const bank of [-.18,0,.18]){
  root.rotation.set(height*.2,.6,.2);ik.update(lean,bank,height);root.updateMatrixWorld(true);
  for(const [i,side] of [-1,1].entries()){
   const position=(name:string)=>root.worldToLocal(scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()));
   assert.ok(position('Hand_'+side).distanceTo(grips[i])<.012);
   assert.ok(position('Foot_'+side).distanceTo(feet[i])<1e-6);
  }
 }
});

test('each racer self-shadow renders only its own caster layer and keeps independent uniforms',()=>{
 const scene=new THREE.Scene(),roots=[new THREE.Group(),new THREE.Group()],lights=[new HeroLighting(2),new HeroLighting(3)];
 const materials=roots.map(root=>{const m=new THREE.MeshStandardMaterial();root.add(new THREE.Mesh(new THREE.BoxGeometry(),m));scene.add(root);return m;});
 const visor=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshPhysicalMaterial({transparent:true,opacity:.48}));roots[0].add(visor);
 const cameras:number[]=[];let target:THREE.WebGLRenderTarget|null=null;
 const renderer={xr:{enabled:false},shadowMap:{autoUpdate:false},getRenderTarget:()=>target,setRenderTarget:(t:THREE.WebGLRenderTarget|null)=>target=t,clear:()=>{},render:(_:unknown,c:THREE.Camera)=>cameras.push(c.layers.mask)};
 lights.forEach((l,i)=>l.update(renderer as unknown as THREE.WebGLRenderer,scene,roots[i]));
 assert.deepEqual(cameras,[1<<2,1<<3]);assert.equal(roots[0].children[0].layers.isEnabled(3),false);assert.equal(roots[1].children[0].layers.isEnabled(2),false);assert.notEqual(materials[0].onBeforeCompile,materials[1].onBeforeCompile);
 assert.equal(visor.layers.isEnabled(2),false);assert.equal(visor.layers.isEnabled(0),true);
 lights.forEach(l=>l.dispose());
});

test('offscreen self-shadow culling retains full quality when a racer enters view',()=>{
 const light=new HeroLighting(3),scene=new THREE.Scene(),racer=new THREE.Group(),holder=new THREE.Group();scene.add(holder);holder.add(racer);racer.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
 const camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.lookAt(0,0,-10);let count=0,target:THREE.WebGLRenderTarget|null=null;
 const renderer={xr:{enabled:false},shadowMap:{autoUpdate:false},getRenderTarget:()=>target,setRenderTarget:(t:THREE.WebGLRenderTarget|null)=>target=t,clear:()=>{},render:()=>count++} as unknown as THREE.WebGLRenderer;
 racer.position.set(100,0,-10);assert.equal(light.updateVisible(renderer,scene,racer,camera),false);assert.equal(count,0);
 racer.position.set(0,0,-10);assert.equal(light.updateVisible(renderer,scene,racer,camera),true);assert.equal(count,1);light.dispose();
});

import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CityTrack} from '../track/CityTrack';
import {TAU} from '../track/Track';
import {readableSign,disposeSign} from './ReadableSign';
import {CityAtmosphere} from './CityAtmosphere';
import {SurfaceContacts} from './SurfaceContacts';
import {CityDensity} from './CityDensity';

export const CITY_SAMPLE={center:.06,length:280} as const;
export function inCitySample(track:CityTrack,angle:number){return Math.abs(angle/TAU-CITY_SAMPLE.center)*track.length<CITY_SAMPLE.length/2;}
/** Pure visual GLB district. Never updates track, boat bodies or race state. */
export class CitySample {
 readonly root=new THREE.Group();loaded=false;error='';
 private generation=0;private disposed=false;private shadowWater:THREE.Mesh;private sun?:THREE.DirectionalLight;
 private cache=new Map<boolean,Promise<THREE.Group>>();
 private atmosphere?:CityAtmosphere;private reflection?:THREE.WebGLRenderTarget;
 private contacts:SurfaceContacts;
 readonly density:CityDensity;
 constructor(scene:THREE.Scene,private track:CityTrack,private ready:(loaded:boolean)=>void){
  this.root.name='blender-waterfront-sample';const a=CITY_SAMPLE.center*TAU,p=track.point(a);this.root.position.set(p.x,0,p.z);this.root.rotation.y=track.heading(a);scene.add(this.root);
  this.contacts=new SurfaceContacts(track);
  this.density=new CityDensity(track);
  const vertices:number[]=[];
  for(let i=0;i<56;i++){
   const points=[i,i+1].flatMap(j=>{const a=(CITY_SAMPLE.center*track.length-140+j*5)/track.radius;return [-1,1].map(side=>track.point(a,side*(track.widthAt(a)-.2)));});
   for(const k of [0,1,2,1,3,2])vertices.push(points[k].x,.12,points[k].z);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  this.shadowWater=new THREE.Mesh(geometry,new THREE.ShadowMaterial({opacity:.24,side:THREE.DoubleSide,depthWrite:false}));this.shadowWater.receiveShadow=true;this.shadowWater.visible=false;scene.add(this.shadowWater);
  void this.setLow(typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches);
 }
 async setLow(low:boolean){
  this.shadowWater.visible=this.loaded&&!low;const request=++this.generation;
  try{
   let asset=this.cache.get(low);
   if(!asset){asset=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/city-sample/waterfront${low?'-low':''}.glb`).then(g=>{
    g.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats)if(mat instanceof THREE.MeshStandardMaterial){mat.envMapIntensity=.55;if(/Graphite joint/.test(mat.name)){mat.color.set('#14212a');mat.envMapIntensity=.2;mat.metalness=.05;}if(/glaz|glass/i.test(mat.name)){mat.metalness=0;if(/Blue laminated/.test(mat.name))mat.color.set('#d4e0e6');if(/Silver blue/.test(mat.name))mat.color.set('#718590');if(/Marina teal/.test(mat.name))mat.color.set('#b3c7ba');mat.envMapIntensity=.4;}if(/Concrete034/.test(mat.name))mat.color.set('#b4bec2');mat.aoMapIntensity=.7;if(low){mat.normalMap=null;if(mat instanceof THREE.MeshPhysicalMaterial)mat.clearcoat=0;mat.needsUpdate=true;}else{for(const t of [mat.map,mat.normalMap,mat.roughnessMap,mat.metalnessMap,mat.aoMap])if(t)t.anisotropy=4;}}}});return g.scene;
   });this.cache.set(low,asset);}
   const [group]=await Promise.all([asset,this.density.setLow(low)]);if(this.disposed||request!==this.generation)return;
   this.releaseSigns();this.atmosphere?.dispose();this.root.clear();this.root.add(group,this.contacts.mesh,this.density.root);this.contacts.mesh.visible=!low;this.loaded=true;this.error='';this.shadowWater.visible=!low;this.addSigns();this.atmosphere=new CityAtmosphere(this.track);this.atmosphere.setLow(low);this.root.add(this.atmosphere.root);if(this.sun)this.sun.shadow.needsUpdate=true;this.ready(true);
  }catch(e){if(request!==this.generation||this.disposed)return;this.error=String(e);this.cache.delete(low);console.error('City sample GLB failed; retaining existing district',e);if(!this.loaded)this.ready(false);}
 }
 update(time:number,camera?:THREE.Camera){this.atmosphere?.update(time);if(camera)this.density.update(camera.position,time);}
 bakeReflections(renderer:THREE.WebGLRenderer,scene:THREE.Scene){
  if(!this.loaded||!renderer.shadowMap.enabled)return;
  if(!this.reflection){
   const cube=new THREE.WebGLCubeRenderTarget(256,{type:THREE.HalfFloatType}),camera=new THREE.CubeCamera(1,1200,cube);camera.position.set(this.root.position.x,22,this.root.position.z);camera.update(renderer,scene);
   const generator=new THREE.PMREMGenerator(renderer);this.reflection=generator.fromCubemap(cube.texture);generator.dispose();cube.dispose();
  }
  this.root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial&&/glaz|glass|alloy|Metal032/i.test(m.name)){m.envMap=this.reflection!.texture;m.envMapIntensity=/alloy|Metal032/i.test(m.name)?.65:.7;m.needsUpdate=true;}});
  this.density.reflect(this.reflection.texture);
 }
 private releaseSigns(){for(const child of [...this.root.children])if(child.userData.readableSign)disposeSign(child);}
 private addSigns(){
  const h=this.root.rotation.y,c=this.root.position;
  for(const [i,side] of [[21,-1],[47,1]]){
   const a=(CITY_SAMPLE.center*this.track.length-140+i*5)/this.track.radius,p=this.track.point(a,(this.track.widthAt(a)+7)*side),dx=p.x-c.x,dz=p.z-c.z;
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const ctx=canvas.getContext('2d')!;
   ctx.fillStyle='#06334d';ctx.fillRect(0,0,1024,512);ctx.fillStyle='#41d9eb';ctx.fillRect(32,32,14,448);ctx.fillStyle='#e2f7ff';ctx.font='bold 92px sans-serif';ctx.fillText(side<0?'AURORA':'MARINA',80,180);ctx.font='36px sans-serif';ctx.fillText('WATER CITY  /  RACE FORWARD',84,270);ctx.fillStyle='#68e0ec';ctx.font='bold 80px sans-serif';ctx.fillText('→  →  →',84,400);
   const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
   const panel=readableSign(map,8.8,3.2,'original-transit-advert',.85,true);panel.position.set(dx*Math.cos(h)-dz*Math.sin(h),2.9,dx*Math.sin(h)+dz*Math.cos(h));panel.rotation.y=this.track.heading(a)-h;this.root.add(panel);
  }
 }
 /** Shadow frustum is local to this 280m district, never follows or moves physics. */
 configureSun(scene:THREE.Scene){
  const sun=scene.children.find(o=>o instanceof THREE.DirectionalLight) as THREE.DirectionalLight|undefined;
  if(!sun)return;const a=CITY_SAMPLE.center*TAU,p=this.track.point(a);
  sun.position.set(p.x-110,180,p.z+100);sun.target.position.set(p.x,0,p.z);scene.add(sun.target);
  this.sun=sun;sun.intensity=3.25;sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-160,right:160,top:175,bottom:-175,near:1,far:450});sun.shadow.bias=-.00008;sun.shadow.normalBias=.018;sun.shadow.camera.updateProjectionMatrix();
  for(const light of scene.children)if(light instanceof THREE.HemisphereLight)light.intensity=1.3;
  // District geometry and sun are static: refresh on asset/quality changes only.
  sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
 }
 dispose(){
  this.disposed=true;this.generation++;this.ready(false);this.releaseSigns();this.atmosphere?.dispose();this.contacts.dispose();this.density.dispose();this.reflection?.dispose();this.root.removeFromParent();
  this.shadowWater.removeFromParent();this.shadowWater.geometry.dispose();(this.shadowWater.material as THREE.Material).dispose();
  for(const asset of this.cache.values())void asset.then(g=>g.traverse(o=>{
   if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof THREE.Texture)value.dispose();m.dispose();}}
  })).catch(()=>{});
  this.cache.clear();
 }
}

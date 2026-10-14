import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CityTrack} from '../track/CityTrack';
import {TAU} from '../track/Track';

export const CITY_SAMPLE={center:.06,length:280} as const;
export function inCitySample(track:CityTrack,angle:number){return Math.abs(angle/TAU-CITY_SAMPLE.center)*track.length<CITY_SAMPLE.length/2;}
/** Pure visual GLB district. Never updates track, boat bodies or race state. */
export class CitySample {
 readonly root=new THREE.Group();loaded=false;error='';
 private generation=0;private disposed=false;private shadowWater:THREE.Mesh;private sun?:THREE.DirectionalLight;
 private cache=new Map<boolean,Promise<THREE.Group>>();
 constructor(scene:THREE.Scene,private track:CityTrack,private ready:(loaded:boolean)=>void){
  this.root.name='blender-waterfront-sample';const a=CITY_SAMPLE.center*TAU,p=track.point(a);this.root.position.set(p.x,0,p.z);this.root.rotation.y=track.heading(a);scene.add(this.root);
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
    g.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats)if(mat instanceof THREE.MeshStandardMaterial){mat.envMapIntensity=.8;if(low){mat.normalMap=null;mat.needsUpdate=true;}else{for(const t of [mat.map,mat.normalMap,mat.roughnessMap,mat.metalnessMap])if(t)t.anisotropy=4;}}}});return g.scene;
   });this.cache.set(low,asset);}
   const group=await asset;if(this.disposed||request!==this.generation)return;
   this.releaseSigns();this.root.clear();this.root.add(group);this.loaded=true;this.error='';this.shadowWater.visible=!low;this.addSigns();if(this.sun)this.sun.shadow.needsUpdate=true;this.ready(true);
  }catch(e){if(request!==this.generation||this.disposed)return;this.error=String(e);this.cache.delete(low);console.error('City sample GLB failed; retaining existing district',e);if(!this.loaded)this.ready(false);}
 }
 private releaseSigns(){for(const child of [...this.root.children])if(child.name==='original-transit-advert'&&child instanceof THREE.Mesh){child.geometry.dispose();const mat=child.material as THREE.MeshStandardMaterial;mat.map?.dispose();mat.dispose();child.removeFromParent();}}
 private addSigns(){
  const h=this.root.rotation.y,c=this.root.position;
  for(const [i,side] of [[21,-1],[47,1]]){
   const a=(CITY_SAMPLE.center*this.track.length-140+i*5)/this.track.radius,p=this.track.point(a,(this.track.widthAt(a)+7)*side),dx=p.x-c.x,dz=p.z-c.z;
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const ctx=canvas.getContext('2d')!;
   ctx.fillStyle='#06334d';ctx.fillRect(0,0,1024,512);ctx.fillStyle='#41d9eb';ctx.fillRect(32,32,14,448);ctx.fillStyle='#e2f7ff';ctx.font='bold 92px sans-serif';ctx.fillText(side<0?'AURORA':'MARINA',80,180);ctx.font='36px sans-serif';ctx.fillText('WATER CITY  /  RACE FORWARD',84,270);ctx.fillStyle='#68e0ec';ctx.font='bold 80px sans-serif';ctx.fillText('→  →  →',84,400);
   const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
   const panel=new THREE.Mesh(new THREE.PlaneGeometry(8.8,3.2),new THREE.MeshStandardMaterial({map,roughness:.5,emissive:'#174756',emissiveMap:map,emissiveIntensity:.2,side:THREE.DoubleSide}));panel.position.set(dx*Math.cos(h)-dz*Math.sin(h),2.9,dx*Math.sin(h)+dz*Math.cos(h)-.37);panel.rotation.y=Math.PI;panel.name='original-transit-advert';this.root.add(panel);
  }
 }
 /** Shadow frustum is local to this 280m district, never follows or moves physics. */
 configureSun(scene:THREE.Scene){
  const sun=scene.children.find(o=>o instanceof THREE.DirectionalLight) as THREE.DirectionalLight|undefined;
  if(!sun)return;const a=CITY_SAMPLE.center*TAU,p=this.track.point(a);
  sun.position.set(p.x-110,180,p.z+100);sun.target.position.set(p.x,0,p.z);scene.add(sun.target);
  this.sun=sun;sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-160,right:160,top:175,bottom:-175,near:1,far:450});sun.shadow.bias=-.00012;sun.shadow.normalBias=.08;sun.shadow.camera.updateProjectionMatrix();
  // District geometry and sun are static: refresh on asset/quality changes only.
  sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
 }
 dispose(){
  this.disposed=true;this.generation++;this.ready(false);this.releaseSigns();this.root.removeFromParent();
  this.shadowWater.removeFromParent();this.shadowWater.geometry.dispose();(this.shadowWater.material as THREE.Material).dispose();
  for(const asset of this.cache.values())void asset.then(g=>g.traverse(o=>{
   if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof THREE.Texture)value.dispose();m.dispose();}}
  })).catch(()=>{});
  this.cache.clear();
 }
}

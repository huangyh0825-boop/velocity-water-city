import * as THREE from 'three';
import {CityTrack} from '../track/CityTrack';
import {readableSign,disposeSign} from './ReadableSign';
import {ScreenHousing} from './ScreenHousing';
interface Screen {index:number;side:number;offset:number;y:number;w:number;h:number;title:string;sub:string;theme:string;local?:{x:number;z:number};color?:string}

/** Scenic screens and instanced maglev traffic only; no racer, collision or route writes. */
export class CityAtmosphere {
 readonly root=new THREE.Group();private pods:THREE.InstancedMesh;private lights:THREE.InstancedMesh;
 private pose=new THREE.Object3D();private h:number;private center:THREE.Vector3;
 private optional:THREE.Group[]=[];
 private housings=new ScreenHousing();
 constructor(private track:CityTrack){
  const a=.06*Math.PI*2,p=track.point(a);this.h=track.heading(a);this.center=new THREE.Vector3(p.x,0,p.z);this.root.name='race-city-atmosphere';
  // Local coordinates match the Blender GLB placement, not camera-facing billboard rotation.
  const screens:Screen[]=[
   {index:33,side:0,offset:0,y:17.3,w:27,h:2.8,title:'LUMEN / LIVE',sub:'CITY CIRCUIT 01   •   3 LAPS   •   RACE FORWARD',theme:'race',local:{x:0,z:14.8}},
   {index:18,side:-1,offset:13,y:9.8,w:11,h:9,title:'HELIX',sub:'CONNECTED CITY / MAGLEV',theme:'holo'},
   {index:39,side:1,offset:13,y:9.8,w:11,h:9,title:'ASTER',sub:'FUTURE MOTION / WATERSPORT',theme:'holo'},
   {index:8,side:-1,offset:23,y:4,w:12,h:2.1,title:'DOCK 07',sub:'SERVICE / CHARGING / REPAIR',theme:'shop'},
   {index:18,side:1,offset:23,y:4,w:12,h:2.1,title:'AURORA MOBILITY',sub:'TRANSIT CONCOURSE / OPEN',theme:'shop'},
   {index:45,side:-1,offset:23,y:4,w:12,h:2.1,title:'MARINA MARKET',sub:'CITY WATERFRONT / LUMEN',theme:'shop'},
   {index:7,side:0,offset:0,y:22,w:14,h:13,title:'ASTER',sub:'MOTION LAB / RACE ENGINEERING',theme:'brand',local:{x:62,z:-105},color:'#22cadb'},
   {index:35,side:0,offset:0,y:21,w:15,h:10,title:'HELIX',sub:'CITY NETWORK / MAGLEV HUB',theme:'brand',local:{x:-68,z:37},color:'#eca342'},
   {index:39,side:0,offset:0,y:14,w:17,h:5,title:'MARINA',sub:'TECH MARKET / WATER CITY',theme:'brand',local:{x:70,z:45},color:'#85dd9f'},
  ];
  for(const row of screens){
   let angle=(.06*track.length-140+row.index*5)/track.radius;const lane=row.side?(track.widthAt(angle)+row.offset)*row.side:0,p=track.point(angle,lane),local=row.local??this.local(p);
   if(row.local){const world={x:this.center.x+Math.cos(this.h)*local.x+Math.sin(this.h)*local.z,z:this.center.z-Math.sin(this.h)*local.x+Math.cos(this.h)*local.z};angle=track.angle(world);}
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=row.theme==='holo'||row.theme==='brand'?1024:256;const ctx=canvas.getContext('2d')!;
   const H=canvas.height,gradient=ctx.createLinearGradient(0,0,1024,H);gradient.addColorStop(0,row.theme==='shop'?'#44301e':'#072c42');gradient.addColorStop(1,'#061e2f');ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,H);ctx.strokeStyle=row.theme==='shop'?'#e4aa56':'#47dbed';ctx.lineWidth=7;ctx.strokeRect(14,14,996,H-28);
   const large=row.theme==='holo'||row.theme==='brand';ctx.fillStyle='#e4f5ff';ctx.font=`bold ${large?130:76}px sans-serif`;ctx.fillText(row.title,48,large?230:110);ctx.font=`${large?33:28}px sans-serif`;ctx.fillStyle=row.color??'#77e6ee';ctx.fillText(row.sub,50,large?320:176);
   if(large){
    ctx.strokeStyle='#68dae7';ctx.lineWidth=12;ctx.beginPath();ctx.arc(520,620,220,-.7,4.8);ctx.stroke();ctx.lineWidth=3;ctx.strokeRect(355,460,330,330);for(let i=0;i<6;i++){ctx.fillStyle=i%2?'#f4b46d':'#78eff2';ctx.fillRect(70+i*24,890-i*16,14,32+i*16);}ctx.fillStyle='#effcff';ctx.font='bold 48px sans-serif';ctx.fillText('VELOCITY / 216',285,972);
    ctx.globalAlpha=.12;ctx.fillStyle='#9effff';for(let y=0;y<H;y+=8)ctx.fillRect(0,y,1024,1);ctx.globalAlpha=1;
    if(row.theme==='brand'){ctx.fillStyle=row.color!;ctx.fillRect(30,30,16,960);ctx.font='bold 84px sans-serif';ctx.fillText('CITY / 05',88,850);}
   }
   const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const sign=readableSign(map,row.w,row.h,`atmosphere-${row.theme}-${row.index}`,row.theme==='shop'?12:.12,true);sign.position.set(local.x,row.y,local.z);sign.rotation.y=track.heading(angle)-this.h;
   if(row.theme==='holo'){for(const face of sign.children){const mat=(face as THREE.Mesh).material as THREE.MeshStandardMaterial;mat.transparent=true;mat.opacity=.9;mat.depthWrite=false;}this.optional.push(sign);}
   if(row.theme==='brand'||row.theme==='race')this.housings.add(row.w,row.h,sign.position,sign.rotation.y);
   this.root.add(sign);
  }
  this.root.add(this.housings.root);
  // Three small scenic pods share geometry/material instead of separate actors.
  const geometry=new THREE.CapsuleGeometry(.85,3.8,4,8);geometry.rotateX(Math.PI/2);
  this.pods=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color:'#748f9e',metalness:.75,roughness:.25}),3);this.pods.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.pods.frustumCulled=false;
  const lights=new THREE.SphereGeometry(.12,6,4);this.lights=new THREE.InstancedMesh(lights,new THREE.MeshBasicMaterial({color:'#5cffff'}),3);this.lights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.lights.frustumCulled=false;this.root.add(this.pods,this.lights);this.update(0);
 }
 private local(p:{x:number;z:number}){const dx=p.x-this.center.x,dz=p.z-this.center.z;return{x:dx*Math.cos(this.h)-dz*Math.sin(this.h),z:dx*Math.sin(this.h)+dz*Math.cos(this.h)};}
 update(time:number){
  if(!this.pods.visible)return;
  for(let i=0;i<3;i++){
   const t=(time*.025+i/3)%1,angle=(.06*this.track.length-128+t*256)/this.track.radius,side=i%2?-1:1,p=this.track.point(angle,(this.track.widthAt(angle)+17)*side),local=this.local(p),scale=Math.min(1,t*14,(1-t)*14);
   this.pose.position.set(local.x,23.65,local.z);this.pose.rotation.set(0,this.track.heading(angle)-this.h,0);this.pose.scale.setScalar(scale);this.pose.updateMatrix();this.pods.setMatrixAt(i,this.pose.matrix);
   this.pose.translateZ(2.5);this.pose.updateMatrix();this.lights.setMatrixAt(i,this.pose.matrix);
  }this.pods.instanceMatrix.needsUpdate=true;this.lights.instanceMatrix.needsUpdate=true;
 }
 setLow(low:boolean){this.pods.visible=this.lights.visible=!low;this.housings.root.visible=!low;this.optional.forEach(o=>o.visible=!low);}
 dispose(){for(const child of [...this.root.children])if(child.userData.readableSign)disposeSign(child);this.housings.dispose();for(const mesh of [this.pods,this.lights]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}this.root.removeFromParent();}
}

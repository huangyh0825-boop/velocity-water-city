import * as THREE from 'three';
import type {CityTrack} from '../track/CityTrack';
import {CITY_MODULES,type CitySite} from '../environment/CityDensityLayout';
import {siteWorld} from '../environment/WorldCityLayout';
import {cityServices,SERVICE_MODULES} from '../environment/CityServicesLayout';
export interface CameraSolid {x:number;y:number;z:number;width:number;height:number;depth:number;heading?:number}
/** Camera-only swept sphere against static oriented bounds; never boat physics. */
export class CameraObstacles {
 private grid=new Map<string,CameraSolid[]>();private candidates=new Set<CameraSolid>();
 add(b:CameraSolid){const r=Math.hypot(b.width,b.depth)/2+.4;for(let x=Math.floor((b.x-r)/32);x<=Math.floor((b.x+r)/32);x++)for(let z=Math.floor((b.z-r)/32);z<=Math.floor((b.z+r)/32);z++){const key=`${x}:${z}`,list=this.grid.get(key)??[];list.push(b);this.grid.set(key,list);}}
 distance(a:THREE.Vector3,b:THREE.Vector3,radius=.28){
  const length=a.distanceTo(b);if(length<1e-6)return length;this.candidates.clear();
  for(let x=Math.floor((Math.min(a.x,b.x)-radius)/32);x<=Math.floor((Math.max(a.x,b.x)+radius)/32);x++)for(let z=Math.floor((Math.min(a.z,b.z)-radius)/32);z<=Math.floor((Math.max(a.z,b.z)+radius)/32);z++)for(const solid of this.grid.get(`${x}:${z}`)??[])this.candidates.add(solid);
  let result=length;for(const box of this.candidates){const c=Math.cos(box.heading??0),s=Math.sin(box.heading??0),ax=a.x-box.x,az=a.z-box.z,dx=b.x-a.x,dz=b.z-a.z;
   const p=[ax*c-az*s,a.y-box.y,ax*s+az*c],d=[dx*c-dz*s,b.y-a.y,dx*s+dz*c],half=[box.width/2+radius,box.height/2+radius,box.depth/2+radius];let enter=0,exit=1,hit=true;
   for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-9){if(Math.abs(p[i])>half[i])hit=false;}else{let near=(-half[i]-p[i])/d[i],far=(half[i]-p[i])/d[i];if(near>far)[near,far]=[far,near];enter=Math.max(enter,near);exit=Math.min(exit,far);}}
   if(hit&&exit>=enter&&exit>=0&&enter<=1)result=Math.min(result,Math.max(.05,enter*length-.12));
  }return result;
 }
 static from(track:CityTrack,sites:CitySite[],scene:THREE.Scene){
  const index=new CameraObstacles();for(const s of sites){const height=CITY_MODULES[s.kind].height*s.scaleY;index.add({...siteWorld(track,s),y:height/2,width:s.rx*2,depth:s.rz*2,height});}
  for(const s of cityServices(track)){const m=SERVICE_MODULES[s.kind],sx=s.scaleX??1,sy=s.scaleY??1,base={x:s.worldX,z:s.worldZ,heading:s.worldHeading};
   if(s.kind!=='waterfront_bridge')index.add({...base,y:m.height*sy/2,width:m.width*sx,depth:m.depth,height:m.height*sy});
   else{for(const side of [-1,1])index.add({...base,x:base.x+Math.cos(base.heading)*30.5*sx*side,z:base.z-Math.sin(base.heading)*30.5*sx*side,y:9.45*sy,width:8*sx,depth:15,height:18.9*sy});index.add({...base,y:26.6*sy,width:70*sx,depth:15,height:16*sy});}
  }
  for(const b of [{x:62,z:-84,rx:23,rz:20,heading:.1,height:96},{x:-68,z:58,rx:30,rz:22,heading:-.18,height:102},{x:70,z:68,rx:34,rz:25,heading:.12,height:33}])index.add({...siteWorld(track,b),y:b.height/2,width:b.rx*2,depth:b.rz*2,height:b.height});
  scene.traverse(o=>{for(const b of o.userData.cameraSolids??[])index.add(b);});
  for(const side of [-1,1])index.add({...siteWorld(track,{x:side*30.5,z:20,heading:0,rx:4,rz:7.5}),y:9.5,width:8,depth:15,height:19});
  index.add({...siteWorld(track,{x:0,z:20,heading:0,rx:35,rz:7.5}),y:27,width:70,depth:15,height:16});return index;
 }
}

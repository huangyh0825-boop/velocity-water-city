import {CityTrack} from '../track/CityTrack';
import {TAU} from '../track/Track';

export const CITY_MODULES={
 spindle_office:{rx:12,rz:15,height:65},terrace_residence:{rx:13,rz:13,height:52},
 split_office:{rx:14,rz:15,height:80},research_campus:{rx:14,rz:15,height:20},
 data_centre:{rx:12,rz:15,height:16},retail_hub:{rx:16,rz:11,height:12},
 transit_station:{rx:13,rz:16,height:31},drydock_service:{rx:8,rz:12,height:8},
} as const;
export type CityModule=keyof typeof CITY_MODULES;
export type CityLayer='waterfront'|'blocks'|'skyline';
export interface Footprint {x:number;z:number;rx:number;rz:number;heading:number}
export interface CitySite extends Footprint {id:string;kind:CityModule;layer:CityLayer;scaleXZ:number;scaleY:number;radius:number;angle:number;side:number;tint:number}
export function footprintsOverlap(a:Footprint,b:Footprint,gap=1.5){
 const axes=(r:Footprint)=>[{x:Math.cos(r.heading),z:-Math.sin(r.heading)},{x:Math.sin(r.heading),z:Math.cos(r.heading)}],aa=axes(a),bb=axes(b);
 const dot=(a:{x:number;z:number},b:{x:number;z:number})=>a.x*b.x+a.z*b.z;
 return [...aa,...bb].every(axis=>Math.abs((b.x-a.x)*axis.x+(b.z-a.z)*axis.z)<a.rx*Math.abs(dot(aa[0],axis))+a.rz*Math.abs(dot(aa[1],axis))+b.rx*Math.abs(dot(bb[0],axis))+b.rz*Math.abs(dot(bb[1],axis))+gap);
}
export function sampleLocal(track:CityTrack,p:{x:number;z:number}){
 const center=track.point(.06*TAU),h=track.heading(.06*TAU),dx=p.x-center.x,dz=p.z-center.z;
 return {x:dx*Math.cos(h)-dz*Math.sin(h),z:dx*Math.sin(h)+dz*Math.cos(h)};
}
/** Authored streets along the unchanged sample, with conservative footprint reservations. */
export function citySites(track:CityTrack):CitySite[]{
 const sites:CitySite[]=[],reservations:Footprint[]=[{x:62,z:-84,rx:23,rz:20,heading:.1},{x:-68,z:58,rx:30,rz:22,heading:-.18},{x:70,z:68,rx:34,rz:25,heading:.12},{x:-30.5,z:20,rx:3,rz:6,heading:0},{x:30.5,z:20,rx:3,rz:6,heading:0}];
 const reserve=(side:number,index:number,offset:number,rx:number,rz:number)=>{const a=(.06*track.length-140+index*5)/track.radius,p=sampleLocal(track,track.point(a,side*(track.widthAt(a)+offset)));reservations.push({...p,rx,rz,heading:track.heading(a)-track.heading(.06*TAU)});};
 for(const [side,index] of [[-1,8],[1,18],[-1,45]])reserve(side,index,23,12,7);
 for(const [side,index] of [[-1,5],[1,12],[-1,22],[1,37],[-1,47],[1,52]])reserve(side,index,8,3.2,6);
 for(const [side,index] of [[-1,11],[1,6],[-1,37],[1,45],[-1,51],[1,24]])reserve(side,index,13,2.3,5);
 for(const [side,z] of [[1,-65],[-1,85]])reservations.push({x:side*31,z,rx:5.5,rz:15,heading:0});
 const add=(kind:CityModule,layer:CityLayer,along:number,offset:number,side:number,seed:number)=>{
  const a=(.06*track.length+along)/track.radius,p=track.point(a,side*(track.widthAt(a)+offset)),local=sampleLocal(track,p),m=CITY_MODULES[kind];
  const scaleXZ=layer==='skyline'?.68+(seed%4)*.055:layer==='blocks'?.8+(seed%3)*.075:.78;
  const scaleY=layer==='skyline'?1.05+(seed%5)*.20:layer==='blocks'?.72+(seed%5)*.14:1;
  const radius=Math.hypot(m.rx,m.rz)*scaleXZ;
  if(Math.abs(along)+radius>(layer==='skyline'?340:140)||track.contains(p,-radius-3))return;
  const footprint={...local,rx:m.rx*scaleXZ,rz:m.rz*scaleXZ,heading:track.heading(a)-track.heading(.06*TAU)};
  if(reservations.some(r=>footprintsOverlap(footprint,r)))return;
  sites.push({id:`${layer}-${side}-${seed}`,kind,layer,...footprint,scaleXZ,scaleY,radius,angle:a,side,tint:seed%4});reservations.push(footprint);
 };
 const near:CityModule[]=['drydock_service','retail_hub','data_centre','drydock_service','drydock_service','data_centre','retail_hub','drydock_service'];
 for(const side of [-1,1])for(let i=0;i<8;i++){const kind=near[(i+(side>0?2:0))%8];add(kind,'waterfront',-125+i*35,kind==='drydock_service'?28:44,side,i+20+(side>0?8:0));}
 const streets:CityModule[]=['research_campus','transit_station','spindle_office','retail_hub','data_centre','terrace_residence','split_office'];
 for(const side of [-1,1])for(let row=0;row<2;row++)for(let i=0;i<7;i++)add(streets[(i+row*3+(side>0?2:0))%7],'blocks',-116+i*37+row*6,69+row*44,side,40+row*10+i+(side>0?20:0));
 const campus:CityModule[]=['research_campus','retail_hub','data_centre'];
 for(const side of [-1,1])for(let i=0;i<7;i++)add(campus[(i+(side>0?1:0))%3],'blocks',-122+i*40,143,side,160+i+(side>0?10:0));
 const skyline:CityModule[]=['spindle_office','split_office','terrace_residence'];
 for(const side of [-1,1])for(let row=0;row<3;row++)for(let i=0;i<8;i++)add(skyline[(i+row+(side>0?1:0))%3],'skyline',-119+i*33+row*4,167+row*43,side,100+row*10+i+(side>0?40:0));
 // Distant context frames both ends of the sample; it adds no new waterfront route/detail area.
 for(const side of [-1,1])for(let end=0;end<2;end++)for(let row=0;row<2;row++)for(let i=0;i<4;i++)add(skyline[(i+end+row+(side>0?1:0))%3],'skyline',(end?1:-1)*(172+i*46+row*5),80+row*80+(i%2)*34,side,220+end*10+row*50+i+(side>0?30:0));
 return sites;
}
/** Distance hysteresis keeps transitions stable; far skyline always uses cheap silhouettes. */
export function cityLOD(layer:CityLayer,distance:number,previous:number,low:boolean){
 if(layer==='skyline')return 2;
 const near=low?70:125,far=low?210:290,slack=10;
 if(previous===0&&distance<near+slack)return 0;
 if(previous===2&&distance>far-slack)return 2;
 return distance<near-slack?0:distance>far+slack?2:1;
}

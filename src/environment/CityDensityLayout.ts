import {CityTrack} from '../track/CityTrack';
import {TAU} from '../track/Track';
import {trackClearance} from '../track/TrackClearance';

export const CITY_MODULES={
 spindle_office:{rx:12,rz:15,height:65},terrace_residence:{rx:13,rz:13,height:52},
 split_office:{rx:14,rz:15,height:80},research_campus:{rx:14,rz:15,height:20},
 data_centre:{rx:12,rz:15,height:16},retail_hub:{rx:16,rz:11,height:12},
 transit_station:{rx:13,rz:16,height:31},drydock_service:{rx:8,rz:12,height:8},
 harbor_control:{rx:5.5,rz:8,height:10},service_arcade:{rx:11.5,rz:8,height:11},
 energy_node:{rx:7,rz:9,height:14},view_pavilion:{rx:7.5,rz:9,height:8},
 expo_hall:{rx:19,rz:15,height:24},control_centre:{rx:12.5,rz:11,height:35},
 terraced_hotel:{rx:14,rz:15,height:72},ring_spire:{rx:12,rz:13,height:105},
 blade_tower:{rx:13,rz:13,height:92},sky_gallery:{rx:14,rz:11,height:28},
 service_depot:{rx:6,rz:7,height:9},ferry_terminal:{rx:10,rz:12,height:15},
 market_galleria:{rx:12,rz:12,height:24},bio_lab:{rx:9,rz:11,height:30},
 cooling_exchange:{rx:6,rz:8,height:17},sail_office:{rx:13,rz:15,height:95},
 lattice_tower:{rx:12,rz:14,height:110},commuter_hub:{rx:10,rz:11,height:25},
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
 const clearance=trackClearance(track);
 const sites:CitySite[]=[],reservations:Footprint[]=[{x:62,z:-84,rx:23,rz:20,heading:.1},{x:-68,z:58,rx:30,rz:22,heading:-.18},{x:70,z:68,rx:34,rz:25,heading:.12},{x:-30.5,z:20,rx:3,rz:6,heading:0},{x:30.5,z:20,rx:3,rz:6,heading:0}];
 const reserve=(side:number,index:number,offset:number,rx:number,rz:number)=>{const a=(.06*track.length-140+index*5)/track.radius,p=sampleLocal(track,track.point(a,side*(track.widthAt(a)+offset)));reservations.push({...p,rx,rz,heading:track.heading(a)-track.heading(.06*TAU)});};
 for(const [side,index] of [[-1,8],[1,18],[-1,45]])reserve(side,index,23,12,7);
 for(const [side,index] of [[-1,5],[1,12],[-1,22],[1,37],[-1,47],[1,52]])reserve(side,index,8,3.2,6);
 for(const [side,index] of [[-1,11],[1,6],[-1,37],[1,45],[-1,51],[1,24]])reserve(side,index,13,2.3,5);
 for(const [side,z] of [[1,-65],[-1,85]])reservations.push({x:side*31,z,rx:5.5,rz:15,heading:0});
 const add=(kind:CityModule,layer:CityLayer,along:number,offset:number,side:number,seed:number)=>{
  const a=(.06*track.length+along)/track.radius,p=track.point(a,side*(track.widthAt(a)+offset)),m=CITY_MODULES[kind];
  const scaleXZ=layer==='skyline'?.68+(seed%4)*.055:layer==='blocks'?.8+(seed%3)*.075:.78;
  const scaleY=layer==='skyline'?1.05+(seed%5)*.20:layer==='blocks'?.72+(seed%5)*.14:1;
  const radius=Math.hypot(m.rx,m.rz)*scaleXZ;
  if(Math.abs(along)+radius>(layer==='skyline'?340:140)||track.contains(p,-radius-3))return;
  let shift=0;while(clearance.intersects({x:p.x,y:m.height*scaleY/2,z:p.z,width:m.rx*scaleXZ*2,depth:m.rz*scaleXZ*2,height:m.height*scaleY+2,heading:track.heading(a)})&&shift<100){shift+=2;Object.assign(p,track.point(a,side*(track.widthAt(a)+offset+shift)));}
  const local=sampleLocal(track,p);
  const footprint={...local,rx:m.rx*scaleXZ,rz:m.rz*scaleXZ,heading:track.heading(a)-track.heading(.06*TAU)};
  if(reservations.some(r=>footprintsOverlap(footprint,r)))return;
  sites.push({id:`${layer}-${side}-${seed}`,kind,layer,...footprint,scaleXZ,scaleY,radius,angle:a,side,tint:seed%4});reservations.push(footprint);
 };
 for(const side of [-1,1])add('drydock_service','waterfront',side>0?-104:105,32,side,390+(side>0?1:0));
 const frontage:CityModule[]=['harbor_control','view_pavilion','energy_node','harbor_control','service_arcade','view_pavilion'];
 for(const side of [-1,1])for(let i=0;i<15;i++){const kind=frontage[(i+(side>0?2:0))%6];add(kind,'waterfront',-126+i*18,kind==='service_arcade'?26:22,side,400+i+(side>0?20:0));}
 const near:CityModule[]=['drydock_service','service_arcade','data_centre','harbor_control','drydock_service','energy_node','retail_hub','view_pavilion'];
 for(const side of [-1,1])for(let i=0;i<8;i++){const kind=near[(i+(side>0?2:0))%8];add(kind,'waterfront',-125+i*35,kind==='drydock_service'?28:44,side,i+20+(side>0?8:0));}
 const streets:CityModule[]=['expo_hall','transit_station','ring_spire','control_centre','data_centre','terraced_hotel','blade_tower','sky_gallery','research_campus','split_office','retail_hub','terrace_residence'];
 for(const side of [-1,1])for(let row=0;row<3;row++)for(let i=0;i<10;i++)add(streets[(i+row*3+(side>0?4:0))%streets.length],'blocks',-120+i*26+row*3,57+row*33,side,500+row*20+i+(side>0?80:0));
 const campus:CityModule[]=['research_campus','service_arcade','data_centre','expo_hall','control_centre'];
 for(const side of [-1,1])for(let i=0;i<9;i++)add(campus[(i+(side>0?2:0))%5],'blocks',-122+i*30,148,side,700+i+(side>0?20:0));
 const skyline:CityModule[]=['spindle_office','blade_tower','terraced_hotel','ring_spire','split_office','terrace_residence'];
 for(const side of [-1,1])for(let row=0;row<4;row++)for(let i=0;i<10;i++)add(skyline[(i+row+(side>0?2:0))%6],'skyline',-120+i*26+row*2,178+row*31,side,800+row*20+i+(side>0?100:0));
 // Distant context frames both ends of the sample; it adds no new waterfront route/detail area.
 for(const side of [-1,1])for(let end=0;end<2;end++)for(let row=0;row<2;row++)for(let i=0;i<5;i++)add(skyline[(i+end+row+(side>0?2:0))%6],'skyline',(end?1:-1)*(168+i*33+row*5),76+row*72+(i%2)*30,side,1100+end*50+row*20+i+(side>0?100:0));
 // Fill gaps in the existing district rather than moving its approved buildings.
 const fill=(kind:CityModule,layer:CityLayer,offsets:number[],spacing:number,seed:number,target:number)=>{
  for(const side of [-1,1]){let count=0;for(const offset of offsets){for(let i=0;i<Math.floor(250/spacing);i++){
   const old=sites.length;add(kind,layer,-124+i*spacing+(seed%7),offset,side,seed+i+Math.round(offset)*10+(side>0?10000:0));
   if(sites.length>old&&++count>=target)break;
  }if(count>=target)break;}}
 };
 fill('ferry_terminal','waterfront',[38,48,24],21,2000,2);
 fill('market_galleria','blocks',[62,83,108,134,153],23,2100,2);
 fill('bio_lab','blocks',[62,83,108,134,153],19,2200,3);
 fill('commuter_hub','blocks',[62,83,108,134,153],19,2300,2);
 fill('lattice_tower','skyline',[164,196,228,260,288],21,2500,3);
 fill('sail_office','skyline',[166,195,223,253,289],19,2400,4);
 fill('lattice_tower','skyline',[166,173,180,187,202,209,216,230,237,244,258,265,272,279,290],11,3000,4);
 fill('sail_office','skyline',[169,176,183,190,205,212,219,233,240,247,261,268,275,282,292],11,3100,4);
 fill('service_depot','waterfront',[17,31,44],12,2600,5);
 fill('cooling_exchange','waterfront',[18,33,48],13,2700,4);
 fill('service_depot','blocks',[52,72,93,113,136,153],15,2800,4);
 fill('harbor_control','waterfront',[16,23,30,37,44,51],11,3200,3);
 return sites;
}
/** PC keeps full authored facades three times farther away. One tier at a time:
 * hysteresis avoids toggling; no alpha overlap, temporal trails or hidden buildings. */
export const CITY_DETAIL_RANGE={standard:{near:375,far:800,slack:35},low:{near:70,far:210,slack:10}} as const;
export function cityLOD(layer:CityLayer,distance:number,previous:number,low:boolean){
 if(low&&layer==='skyline')return 2;
 const {near,far,slack}=low?CITY_DETAIL_RANGE.low:CITY_DETAIL_RANGE.standard;
 if(previous===0&&distance<near+slack)return 0;
 if(previous===2&&distance>far-slack)return 2;
 return distance<near-slack?0:distance>far+slack?2:1;
}

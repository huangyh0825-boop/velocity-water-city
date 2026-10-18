import {CityTrack} from '../track/CityTrack';
import {TAU} from '../track/Track';
import {trackClearance} from '../track/TrackClearance';
import {CITY_MODULES,citySites,footprintsOverlap,sampleLocal,type CityModule,type CitySite,type CityLayer,type Footprint} from './CityDensityLayout';
import {cityServices} from './CityServicesLayout';

/** Art zoning only. Fractions refer to the existing, unmodified race centreline. */
export const CITY_DISTRICTS=[
 {id:'central',name:'中央商务区',from:0,to:.16,near:['market_galleria','service_arcade','retail_hub','harbor_control'],mid:['split_office','spindle_office','terraced_hotel','market_galleria','lattice_tower'],far:['ring_spire','split_office','sail_office']},
 {id:'science',name:'未来科技区',from:.16,to:.30,near:['bio_lab','energy_node','service_depot','view_pavilion'],mid:['research_campus','data_centre','control_centre','bio_lab','expo_hall'],far:['blade_tower','lattice_tower','spindle_office']},
 {id:'transit',name:'高架交通区',from:.30,to:.46,near:['commuter_hub','service_depot','ferry_terminal','cooling_exchange'],mid:['transit_station','sky_gallery','commuter_hub','control_centre','data_centre'],far:['sail_office','split_office','blade_tower']},
 {id:'industrial',name:'地下水道与工业区',from:.46,to:.65,near:['service_depot','drydock_service','cooling_exchange','harbor_control'],mid:['data_centre','control_centre','energy_node','bio_lab','research_campus'],far:['lattice_tower','spindle_office','split_office']},
 {id:'harbor',name:'港湾区',from:.65,to:.86,near:['drydock_service','ferry_terminal','harbor_control','service_depot'],mid:['ferry_terminal','control_centre','market_galleria','data_centre','commuter_hub'],far:['sail_office','terraced_hotel','blade_tower']},
 {id:'leisure',name:'城市休闲区',from:.86,to:1,near:['view_pavilion','service_arcade','retail_hub','market_galleria'],mid:['expo_hall','terraced_hotel','terrace_residence','sky_gallery','market_galleria'],far:['ring_spire','terrace_residence','sail_office']},
] as const;
export function districtAt(angle:number){const t=((angle/TAU)%1+1)%1;return CITY_DISTRICTS.find(d=>t>=d.from&&t<d.to)!;}
export function siteWorld(track:CityTrack,s:Footprint){const c=track.point(.06*TAU),h=track.heading(.06*TAU);return{x:c.x+Math.cos(h)*s.x+Math.sin(h)*s.z,z:c.z-Math.sin(h)*s.x+Math.cos(h)*s.z,heading:h+s.heading};}

/** Reuses the approved 26 authored GLBs without rebuilding or moving the sample. */
export function worldCitySites(track:CityTrack):CitySite[]{
 const sites=citySites(track),reserved:Footprint[]=[...sites,...cityServices(track),
  {x:62,z:-84,rx:23,rz:20,heading:.1},{x:-68,z:58,rx:30,rz:22,heading:-.18},{x:70,z:68,rx:34,rz:25,heading:.12}];
 const clearance=trackClearance(track),sampleHeading=track.heading(.06*TAU);
 const grid=new Map<string,Footprint[]>();
 const cells=(r:Footprint)=>{const c=Math.abs(Math.cos(r.heading)),s=Math.abs(Math.sin(r.heading)),x=c*r.rx+s*r.rz+3,z=s*r.rx+c*r.rz+3,keys:string[]=[];for(let i=Math.floor((r.x-x)/48);i<=Math.floor((r.x+x)/48);i++)for(let j=Math.floor((r.z-z)/48);j<=Math.floor((r.z+z)/48);j++)keys.push(`${i}:${j}`);return keys;};
 const reserve=(r:Footprint)=>{for(const key of cells(r)){const rows=grid.get(key)??[];rows.push(r);grid.set(key,rows);}};
 reserved.forEach(reserve);
 // Preserve the authored waterfront platforms, advertisements and local transit.
 const sampleReserve=(s:CitySite)=>{const t=s.angle/TAU;return(t<.125||t>.995)&&s.layer!=='skyline';};
 function add(kind:CityModule,layer:CityLayer,t:number,offset:number,side:number,seed:number,route:string|null=null,infill=false){
  const a=t*TAU,m=CITY_MODULES[kind],scaleXZ=layer==='waterfront'?.78:layer==='blocks'?.8+(seed%3)*.075:.68+(seed%4)*.055;
  const scaleY=layer==='skyline'?1.05+(seed%5)*.2:layer==='blocks'?.72+(seed%5)*.14:1;
  const heading=track.routeHeading(a,route),width=track.routeWidth(a,route);
  // Entrances look towards the water; the approved library's front faces local -Z.
  const orientation=heading+side*Math.PI/2;
  for(let shift=0;shift<=(infill?0:150);shift+=3){
   const p=track.routePoint(a,side*(width+offset+shift),route),local=sampleLocal(track,p);
   // Include authored entry canopies, trims, and contact shadows in the reserved box.
   const s:CitySite={id:`world-${infill?'infill-':''}${route??'main'}-${layer}-${side}-${seed}`,kind,layer,...local,rx:(m.rx+.3)*scaleXZ,rz:(m.rz+.3)*scaleXZ,heading:orientation-sampleHeading,scaleXZ,scaleY,radius:Math.hypot(m.rx,m.rz)*scaleXZ,angle:a,side,tint:seed%4};
   if(sampleReserve(s))return;
   if(clearance.intersects({x:p.x,z:p.z,y:(m.height*scaleY+2)/2,width:s.rx*2.12,depth:s.rz*2.12,height:m.height*scaleY+2,heading:orientation}))continue;
   if(cells(s).some(key=>(grid.get(key)??[]).some(r=>footprintsOverlap(s,r,2.5))))continue;
   reserve(s);sites.push(s);return;
  }
 }
 for(const [di,d]of CITY_DISTRICTS.entries()){
  for(const side of [-1,1])for(const layer of ['waterfront','blocks','skyline'] as const){
   const kinds=d[layer==='waterfront'?'near':layer==='blocks'?'mid':'far'],spacing=layer==='waterfront'?24:layer==='blocks'?34:48,rows=layer==='skyline'?2:3;
   for(let row=0;row<rows;row++)for(let i=0;i<Math.floor((d.to-d.from)*track.length/spacing);i++){
    const seed=di*10000+(side+1)*2000+row*200+i,along=d.from*track.length+spacing*(i+.45)+row*7+Math.sin(i*2.31+row+di)*3;
    if(along>=d.to*track.length)continue;
    const offset=layer==='waterfront'?19+row*20+(i%3)*2:layer==='blocks'?83+row*35+(i%2)*8:205+row*57+(i%3)*5;
    add(kinds[(i+row*2+di+(side>0?1:0))%kinds.length] as CityModule,layer,along/track.length,offset,side,seed);
   }
  }
 }
 // Branches receive the same authored frontage, not a lower-quality tunnel/viaduct kit.
 for(const [ci,cut]of track.shortcuts.entries())for(const side of [-1,1])for(let i=2;i<Math.floor(cut.length/38)-2;i++){
  const kinds:CityModule[]=ci?['ferry_terminal','commuter_hub','service_depot']:['service_depot','cooling_exchange','harbor_control'];
  add(kinds[i%kinds.length],'waterfront',(cut.from+(cut.to-cut.from)*(i+.3)*38/cut.length)/TAU,20,side,90000+ci*1000+(side+1)*200+i,cut.id);
 }
 // Complete selected genuinely empty civic plots with the SAME full-quality
 // small-building library. No displacement of the approved city, no new towers.
 for(const[di,d]of CITY_DISTRICTS.entries()){
  let added=0;const target=d.id==='central'?8:10;
  const kinds:CityModule[]=d.id==='industrial'||d.id==='harbor'?['service_depot','harbor_control','drydock_service']:d.id==='science'?['service_depot','view_pavilion','energy_node']:d.id==='transit'?['harbor_control','service_depot','view_pavilion']:['service_arcade','view_pavilion','harbor_control'];
  for(let i=0;i<Math.floor((d.to-d.from)*track.length/18)&&added<target;i++)for(const side of[-1,1])for(const offset of[22,39,57,78,96]){
   if(added>=target)break;const n=sites.length,t=d.from+(i+.35)*18/track.length;
   add(kinds[(i+(side>0?1:0))%kinds.length],'waterfront',t,offset,side,200000+di*100000+i*1000+(side>0?100:0)+offset,null,true);
   if(sites.length>n)added++;
  }
 }
 return sites;
}

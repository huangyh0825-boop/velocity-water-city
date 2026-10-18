import {CityTrack} from '../track/CityTrack';
import {TAU} from '../track/Track';
import {trackClearance} from '../track/TrackClearance';
import {footprintsOverlap,type CitySite,type Footprint} from './CityDensityLayout';
import {siteWorld,districtAt} from './WorldCityLayout';
import {cityServices} from './CityServicesLayout';
import {publicGroundCells} from './CityVacancy';

export type PocketKind='promenade'|'viewing'|'garden'|'service'|'courtyard'|'rest-stop'|'park'|'market'|'maintenance'|'transit-court'|'race-plaza';
export interface WaterfrontPocket extends Footprint {id:string;kind:PocketKind;district:string;angle:number;side:number;route:string|null;seed:number}
/** Designed pockets on existing dry quays and building forecourts. No track mutation. */
export function waterfrontLayout(track:CityTrack,sites:CitySite[]){
 const clear=trackClearance(track),pockets:WaterfrontPocket[]=[],grid=new Map<string,Footprint[]>();
 const cells=(s:Footprint)=>{const r=Math.hypot(s.rx,s.rz)+1,keys:string[]=[];for(let x=Math.floor((s.x-r)/32);x<=Math.floor((s.x+r)/32);x++)for(let z=Math.floor((s.z-r)/32);z<=Math.floor((s.z+r)/32);z++)keys.push(`${x}:${z}`);return keys;};
 const reserve=(s:Footprint)=>{for(const key of cells(s)){const list=grid.get(key)??[];list.push(s);grid.set(key,list);}};
 sites.forEach(s=>reserve({...s,...siteWorld(track,s)}));cityServices(track).forEach(s=>reserve({...s,...siteWorld(track,s)}));
 for(const s of [{x:62,z:-84,rx:23,rz:20,heading:.1},{x:-68,z:58,rx:30,rz:22,heading:-.18},{x:70,z:68,rx:34,rz:25,heading:.12},{x:-30.5,z:20,rx:4,rz:8,heading:0},{x:30.5,z:20,rx:4,rz:8,heading:0}])reserve({...s,...siteWorld(track,s)});
 // Existing sample lamps, planted strips, shopfront kiosks and shelters also
 // occupy the promenade. Preserve them, rather than stacking new props on top.
 const sampleBay=(side:number,index:number,offset:number,rx:number,rz:number)=>{const angle=(.06*track.length-140+index*5)/track.radius,p=track.point(angle,side*(track.widthAt(angle)+offset));reserve({...p,rx,rz,heading:track.heading(angle)});};
 for(const side of [-1,1])for(let i=3;i<53;i+=4)sampleBay(side,i,5.3,.55,.55);
 for(const [side,index]of[[-1,8],[1,18],[-1,45]])sampleBay(side,index,23,12,7);
 for(const [side,index]of[[-1,5],[1,12],[-1,22],[1,37],[-1,47],[1,52]])sampleBay(side,index,8,3.2,6);
 for(const [side,index]of[[-1,11],[1,6],[-1,37],[1,45],[-1,51],[1,24]])sampleBay(side,index,13,2.3,5);
 for(const [side,z]of[[1,-65],[-1,85]])reserve({...siteWorld(track,{x:side*31,z,heading:0,rx:5.5,rz:15}),rx:5.5,rz:15});
 const add=(s:WaterfrontPocket)=>{
  if(cells(s).some(key=>(grid.get(key)??[]).some(b=>footprintsOverlap(s,b,.7))))return false;
  if(clear.intersects({x:s.x,y:3.5,z:s.z,width:s.rx*2,depth:s.rz*2,height:7,heading:s.heading}))return false;
  const c=Math.cos(s.heading),h=Math.sin(s.heading);
  for(const u of [-1,0,1])for(const v of [-1,0,1])if(track.contains({x:s.x+c*s.rx*u+h*s.rz*v,z:s.z-h*s.rx*u+c*s.rz*v},-.6))return false;
  pockets.push(s);reserve(s);return true;
 };
 for(const route of [null,...track.shortcuts.map(s=>s.id)]){
  const cut=track.shortcuts.find(s=>s.id===route),length=cut?.length??track.length,count=Math.floor(length/54);
  for(let i=0;i<count;i++)for(const side of [-1,1]){
   const t=(i+.45)/count,angle=cut?cut.from+(cut.to-cut.from)*t:t*TAU;
   if(track.heightAt(angle,route)>.25)continue; // No unsupported pavement beside a high canal.
   const p=track.routePoint(angle,side*(track.routeWidth(angle,route)+8.6),route),heading=track.routeHeading(angle,route),district=districtAt(angle).id;
   const curve=Math.sin(track.routeHeading(angle+.012,route)-track.routeHeading(angle-.012,route));
   const kind:PocketKind=Math.abs(curve)>.06&&side===-Math.sign(curve)?'viewing':district==='industrial'||district==='harbor'?'service':district==='leisure'||district==='science'?'garden':'promenade';
   add({id:`quay-${route??'main'}-${i}-${side}`,kind,district,x:p.x,z:p.z,rx:3.2,rz:7.2,heading,angle,side,route,seed:i*3+(side>0?1:0)});
  }
 }
 // Narrow rest/observation bays fit between bridge piers and existing entrances
 // where a full plaza would block circulation. They obey the same reservations.
 for(const route of [null,...track.shortcuts.map(s=>s.id)]){
  const cut=track.shortcuts.find(s=>s.id===route),count=Math.floor((cut?.length??track.length)/22);
  for(let i=0;i<count;i++)for(const side of [-1,1]){
   const t=(i+.27)/count,angle=cut?cut.from+(cut.to-cut.from)*t:t*TAU;
   if(track.heightAt(angle,route)>.25)continue;
   const p=track.routePoint(angle,side*(track.routeWidth(angle,route)+5.1),route);
   add({id:`rest-${route??'main'}-${i}-${side}`,kind:'rest-stop',district:districtAt(angle).id,x:p.x,z:p.z,rx:1.45,rz:3.6,heading:track.routeHeading(angle,route),angle,side,route,seed:3000+i*3+(side>0?1:0)});
  }
 }
 // Complete the unused entrance apron of selected existing low-rise buildings;
 // different from the thin bank ribbon, these make the gaps read as plazas.
 const counts=new Map<string,number>();
 for(const [i,s]of sites.entries()){
  if(s.layer==='skyline'||!['retail_hub','market_galleria','service_arcade','view_pavilion','expo_hall','research_campus','ferry_terminal','data_centre','control_centre'].includes(s.kind))continue;
  const area=districtAt(s.angle),district=area.id,t=s.angle/TAU,bin=Math.max(0,Math.min(5,Math.floor((t-area.from)/(area.to-area.from)*6))),key=`${district}-${bin}`;if((counts.get(key)??0)>=2)continue;
  const p=siteWorld(track,s),shift=s.rz+6.7;
  if(add({id:`forecourt-${s.id}`,kind:'courtyard',district,x:p.x-Math.sin(p.heading)*shift,z:p.z-Math.cos(p.heading)*shift,heading:p.heading,rx:Math.min(7,s.rx),rz:4.3,angle:s.angle,side:s.side,route:null,seed:1000+i}))counts.set(key,(counts.get(key)??0)+1);
 }
 // Fill actual vacant land beyond the narrow quay ribbon, including dry ground
 // beside elevated canals. Larger plots are attempted first, then pocket courts.
 // Existing authored spaces and all their entrances remain reserved above.
 const groundCells=publicGroundCells(track,sites),land=new Set(groundCells.map(p=>`${Math.floor(p.x/5)}:${Math.floor(p.z/5)}`));
 const grounded=(s:Footprint)=>{const c=Math.cos(s.heading),h=Math.sin(s.heading);for(const u of[-1,0,1])for(const v of[-1,0,1]){const x=s.x+c*s.rx*u+h*s.rz*v,z=s.z-h*s.rx*u+c*s.rz*v;if(!land.has(`${Math.floor(x/5)}:${Math.floor(z/5)}`))return false;}return true;};
 for(const[rx,rz]of[[9,10],[7,8],[5,6],[3.8,4.5]])for(const[i,p]of groundCells.entries()){
  if(i%2&&rx>7)continue;
  const kind:PocketKind=p.district==='industrial'||p.district==='harbor'?'maintenance':p.district==='science'?'park':p.district==='transit'?'transit-court':p.district==='central'?(i%3?'market':'race-plaza'):i%3?'park':'race-plaza';
  const s:WaterfrontPocket={...p,rx,rz,id:`civic-${rx}-${i}`,kind,route:null,seed:5000+i};
  if(grounded(s))add(s);
 }
 return pockets;
}

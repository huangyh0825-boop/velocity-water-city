import {CityTrack} from '../track/CityTrack';
import {trackClearance} from '../track/TrackClearance';
import {citySites,footprintsOverlap,sampleLocal,type Footprint} from './CityDensityLayout';

export const SERVICE_MODULES={promenade:{width:7,depth:18,height:6.5},cargo_crane:{width:16,depth:25,height:27},utility_exchange:{width:10,depth:14,height:13},transit_link:{width:12,depth:30,height:20},waterfront_bridge:{width:70,depth:15,height:36},aster_landmark:{width:44,depth:46,height:96},helix_landmark:{width:58,depth:51,height:102},marina_landmark:{width:65,depth:54,height:33}} as const;
export type ServiceKind=keyof typeof SERVICE_MODULES;
export interface ServiceSite extends Footprint {id:string;kind:ServiceKind;angle:number;side:number;worldX:number;worldZ:number;worldHeading:number;scaleX?:number;scaleY?:number}
const cache=new WeakMap<CityTrack,ServiceSite[]>();
export function cityServices(track:CityTrack){
 const cached=cache.get(track);if(cached)return cached;
 const rows:ServiceSite[]=[],clear=trackClearance(track),reserved:Footprint[]=citySites(track),h=track.heading(.06*Math.PI*2);
 for(const t of [.29,.40,.91]){
  const a=t*Math.PI*2,p=track.point(a),heading=track.heading(a),local=sampleLocal(track,p);let sx=(track.widthAt(a)+10)/30.5,sy=1;
  for(let i=0;i<30;i++){
   sy=(clear.overhead(p.x,p.z,70*sx,15,heading,19)+1)/18.6;
   const blocked=[-1,1].some(side=>clear.intersects({x:p.x+Math.cos(heading)*30.5*sx*side,z:p.z-Math.sin(heading)*30.5*sx*side,heading,y:18.9*sy/2,width:8*sx,depth:15,height:18.9*sy}));
   if(!blocked)break;sx+=.08;if(i===29)throw Error('No clear authored bridge supports');
  }
  const s:ServiceSite={id:`bridge-${t}`,kind:'waterfront_bridge',...local,rx:35*sx,rz:7.5,heading:heading-h,worldX:p.x,worldZ:p.z,worldHeading:heading,side:0,angle:a,scaleX:sx,scaleY:sy};rows.push(s);reserved.push(s);
 }
 // Exact sample landmark meshes, at original scale, frame each district's
 // focal waterfront. Reserve them before street plots, not after filling gaps.
 for(const [index,t]of [.215,.35,.555,.735,.915].entries())for(const side of [-1,1]){
  const kinds:ServiceKind[]=['aster_landmark','helix_landmark','marina_landmark'],kind=kinds[(index+(side>0?1:0))%3],m=SERVICE_MODULES[kind],angle=(t+side*.010)*Math.PI*2,heading=track.heading(angle)+side*Math.PI/2;
  let placed=false;for(let shift=0;shift<180;shift+=3){
   const p=track.point(angle,side*(track.widthAt(angle)+m.depth/2+12+shift)),local=sampleLocal(track,p),s:ServiceSite={id:`landmark-${index}-${side}`,kind,...local,rx:m.width/2,rz:m.depth/2,heading:heading-h,worldX:p.x,worldZ:p.z,worldHeading:heading,side,angle};
   if(clear.intersects({x:p.x,z:p.z,y:m.height/2,width:m.width,depth:m.depth,height:m.height,heading})||reserved.some(r=>footprintsOverlap(s,r,3)))continue;
   rows.push(s);reserved.push(s);placed=true;break;
  }if(!placed)throw Error(`No safe full-quality landmark plot ${index}:${side}`);
 }
 for(const side of [-1,1])for(let i=0;i<Math.floor(track.length/48);i++){
  const t=(i+.35)/Math.floor(track.length/48);if(t<.13||t>.99)continue;
  const kind:ServiceKind=t>.65&&t<.85&&i%3===0?'cargo_crane':t>.46&&t<.65&&i%3===0?'utility_exchange':t>.3&&t<.46&&i%3===0?'transit_link':'promenade',m=SERVICE_MODULES[kind],a=t*Math.PI*2,heading=track.heading(a);
  for(let shift=0;shift<40;shift+=2){
   const p=track.point(a,side*(track.widthAt(a)+m.width/2+3+shift)),local=sampleLocal(track,p),r:ServiceSite={id:`service-${side}-${i}`,kind,...local,rx:m.width/2,rz:m.depth/2,heading:heading-h,worldX:p.x,worldZ:p.z,worldHeading:heading,side,angle:a};
   if(clear.intersects({x:p.x,z:p.z,y:m.height/2,width:m.width,depth:m.depth,height:m.height,heading}))continue;
   if(reserved.some(s=>footprintsOverlap(s,r,2)))continue;
   rows.push(r);reserved.push(r);break;
  }
 }
 cache.set(track,rows);return rows;
}

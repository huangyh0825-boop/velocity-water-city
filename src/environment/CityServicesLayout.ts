import {CityTrack} from '../track/CityTrack';
import {trackClearance} from '../track/TrackClearance';
import {citySites,footprintsOverlap,sampleLocal,type Footprint} from './CityDensityLayout';

export const SERVICE_MODULES={promenade:{width:7,depth:18,height:6.5},cargo_crane:{width:16,depth:25,height:27},utility_exchange:{width:10,depth:14,height:13},transit_link:{width:12,depth:30,height:20},waterfront_bridge:{width:70,depth:15,height:36}} as const;
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

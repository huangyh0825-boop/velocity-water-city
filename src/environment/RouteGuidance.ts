import {CityTrack} from '../track/CityTrack';import{trackClearance}from'../track/TrackClearance';
/** Small functional direction signs live on the bank, never over racing water. */
export function bankGuidance(track:CityTrack,angle:number,route:string|null,requested=0){
 const width=4.2,height=1.05,heading=track.routeHeading(angle,route),clear=trackClearance(track),base=Math.abs(requested)||track.routeWidth(angle,route)+3.5;
 for(const side of requested?[Math.sign(requested)]:[1,-1])for(let extra=0;extra<=60;extra+=2){
  const offset=(base+extra)*side,p=track.routePoint(angle,offset,route),floor=p.y??0;
  if(clear.intersects({x:p.x,z:p.z,y:floor+2.9,width,depth:.25,height,heading})||clear.intersects({x:p.x,z:p.z,y:(floor+3.2)/2,width:.45,depth:.45,height:floor+3.2,heading}))continue;
  return{...p,heading,offset,width,height,floor,panelY:floor+2.9};
 }
 throw Error(`No clear bankside route sign at ${angle}`);
}

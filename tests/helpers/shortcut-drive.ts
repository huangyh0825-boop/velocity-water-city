import{CityTrack}from'../../src/track/CityTrack';import{DrivingModel}from'../../src/player/DrivingModel';import{signedAngle}from'../../src/track/Track';
/** Actual player model, input-only steering/throttle/brake. No path-position writes. */
export function driveShortcut(kmh:number,boost=false,lane=0){
 const track=new CityTrack(),cut=track.shortcuts[0],m=new DrivingModel(),start=cut.from+(cut.to-cut.from)*(boost?.38:.62);track.spawn(m,start);Object.assign(m,track.routePoint(start,lane,cut.id));m.heading=track.routeHeading(start,cut.id);m.speed=kmh/3.6;m.vx=Math.sin(m.heading)*m.speed;m.vz=Math.cos(m.heading)*m.speed;m.routeIntent=cut.id;
 let walls=0,minKmh=kmh,maxOffset=0,brakeSteps=0,finished=false;const samples=[];
 for(let i=0;i<1200;i++){const before={x:m.x,z:m.z,route:m.route},active=m.route??null,p=track.routeTarget(m,Math.max(18,m.speed*.65),lane,active),error=signedAngle(Math.atan2(p.x-m.x,p.z-m.z)-m.heading),target=(boost?160:kmh)/3.6;
  const brake=m.speed>target+.3?1:0;brakeSteps+=brake;m.update(1/60,{throttle:m.speed<target?1:0,brake,steer:Math.max(-1,Math.min(1,error*2.7/.67))},boost&&i<30);m.route=track.raceRoute(before,m,active);if(track.constrain(m))walls++;const loc=track.project(m);maxOffset=Math.max(maxOffset,Math.abs(loc.offset));minKmh=Math.min(minKmh,m.speed*3.6);
  if(i%20===0)samples.push({x:m.x,z:m.z,kmh:m.speed*3.6,route:m.route,offset:loc.offset});if(m.route===null&&track.project(m,null).angle>cut.to+80/track.radius){finished=true;break;}
 }
 return{kmh,boost,lane,walls,minKmh,maxOffset,brakeSteps,finished,samples};
}



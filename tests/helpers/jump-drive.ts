import{CityTrack}from'../../src/track/CityTrack';import{DrivingModel}from'../../src/player/DrivingModel';import{FlightController}from'../../src/player/FlightController';import{TrickController}from'../../src/player/TrickController';import{NitroController}from'../../src/player/NitroController';import{Ramps}from'../../src/track/Ramps';import{NATURAL_JUMPS}from'../../src/track/Elevation';import{signedAngle,TAU}from'../../src/track/Track';
import{AIController}from'../../src/ai/AIController';
export function driveJump(id:string,kmh:number,boost=false){
 const track=new CityTrack(),ramps=new Ramps(track),ramp=ramps.data.find(r=>r.id===id),natural=NATURAL_JUMPS.find(j=>j.id===id),route=natural?.route??null,cut=track.shortcuts.find(c=>c.id===route),lip=ramp?.angle??(cut?cut.from+(cut.to-cut.from)*natural!.t:natural!.t*TAU),length=cut?.length??track.length,advance=(metres:number)=>metres/length*(cut?cut.to-cut.from:TAU),start=ramp?lip-advance(75):id==='drop-16'?.295*TAU:id==='crest-8'?.685*TAU:id==='port-drop-10'?.78*TAU:cut!.from+.01*(cut!.to-cut!.from),m=new DrivingModel(),f=new FlightController(),tricks=new TrickController(),nitro=new NitroController();
 track.spawn(m,start);Object.assign(m,track.routePoint(start,0,route));m.heading=track.routeHeading(start,route);m.speed=route?12:kmh/3.6;m.vx=Math.sin(m.heading)*m.speed;m.vz=Math.cos(m.heading)*m.speed;m.routeIntent=route;ramps.place(m,f);nitro.reward(60);
 const trace=[];let walls=0,launches=0,airtime=0,peak=0,launchSpeed=0,reward=0,landingAngle=0,landingSpeed=0,landed=false;
 for(let step=0;step<2400;step++){const before={x:m.x,z:m.z,route:m.route},loc=track.project(m,route),distance=(lip-loc.angle)/advance(1);f.beginStep(1/60);nitro.update(1/60,boost&&distance<80);const p=track.routeTarget(m,Math.max(18,m.speed*.65),0,route),error=signedAngle(Math.atan2(p.x-m.x,p.z-m.z)-m.heading);let cap=nitro.active?60:kmh/3.6;
  if(route&&!f.airborne){const a=track.routeHeading(loc.angle,route),b=track.routeHeading(loc.angle+advance(35),route),c=track.routeHeading(loc.angle+advance(70),route),k=Math.max(Math.abs(signedAngle(b-a)),Math.abs(signedAngle(c-b)))/35;cap=Math.min(cap,.45/Math.max(.0001,k));}
  m.update(1/60,{throttle:m.speed<cap?1:0,brake:m.speed>cap+.3?1:0,steer:Math.max(-1,Math.min(1,error*2.7/.67))},nitro.active);if(track.constrain(m))walls++;ramps.prepare(m,f);ramps.update(before,m,f);
  if(f.takeoff){launches++;launchSpeed=m.speed*3.6;tricks.beginJump();}if(f.airborne){airtime+=1/60;if(f.remainingTime>.9&&!tricks.used)tricks.request(f);}tricks.update(1/60);peak=Math.max(peak,f.height);
  trace.push({x:m.x,y:f.height,z:m.z,route:m.route,airborne:f.airborne,kmh:m.speed*3.6});
  if(f.landed){const result=tricks.land(true);reward+=result.reward;nitro.reward(result.reward);landed=true;landingAngle=track.project(m,route).angle;landingSpeed=f.landingSpeed;break;}
  if(distance< -200&&!f.airborne)break;
 }
 return{id,kmh,boost,walls,launches,launchSpeed,airtime,peak,reward,landed,landingAngle,landingSpeed,energy:nitro.energy,trace};
}
export function driveAIJump(id:string){
 const track=new CityTrack(),ramps=new Ramps(track),r=ramps.data.find(r=>r.id===id),j=NATURAL_JUMPS.find(j=>j.id===id),route=j?.route??null,cut=track.shortcuts.find(c=>c.id===route),lip=r?.angle??(cut?cut.from+(cut.to-cut.from)*j!.t:j!.t*TAU),start=lip-70/(cut?.length??track.length)*(cut?cut.to-cut.from:TAU),ai=new AIController('ai-2','trial',175/3.6,0,track,start);ai.setRamps(ramps);
 if(route){Object.assign(ai.model,track.routePoint(start,0,route));ai.model.heading=track.routeHeading(start,route);ai.model.routeIntent=route;ai.route=route;ramps.place(ai.model,ai.flight);}
 ai.model.speed=35;ai.model.vx=Math.sin(ai.model.heading)*35;ai.model.vz=Math.cos(ai.model.heading)*35;let walls=0,launches=0;const trace=[];
 for(let i=0;i<2400;i++){ai.update(1/60);if(track.constrain(ai.model))walls++;ai.finishStep();ai.updateActions(1/60,true);if(ai.flight.takeoff)launches++;trace.push({x:ai.model.x,y:ai.flight.height,z:ai.model.z,airborne:ai.flight.airborne});if(ai.flight.landed)return{id,walls,launches,landed:true,trick:ai.tricks.completed,energy:ai.nitro.energy,trace};}
 return{id,walls,launches,landed:false,trick:false,energy:ai.nitro.energy,trace};
}

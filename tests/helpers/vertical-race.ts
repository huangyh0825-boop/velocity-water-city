import {CityTrack} from '../../src/track/CityTrack';import {DrivingModel} from '../../src/player/DrivingModel';import {AIController} from '../../src/ai/AIController';import {FlightController} from '../../src/player/FlightController';import {TrickController} from '../../src/player/TrickController';import {NitroController} from '../../src/player/NitroController';import {Ramps} from '../../src/track/Ramps';import {RaceController} from '../../src/race/RaceController';import {BoatCollisions,type BoatBody} from '../../src/physics/BoatCollisions';import {signedAngle,TAU} from '../../src/track/Track';
export function simulateVerticalRace(){
 const track=new CityTrack(),ramps=new Ramps(track),player=new DrivingModel(),flight=new FlightController(),tricks=new TrickController(),nitro=new NitroController();track.spawn(player);ramps.place(player,flight);
 const ai=[175,170,165,160].map((s,i)=>new AIController(`ai-${i+1}`,'AI',s/3.6,i%2?7:-7,track,i<2?-.02:-.029));ai.forEach(a=>a.setRamps(ramps));
 const racers=[{id:'player',name:'player',position:player},...ai.map(a=>({id:a.id,name:a.id,position:a.model}))],race=new RaceController(track,racers),bodies:BoatBody[]=[{id:'player',model:player,height:0},...ai.map(a=>({id:a.id,model:a.model,height:0}))],collisions=new BoatCollisions();race.phase='racing';
 const routes=new Set<string>(),jumps:Record<string,number>={},rewards:Record<string,number>={},peaks=[0,0,0,0,0];let contacts=0,steps=0,chosen:string|null=null;
 const classify=(m:DrivingModel)=>m.route==='harbor-cut'?'S2J':track.project(m).angle/TAU>.34&&track.project(m).angle/TAU<.39?'D1':track.project(m).angle/TAU>.72&&track.project(m).angle/TAU<.77?'D2':'ramp';
 for(;steps<36000&&race.racers.some(r=>r.finishTime===null);steps++){
  const dt=1/60,before={x:player.x,z:player.z,route:player.route};race.tick(dt);collisions.capture(bodies);flight.beginStep(dt);
  const lap=Math.floor(race.player.passed/24),wanted=track.shortcuts.find(s=>s.id===(lap===1?'tunnel-cut':lap===2?'harbor-cut':null)),a=track.project(player,null).angle,toEntry=wanted?(wanted.from-a)*track.radius:Infinity;
  if(toEntry>0&&toEntry<110)chosen=wanted!.id;if(chosen&&a>track.shortcuts.find(s=>s.id===chosen)!.to)chosen=null;
  const route=race.player.route??chosen;player.routeIntent=route;
  const target=track.routeTarget(player,Math.max(18,player.speed*.65),0,route),desired=Math.atan2(target.x-player.x,target.z-player.z),error=signedAngle(desired-player.heading),next=track.routeTarget(player,50,0,route),direction=Math.atan2(next.x-target.x,next.z-target.z),curvature=Math.abs(signedAngle(direction-desired))/30,cap=Math.min(50,.45/Math.max(.0001,curvature));
  nitro.update(dt,!flight.airborne&&curvature<.002&&nitro.energy>15);player.update(dt,{throttle:player.speed<cap?1:0,brake:player.speed>cap+1?1:0,steer:Math.max(-1,Math.min(1,error*2.7/.67))},nitro.active);const wall=track.constrain(player);ramps.prepare(player,flight);bodies[0].height=flight.height;
  const walls=ai.map((a,i)=>{a.update(dt,bodies,race.racers[i+1].finishTime===null);const wall=track.constrain(a.model);bodies[i+1].height=a.flight.height;return wall;});
  collisions.resolve(bodies,dt,m=>track.constrain(m));contacts+=collisions.lastContacts;
  ramps.update(before,player,flight,'player',collisions.sweptPath('player'),collisions.movementAllowance('player'));bodies[0].height=flight.height;
  ai.forEach((a,i)=>{a.finishStep(collisions.sweptPath(a.id),collisions.movementAllowance(a.id));bodies[i+1].height=a.flight.height;a.updateActions(dt,!walls[i]&&!collisions.hasContact(a.id),race.racers[i+1].finishTime===null);if(collisions.hasContact(a.id))a.onContact();});
  if(flight.takeoff)tricks.beginJump();if(flight.airborne&&flight.remainingTime>.9&&!tricks.used)tricks.request(flight);tricks.update(dt);
  if(flight.landed){const result=tricks.land(!wall&&!collisions.hasContact('player')&&player.speed>8);nitro.reward(result.reward);const factor=flight.impactFactor*(result.penalty?.72:1);player.speed*=factor;player.vx*=factor;player.vz*=factor;}
  for(const [i,m]of [player,...ai.map(a=>a.model)].entries()){
   const f=i?ai[i-1].flight:flight,tr=i?ai[i-1].tricks:tricks,id=i?ai[i-1].id:'player',competing=race.racers[i].finishTime===null;if(competing&&m.route)routes.add(`${id}:${m.route}`);if(competing&&f.takeoff){const key=`${id}:${classify(m)}`;jumps[key]=(jumps[key]??0)+1;}if(competing&&f.landed&&tr.message.startsWith('特技成功'))rewards[id]=(rewards[id]??0)+1;peaks[i]=Math.max(peaks[i],f.height);
   if(![m.x,m.z,m.y,m.speed,f.height].every(Number.isFinite)||f.height<-.01||f.height>35)throw Error(`Invalid vertical pose ${id} at ${steps}`);
   race.record(id,m,dt,collisions.movementAllowance(id));
  }
 }
 race.completeStep();return{steps,contacts,peaks,routes:[...routes],jumps,rewards,passed:race.racers.map(r=>r.passed),finishes:race.racers.map(r=>r.finishTime),phase:race.phase,energy:[nitro.energy,...ai.map(a=>a.nitro.energy)],best:race.bestTime};
}

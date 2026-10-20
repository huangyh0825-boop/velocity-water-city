import{test}from'node:test';import assert from'node:assert/strict';
import{CityTrack}from'../src/track/CityTrack';import{Track,signedAngle}from'../src/track/Track';import{DrivingModel}from'../src/player/DrivingModel';import{FlightController}from'../src/player/FlightController';import{NitroController}from'../src/player/NitroController';import{TrickController}from'../src/player/TrickController';import{Ramps}from'../src/track/Ramps';import{BoatCollisions,type BoatBody}from'../src/physics/BoatCollisions';import{createCityOpponents}from'../src/ai/CityOpponents';import{LocalRaceSession}from'../src/gameplay/LocalRaceSession';import{RaceController}from'../src/race/RaceController';
test('selected 1, 2, 7 and 37 laps finish at the exact selected final gate rather than a hardcoded three laps',()=>{
 const t=new Track();for(const laps of[1,2,7,37]){const r=new RaceController(t,[{id:'player',name:'P',position:t.point(-.01)}],'player',{laps});r.phase='racing';for(let passed=1;passed<=laps*t.checkpointCount;passed++){const angle=t.checkpointAngle(passed%t.checkpointCount);r.syncPosition('player',t.point(angle-.0001));r.tick(1/60);r.record('player',t.point(angle+.0001),1/60);r.completeStep();assert.equal(r.player.passed,passed);assert.equal(r.phase,passed===laps*t.checkpointCount?'finished':'racing');}assert.equal(r.lap(),laps);}
});
test('renderer-independent training core completes a real one-lap race at both configured AI difficulties',()=>{
 for(const difficulty of['easy','hard']as const){const track=new CityTrack(),player=new DrivingModel(),flight=new FlightController(),nitro=new NitroController(),tricks=new TrickController(),ramps=new Ramps(track),ai=createCityOpponents(track,difficulty);ai.forEach(a=>a.setRamps(ramps));const bodies:BoatBody[]=[{id:'player',model:player},...ai.map(a=>({id:a.id,model:a.model}))],session=new LocalRaceSession({track,player,flight,nitro,tricks,ramps,ai,bodies,collisions:new BoatCollisions()},{laps:1,difficulty},'测试玩家');
 let starts=0,finishes=0;const firstLaps:number[]=[];
 for(let step=0;step<60*230&&session.race.phase!=='finished';step++){
  const target=track.routeTarget(player,Math.max(18,player.speed*.65),0,null),desired=Math.atan2(target.x-player.x,target.z-player.z),angle=track.project(player,null).angle,k=Math.max(Math.abs(track.curvature(angle)),Math.abs(track.curvature(angle+45/track.radius))),cap=Math.min(40,.45/Math.max(.0001,k));
  const out=session.step(1/60,{throttle:player.speed<cap?1:0,brake:player.speed>cap+1?1:0,steer:Math.max(-1,Math.min(1,signedAngle(desired-player.heading)*2.7/.67)),boost:false,trick:flight.airborne&&!tricks.used&&flight.remainingTime>.9});if(out.started)starts++;if(out.finished)finishes++;
  for(const r of session.race.racers.slice(1))if(r.finishTime!==null&&!firstLaps.includes(r.finishTime))firstLaps.push(r.finishTime);
 }
 assert.equal(session.race.phase,'finished');assert.equal(session.race.player.passed,24);assert.equal(starts,1);assert.equal(finishes,1);assert.equal(session.summary().completedLaps,1);assert.equal(session.race.player.name,'测试玩家');
 const fastest=Math.min(...firstLaps);if(difficulty==='hard')assert.ok(fastest>88&&fastest<95);else assert.ok(fastest>117&&fastest<124);
 session.restart();assert.equal(session.race.phase,'countdown');assert.equal(session.race.player.passed,0);assert.equal(session.race.player.enteredRoutes.size,0);
 }
});

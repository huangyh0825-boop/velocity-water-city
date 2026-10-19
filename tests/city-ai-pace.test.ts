import{test}from'node:test';import assert from'node:assert/strict';
import{CityTrack}from'../src/track/CityTrack';import{createCityOpponents,cityEntrants}from'../src/ai/CityOpponents';import{Ramps}from'../src/track/Ramps';import{RaceController}from'../src/race/RaceController';import{BoatCollisions,type BoatBody}from'../src/physics/BoatCollisions';import{Track}from'../src/track/Track';

test('live city AI pace finishes three legal laps at 4:30 through 5:30–6:00 with normal and crowded starts',()=>{
 for(const crowded of[false,true]){
  const t=new CityTrack(),ramps=new Ramps(t),ai=createCityOpponents(t);ai.forEach(a=>a.setRamps(ramps));if(crowded)ai.forEach((a,i)=>t.spawn(a.model,-.02,(i-1.5)*1.3));
  const bodies:BoatBody[]=ai.map(a=>({id:a.id,model:a.model,height:0})),collisions=new BoatCollisions(),race=new RaceController(t,cityEntrants(ai),ai[0].id);race.phase='racing';let contacts=0;
  for(let step=0;step<60*365&&race.racers.some(r=>r.finishTime===null);step++){
   const dt=1/60;race.tick(dt);collisions.capture(bodies);const walls=ai.map((a,i)=>{a.update(dt,bodies,race.racers[i].finishTime===null);const wall=t.constrain(a.model);bodies[i].height=a.flight.height;return wall;});collisions.resolve(bodies,dt,m=>t.constrain(m));contacts+=collisions.lastContacts;
   ai.forEach((a,i)=>{a.finishStep(collisions.sweptPath(a.id),collisions.movementAllowance(a.id));bodies[i].height=a.flight.height;a.updateActions(dt,!walls[i]&&!collisions.hasContact(a.id)&&a.model.speed>8,race.racers[i].finishTime===null);if(collisions.hasContact(a.id))a.onContact();race.record(a.id,a.model,dt,collisions.movementAllowance(a.id));assert.ok(t.contains(a.model,.99));assert.ok(a.nitro.energy>=0&&a.nitro.energy<=100);assert.ok(a.model.speed<=race.racers[i].maxSpeed!+1e-8);assert.ok(Number.isFinite(a.flight.height)&&a.flight.height>=0&&a.flight.height<35);});
  }
  assert.deepEqual(race.racers.map(r=>r.passed),[72,72,72,72]);const times=race.racers.map(r=>r.finishTime!);
  assert.ok(times[0]>=260&&times[0]<=280,`${crowded}: fastest ${times}`);assert.ok(times[1]>=285&&times[1]<=320);assert.ok(times[2]>times[1]&&times[2]<=335);assert.ok(times[3]>=330&&times[3]<=360,`${crowded}: slowest ${times}`);if(crowded)assert.ok(contacts>0);
 }
});

test('configured AI peak speed credits legal fast gates without loosening player or teleport validation',()=>{
 const t=new Track(),angle=t.checkpointAngle(1),h=t.heading(angle),p=t.point(angle),before={x:p.x-Math.sin(h)*.625,z:p.z-Math.cos(h)*.625},after={x:p.x+Math.sin(h)*.625,z:p.z+Math.cos(h)*.625};
 const race=new RaceController(t,[{id:'player',name:'p',position:before},{id:'ai',name:'a',position:before,maxSpeed:75}]);race.phase='racing';race.record('player',{...after},1/60);race.record('ai',{...after},1/60);assert.equal(race.player.passed,0);assert.equal(race.racers[1].passed,1);
 race.syncPosition('ai',{x:p.x-Math.sin(h)*10,z:p.z-Math.cos(h)*10});race.racers[1].passed=0;race.record('ai',{x:p.x+Math.sin(h)*10,z:p.z+Math.cos(h)*10},1/60);assert.equal(race.racers[1].passed,0);
});

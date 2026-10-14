import {test} from 'node:test';import assert from 'node:assert/strict';import {CityTrack} from '../src/track/CityTrack';import {AIController} from '../src/ai/AIController';import {Ramps} from '../src/track/Ramps';import {RaceController} from '../src/race/RaceController';import {BoatCollisions,hullOverlap,type BoatBody} from '../src/physics/BoatCollisions';
test('four solid AI finish the new course, retain jumps/rewards/finite nitro and recover after contact',()=>{
 const t=new CityTrack(),ramps=new Ramps(t),ai=[175,170,165,160].map((speed,i)=>new AIController(`ai-${i+1}`,'AI',speed/3.6,i%2?7:-7,t,i<2?-.02:-.029));ai.forEach(a=>a.setRamps(ramps));
 ai.forEach((a,i)=>t.spawn(a.model,-.02,(i-1.5)*1.3));
 const bodies:BoatBody[]=ai.map(a=>({id:a.id,model:a.model,height:0})),collisions=new BoatCollisions(),race=new RaceController(t,ai.map(a=>({id:a.id,name:a.name,position:a.model})),ai[0].id);race.phase='racing';let contacts=0;const jumps=[0,0,0,0],rewards=[0,0,0,0];
 for(let step=0;step<36000&&race.racers.some(r=>r.finishTime===null);step++){
  const dt=1/60;race.tick(dt);collisions.capture(bodies);const walls=ai.map((a,i)=>{a.update(dt,bodies,race.racers[i].finishTime===null);const wall=t.constrain(a.model);bodies[i].height=a.flight.height;return wall;});
  collisions.resolve(bodies,dt,m=>t.constrain(m));contacts+=collisions.lastContacts;
  ai.forEach((a,i)=>{a.finishStep(collisions.sweptPath(a.id),collisions.movementAllowance(a.id));bodies[i].height=a.flight.height;a.updateActions(dt,!walls[i]&&!collisions.hasContact(a.id)&&a.model.speed>8,race.racers[i].finishTime===null);if(a.flight.takeoff)jumps[i]++;if(a.flight.landed&&a.tricks.message.startsWith('特技成功'))rewards[i]++;if(collisions.hasContact(a.id))a.onContact();race.record(a.id,a.model,dt,collisions.movementAllowance(a.id));assert.ok(t.contains(a.model,.99));assert.ok(a.nitro.energy>=0&&a.nitro.energy<=100);assert.ok([a.model.x,a.model.z,a.model.speed].every(Number.isFinite));});
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(Math.abs(bodies[i].height!-bodies[j].height!)<=1.2)assert.ok(hullOverlap(bodies[i].model,bodies[j].model)<.008);
 }
 assert.ok(contacts>0);assert.deepEqual(race.racers.map(r=>r.passed),[72,72,72,72]);assert.ok(jumps.every(n=>n>0)&&rewards.every(n=>n>0));
});

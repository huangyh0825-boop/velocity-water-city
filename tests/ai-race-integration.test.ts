import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIController } from '../src/ai/AIController';
import { Track, signedAngle } from '../src/track/Track';
import { Ramps } from '../src/track/Ramps';
import { DrivingModel } from '../src/player/DrivingModel';
import { FlightController } from '../src/player/FlightController';
import { BoatCollisions, hullOverlap, type BoatBody } from '../src/physics/BoatCollisions';
import { RaceController } from '../src/race/RaceController';

function simulate(fps:number) {
  const track=new Track(), ramps=new Ramps(track), player=new DrivingModel(), flight=new FlightController();
  track.spawn(player);
  const ai=[175,170,165,160].map((speed,i)=>new AIController(`ai-${i+1}`,'AI',speed/3.6,i%2?7:-7,track,i<2?-.18:-.24));
  ai.forEach(a=>a.setRamps(ramps));
  const bodies:BoatBody[]=[{id:'player',model:player,height:0},...ai.map(a=>({id:a.id,model:a.model,height:0}))];
  const collisions=new BoatCollisions(), race=new RaceController(track,bodies.map(b=>({id:b.id,name:b.id,position:b.model})));
  race.phase='racing'; let accumulator=0;
  const jumps=[0,0,0,0],rewards=[0,0,0,0],boosts=[0,0,0,0],kinds=new Set<string>();
  let playerJumps=0, contacts=0;
  for(let frame=0;frame<fps*100&&race.racers.some(r=>r.finishTime===null);frame++) {
    accumulator+=1/fps;
    while(accumulator>=1/60-1e-10) {
      const dt=1/60,before={x:player.x,z:player.z}; race.tick(dt);collisions.capture(bodies);flight.beginStep(dt);
      const p=track.point(track.angle(player)+.16),desired=Math.atan2(p.x-player.x,p.z-player.z),turn=signedAngle(desired-player.heading)*3-player.yawRate;
      player.update(dt,{throttle:1,brake:0,steer:turn>.08?1:turn<-.08?-1:0});track.constrain(player);ramps.prepare(player,flight);bodies[0].height=flight.height;
      const walls=ai.map((a,i)=>{a.update(dt,bodies,race.racers[i+1].finishTime===null);const wall=track.constrain(a.model);bodies[i+1].height=a.flight.height;return wall;});
      collisions.resolve(bodies,dt,m=>{if(track.constrain(m)){const i=ai.findIndex(a=>a.model===m);if(i>=0)walls[i]=true;}});
      ramps.update(before,player,flight,'player',collisions.sweptPath('player'),collisions.movementAllowance('player'));bodies[0].height=flight.height;
      if(flight.takeoff)playerJumps++;
      ai.forEach((a,i)=>{
        a.finishStep(collisions.sweptPath(a.id),collisions.movementAllowance(a.id));bodies[i+1].height=a.flight.height;
        const energy=a.nitro.energy;
        a.updateActions(dt,!walls[i]&&a.model.speed>8&&!collisions.hasContact(a.id),race.racers[i+1].finishTime===null);
        if(a.flight.takeoff)jumps[i]++;
        if(a.flight.landed&&a.tricks.message.startsWith('特技成功')){rewards[i]++;assert.equal(a.nitro.energy,Math.min(100,energy+35));}
        else assert.equal(a.nitro.energy,energy);
        if(a.tricks.kind)kinds.add(a.tricks.kind);
        if(a.nitro.active)boosts[i]++;
        assert.ok(a.nitro.energy>=0&&a.nitro.energy<=100);
        assert.ok(a.model.speed<=a.targetSpeed*1.2+1e-8);
        if(collisions.hasContact(a.id))a.onContact();
      });
      contacts+=collisions.lastContacts;
      for(let i=0;i<bodies.length;i++){
        const b=bodies[i];assert.ok(track.contains(b.model,1-1e-8));assert.ok([b.model.x,b.model.z,b.model.speed,b.height].every(Number.isFinite));
        for(let j=i+1;j<bodies.length;j++)if(Math.abs(b.height!-bodies[j].height!)<=1.2)assert.ok(hullOverlap(b.model,bodies[j].model)<.007);
        race.record(b.id,b.model,dt,collisions.movementAllowance(b.id));
      }
      accumulator-=dt;
    }
  }
  assert.ok(contacts>0);assert.ok(jumps.every(n=>n>=2));assert.ok(rewards.every(n=>n>=1));assert.ok(boosts.every(n=>n>0));
  assert.equal(kinds.size,3);assert.ok(playerJumps>=6);
  race.racers.forEach(r=>{assert.equal(r.passed,24);assert.ok(r.finishTime!==null);});race.completeStep();assert.equal(race.phase,'finished');
  const result={jumps,rewards,boosts,playerJumps,contacts,finishes:race.racers.map(r=>r.finishTime)};
  ai.forEach(a=>{a.reset();assert.equal(a.nitro.energy,40);assert.equal(a.flight.height,0);assert.equal(a.tricks.kind,null);assert.equal(a.navigation.mode,'route');});
  return result;
}

test('five solid racers complete ramp/trick/nitro/checkpoint cycles with identical 30/60/120 render schedules',()=>{
  const result=simulate(60);assert.deepEqual(simulate(30),result);assert.deepEqual(simulate(120),result);
});

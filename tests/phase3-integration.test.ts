import {test} from 'node:test';
import assert from 'node:assert/strict';
import { DrivingModel } from '../src/player/DrivingModel';
import { FlightController } from '../src/player/FlightController';
import { TrickController } from '../src/player/TrickController';
import { NitroController } from '../src/player/NitroController';
import { Track,signedAngle } from '../src/track/Track';
import { Ramps } from '../src/track/Ramps';
import { RaceController } from '../src/race/RaceController';
import { BoatCollisions,hullOverlap } from '../src/physics/BoatCollisions';
test('ramps, successful tricks, energy rewards and boosting still finish an ordered three-lap race',()=>{
 const track=new Track(),p=new DrivingModel(),f=new FlightController(),t=new TrickController(),n=new NitroController(),ramps=new Ramps(track);track.spawn(p);
 const race=new RaceController(track,[{id:'player',name:'Player',position:p}]);race.phase='racing';let jumps=0,rewards=0,peak=0,maxSpeed=0,boosted=false;
 for(let i=0;i<9000&&race.phase==='racing';i++) {
  const dt=1/60,before={x:p.x,z:p.z};race.tick(dt);f.beginStep(dt);
  const target=track.point(track.angle(p)+.16),desired=Math.atan2(target.x-p.x,target.z-p.z),turn=signedAngle(desired-p.heading)*3-p.yawRate;
  n.update(dt,p.speed>45 && n.energy>0);boosted ||= n.active;
  p.update(dt,{throttle:1,brake:0,steer:turn>.08?1:turn<-.08?-1:0},n.active);track.constrain(p);ramps.update(before,p,f);
  if(f.takeoff){jumps++;t.beginJump();t.request(f);}t.update(dt);
  if(f.landed){const result=t.land(true);n.reward(result.reward);if(result.reward)rewards++;}
  race.record('player',p,dt);race.completeStep();peak=Math.max(peak,f.height);maxSpeed=Math.max(maxSpeed,p.speed);
  assert.ok(track.contains(p,1-1e-8));assert.ok(n.energy>=0&&n.energy<=100);
 }
 assert.equal(race.phase,'finished');assert.equal(race.player.passed,24);assert.ok(jumps>=6 && rewards>=6);assert.ok(peak>4 && boosted && maxSpeed>50);
});
test('airborne boats pass above water hulls; landing restores full ground collisions',()=>{
 const a=new DrivingModel(),b=new DrivingModel();a.speed=b.speed=40;a.vz=40;b.vz=-40;b.heading=Math.PI;a.z=-2.3;b.z=2.3;
 const system=new BoatCollisions(),bodies=[{id:'player',model:a,height:5},{id:'ai',model:b,height:0}];system.capture(bodies);system.resolve(bodies,1/60);assert.equal(system.lastContacts,0);
 bodies[0].height=0;system.capture(bodies);system.resolve(bodies,1/60);assert.equal(system.lastContacts,1);assert.ok(hullOverlap(a,b)<.001);
});
test('216km/h nitro head-on motion stays separated and cannot gain energy on contact',()=>{
 const a=new DrivingModel(),b=new DrivingModel();Object.assign(a,{z:-5,speed:60,vz:60});Object.assign(b,{z:5,speed:48,vz:-48,heading:Math.PI});
 const system=new BoatCollisions(),bodies=[{id:'player',model:a},{id:'ai',model:b}];system.capture(bodies);a.z+=60*.2;b.z-=48*.2;system.resolve(bodies,.2);
 assert.ok(a.z<b.z && hullOverlap(a,b)<.001);assert.ok(a.speed<=60 && b.speed<=48);assert.ok(system.lastSubsteps>1);
});

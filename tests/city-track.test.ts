import {test} from 'node:test';import assert from 'node:assert/strict';import {CityTrack} from '../src/track/CityTrack';import {RaceController} from '../src/race/RaceController';import {DrivingModel} from '../src/player/DrivingModel';import {AIController} from '../src/ai/AIController';import {Ramps} from '../src/track/Ramps';import {signedAngle,TAU} from '../src/track/Track';
import {FlightController} from '../src/player/FlightController';
test('new course is a 4.7km closed noncircular loop with variable widths and shorter narrow alternatives',()=>{
 const t=new CityTrack();assert.ok(t.length>4600&&t.length<5000);assert.ok(Math.hypot(t.point(0).x-t.point(TAU).x,t.point(0).z-t.point(TAU).z)<1e-6);assert.ok(new Set(t.samples.map(p=>Math.round(p.width))).size>4);
 for(const s of t.shortcuts){assert.ok(s.length<(s.to-s.from)*t.radius-30);assert.ok(s.width<10);for(const p of s.samples)assert.ok(t.contains(p));}
});
test('shortcut gates credit the same ordered checkpoint IDs, reverse/skip/teleport remain invalid',()=>{
 const t=new CityTrack(),shortcut=t.shortcuts[0],index=Math.ceil(shortcut.from/TAU*t.checkpointCount),angle=t.checkpointAngle(index),f=(angle-shortcut.from)/(shortcut.to-shortcut.from),i=Math.round(f*128),before=shortcut.samples[i-2],after=shortcut.samples[i+2];
 assert.ok(t.crossesGate(before,after,index));assert.ok(!t.crossesGate(after,before,index));const race=new RaceController(t,[{id:'player',name:'p',position:before}]);race.phase='racing';race.record('player',after,1/60);assert.equal(race.player.passed,0);
});
test('both continuous shortcut paths preserve every logical gate and cannot double count',()=>{
 const t=new CityTrack();for(const cut of t.shortcuts){const race=new RaceController(t,[{id:'player',name:'p',position:cut.samples[0]}]);race.phase='racing';race.player.passed=Math.floor(cut.from/TAU*t.checkpointCount);
  for(let i=1;i<cut.samples.length;i++){const a=cut.samples[i-1],b=cut.samples[i],dt=Math.hypot(b.x-a.x,b.z-a.z)/40;race.tick(dt);race.record('player',b,dt);}
  assert.equal(race.player.passed,Math.floor(cut.to/TAU*t.checkpointCount));const passed=race.player.passed;race.record('player',cut.samples.at(-1)!,1/60);assert.equal(race.player.passed,passed);
 }
});
test('real driving and shared ramp AI finish 72 ordered checkpoints on the new course',()=>{
 const t=new CityTrack(),p=new DrivingModel(),ai=new AIController('ai-2','AI',170/3.6,5,t,-.02),ramps=new Ramps(t);t.spawn(p);ai.setRamps(ramps);
 const flight=new FlightController();ramps.place(p,flight);
 const race=new RaceController(t,[{id:'player',name:'p',position:p},{id:ai.id,name:'ai',position:ai.model}]);race.phase='racing';let firstLap=0,jumps=0,rewards=0;
 for(let i=0;i<26000&&race.racers.some(r=>r.finishTime===null);i++){
  const dt=1/60,angle=t.angle(p),k=Math.max(Math.abs(t.curvature(angle)),Math.abs(t.curvature(angle+45/t.radius))),cap=Math.min(50,.48/Math.max(.0001,k)),target=t.target(p,Math.max(18,p.speed*.65)),desired=Math.atan2(target.x-p.x,target.z-p.z),steer=Math.max(-1,Math.min(1,signedAngle(desired-p.heading)*2.7/.67));
  const before={x:p.x,z:p.z,route:p.route};flight.beginStep(dt);
  race.tick(dt);p.update(dt,{throttle:p.speed<cap?1:0,brake:p.speed>cap+1?1:0,steer});t.constrain(p);ramps.prepare(p,flight);ramps.update(before,p,flight);ai.update(dt);t.constrain(ai.model);ai.finishStep();ai.updateActions(dt,true);if(ai.flight.takeoff)jumps++;if(ai.flight.landed&&ai.tricks.completed)rewards++;
  race.record('player',p,dt);race.record(ai.id,ai.model,dt);if(!firstLap&&race.player.passed===24)firstLap=race.elapsed;assert.ok(t.contains(p,1-1e-6)&&t.contains(ai.model,1-1e-6));
 }
 assert.deepEqual(race.racers.map(r=>r.passed),[72,72]);assert.ok(firstLap>=90&&firstLap<=120);assert.ok(jumps>=3&&rewards>=1);
});

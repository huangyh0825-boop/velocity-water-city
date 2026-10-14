import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FlightController } from '../src/player/FlightController';
import { TrickController } from '../src/player/TrickController';
import { NitroController } from '../src/player/NitroController';
import { DrivingModel } from '../src/player/DrivingModel';
test('all three tricks complete only in flight; one reward per jump after safe landing', () => {
  const t=new TrickController(), f=new FlightController(), seen=new Set(); assert.ok(!t.request(f));
  for(let jump=0;jump<3;jump++) { f.reset(); f.launch(50); t.beginJump(); assert.ok(t.request(f)); seen.add(t.kind); assert.ok(!t.request(f));
    while(f.airborne) { f.beginStep(1/60); t.update(1/60); } assert.equal(t.land(true).reward,35); assert.equal(t.land(true).reward,0); }
  assert.deepEqual([...seen],['front','back','spin']);
});
test('boost reaches 216 km/h and releases smoothly to unchanged 180 km/h cap',()=>{
  const m=new DrivingModel(); for(let i=0;i<600;i++) {m.x=m.z=0;m.update(1/60,{throttle:1,brake:0,steer:0},true);} assert.equal(m.speed*3.6,216);
  m.update(1/60,{throttle:1,brake:0,steer:0},false); assert.ok(m.speed>50 && m.speed<60);
  for(let i=0;i<180;i++) m.update(1/60,{throttle:1,brake:0,steer:0},false); assert.equal(m.speed,50);
});
test('late trick or unsafe landing gives penalty and no energy', () => {
  const f=new FlightController(), t=new TrickController(); f.launch(50); t.beginJump();
  while(f.remainingTime>0.25) f.beginStep(1/60); t.request(f);
  while(f.airborne) { f.beginStep(1/60); t.update(1/60); } assert.deepEqual(t.land(true),{reward:0,penalty:true});
});
test('nitro drains only while enabled and held; reward caps and race reset restores initial energy', () => {
  const n=new NitroController(); n.update(1,true,false); assert.equal(n.energy,40);
  n.update(1,true); assert.equal(n.energy,18); n.update(1,false); assert.equal(n.energy,18);
  n.update(2,true); assert.equal(n.energy,0); n.update(1,true); assert.equal(n.active,false);
  n.reward(150); assert.equal(n.energy,100); n.reset(); assert.equal(n.energy,40); assert.equal(n.active,false);
});

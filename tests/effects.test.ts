import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SprayPool } from '../src/effects/SprayPool';
import { EventLimiter } from '../src/effects/EventLimiter';
import { Scene } from 'three';
import { Spray } from '../src/effects/Spray';
import { DrivingModel } from '../src/player/DrivingModel';
test('particle pool stays bounded and fades completely; mobile uses smaller budget',()=>{
 const p=new SprayPool();for(let i=0;i<1000;i++)p.spawn(0,.2,0,1,3,1,.8,.2);assert.equal(p.activeCount,360);
 p.update(2);assert.equal(p.activeCount,0);p.setLow(true);for(let i=0;i<1000;i++)p.spawn(0,.2,0,1,3,1,.8,.2);assert.equal(p.activeCount,96);p.reset();assert.equal(p.activeCount,0);
});
test('speed and hard turns increase visible spray, flight stops emission and landing bursts at the contact point',()=>{
 const oldRandom=Math.random;Math.random=()=>.5;
 try {
  const simulate=(speed:number,yaw:number)=>{const spray=new Spray(new Scene()),model=new DrivingModel();model.speed=speed;model.yawRate=yaw;for(let i=0;i<60;i++)spray.update(1/60,model,true);return {spray,model};};
  const slow=simulate(20,0),fast=simulate(50,0),turn=simulate(50,.6);
  assert.ok(fast.spray.pool.activeCount>slow.spray.pool.activeCount);assert.ok(turn.spray.pool.activeCount>fast.spray.pool.activeCount);
  for(let i=0;i<120;i++)turn.spray.update(1/60,turn.model,false);assert.equal(turn.spray.pool.activeCount,0);
  turn.spray.burst(12,34,12,'landing');assert.equal(turn.spray.pool.activeCount,42);
  for(let i=0;i<turn.spray.pool.capacity;i++)if(turn.spray.pool.alpha[i]>0){assert.equal(turn.spray.pool.positions[i*3],12);assert.equal(turn.spray.pool.positions[i*3+2],34);}
 }finally{Math.random=oldRandom;}
});
test('continuous contact produces bounded feedback without suppressing other pairs',()=>{
 const l=new EventLimiter();assert.ok(l.accept('a:b',0));assert.ok(!l.accept('a:b',.1));assert.ok(l.accept('a:c',.1));assert.ok(l.accept('a:b',.3));l.reset();assert.ok(l.accept('a:b',.3));
});

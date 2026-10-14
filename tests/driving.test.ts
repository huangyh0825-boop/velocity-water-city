import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrivingModel, MAX_SPEED, WORLD_LIMIT } from '../src/player/DrivingModel';
const idle = { throttle: 0, brake: 0, steer: 0 };
function drive(model: DrivingModel, seconds: number, input = idle) { for(let i=0;i<seconds*60;i++) model.update(1/60,input); }
test('acceleration is progressive, capped and moves forward', () => {
  const m=new DrivingModel(); drive(m,1,{...idle,throttle:1}); assert.ok(m.speed>12 && m.speed<15); assert.ok(m.z>0);
  drive(m,8,{...idle,throttle:1}); assert.equal(m.speed,MAX_SPEED);
});
test('coasting preserves inertia; brake stops without reverse', () => {
  const m=new DrivingModel(); drive(m,3,{...idle,throttle:1}); const speed=m.speed;
  drive(m,1); assert.ok(m.speed<speed && m.speed>speed*.8);
  drive(m,4,{...idle,brake:1}); assert.equal(m.speed,0);
});
test('steering ramps up and has release inertia; stationary craft cannot turn', () => {
  const m=new DrivingModel(); drive(m,1,{...idle,steer:1}); assert.equal(m.heading,0);
  drive(m,3,{...idle,throttle:1}); m.update(1/60,{...idle,steer:1}); assert.ok(m.yawRate>0 && m.yawRate<.1);
  drive(m,1,{...idle,steer:1}); const heading=m.heading; m.update(1/60,idle); assert.ok(m.heading>heading);
});
test('world boundary and reset remain stable', () => {
  const m=new DrivingModel(); drive(m,100,{...idle,throttle:1}); assert.ok(Math.hypot(m.x,m.z)<=WORLD_LIMIT+.001);
  m.reset(); assert.equal(m.speed+m.x+m.z+m.yawRate+m.vx+m.vz+m.heading,0);
});

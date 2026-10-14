import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FlightController } from '../src/player/FlightController';
import { Ramps, RAMP_ANGLES } from '../src/track/Ramps';
import { Track } from '../src/track/Track';
import { DrivingModel } from '../src/player/DrivingModel';
test('ramp launch is directional and only inside its hull-safe width', () => {
  const track = new Track(), ramps = new Ramps(track), model = new DrivingModel(), flight = new FlightController(); model.speed = 50;
  Object.assign(model,track.point(RAMP_ANGLES[0]+0.003)); ramps.update(track.point(RAMP_ANGLES[0]-0.003),model,flight); assert.ok(flight.airborne);
  flight.reset(); Object.assign(model,track.point(RAMP_ANGLES[0]-0.003)); ramps.update(track.point(RAMP_ANGLES[0]+0.003),model,flight); assert.ok(!flight.airborne);
  flight.reset();Object.assign(model,track.point(RAMP_ANGLES[0]+0.003,9)); ramps.update(track.point(RAMP_ANGLES[0]-0.003,9),model,flight); assert.ok(!flight.airborne);
});
test('higher entry speed gives higher and longer flight and always lands at water height', () => {
  const run = (speed: number) => { const f=new FlightController(); f.launch(speed); let peak=0,t=0; while(f.airborne && t<5) { f.beginStep(1/60); peak=Math.max(peak,f.height); t+=1/60; } assert.equal(f.height,0); assert.ok(f.landed); return {peak,t}; };
  const slow=run(25),fast=run(50); assert.ok(fast.peak>slow.peak && fast.t>slow.t); assert.ok(fast.t<3);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrivingModel, MAX_SPEED } from '../src/player/DrivingModel';
import { MotionInterpolation } from '../src/player/MotionInterpolation';
import { SPEED_TUNING, kmhToMps } from '../src/config/speed';
import { AIController } from '../src/ai/AIController';
import { Track } from '../src/track/Track';
const throttle = { throttle: 1, brake: 0, steer: 0 };
test('player reaches 100 km/h promptly and holds 180 km/h without oscillation', () => {
  const model = new DrivingModel(); let to100 = 0, to180 = 0;
  for (let i = 1; i <= 1200; i++) {
    // Isolate engine tuning from the existing finite world boundary.
    model.x = model.z = 0; model.update(1 / 60, throttle);
    if (!to100 && model.speed * 3.6 >= 100) to100 = i / 60;
    if (!to180 && model.speed === MAX_SPEED) to180 = i / 60;
    if (i > 360) assert.equal(model.speed, 50);
    assert.ok(model.speed <= 50 && Number.isFinite(model.vz));
  }
  assert.ok(to100 > 1 && to100 < 2.6, `0–100: ${to100}s`);
  assert.ok(to180 > 3 && to180 < 5.2, `0–180: ${to180}s`);
  assert.ok(Math.abs(model.vz - 50) < 0.001);
});
test('normal AI reach 160–175 km/h, accelerate progressively and retain reset behavior', () => {
  const track = new Track();
  for (const [i, maxKmh] of SPEED_TUNING.normalAI.maxKmh.entries()) {
    const ai = new AIController(`ai-${i}`, 'AI', kmhToMps(maxKmh), 0, track, -0.14);
    ai.update(1 / 60); assert.ok(ai.model.speed > 0 && ai.model.speed < 1);
    for (let frame = 0; frame < 600; frame++) ai.update(1 / 60);
    assert.ok(ai.model.speed * 3.6 >= 160 - 1e-8 && ai.model.speed * 3.6 <= 175 + 1e-8);
    assert.ok(Math.abs(ai.model.speed * 3.6 - maxKmh) < 1e-8);
    assert.ok(ai.model.speed < MAX_SPEED); ai.reset(); assert.equal(ai.model.speed, 0);
  }
});
test('steering transient and inertia match original driving at the same physical speed', () => {
  const revised = new DrivingModel(); revised.speed = 30;
  let oldYaw = 0, oldHeading = 0, oldSpeed = 30;
  for (let frame = 0; frame < 120; frame++) {
    const steer = frame < 60 ? 1 : 0, dt = 1 / 60;
    oldSpeed = Math.max(0, oldSpeed + (-0.7 - oldSpeed * 0.018) * dt);
    oldYaw += (steer * (0.9 - 0.23 * oldSpeed / 38) * Math.min(1, oldSpeed / 5) - oldYaw) * (1 - Math.exp(-dt * 3.5));
    oldHeading += oldYaw * dt;
    revised.update(dt, { throttle: 0, brake: 0, steer });
    assert.ok(Math.abs(revised.yawRate - oldYaw) < 1e-12);
    assert.ok(Math.abs(revised.heading - oldHeading) < 1e-12);
  }
});
test('display interpolation smooths intermediate frames without modifying driving physics', () => {
  const model = new DrivingModel(), motion = new MotionInterpolation(model);
  motion.capture(); model.x = 4; model.z = 8; model.heading = 0.2; model.speed = 50;
  const pose = motion.sample(0.5); assert.equal(pose.x, 2); assert.equal(pose.z, 4); assert.equal(pose.heading, 0.1);
  assert.equal(model.x, 4); assert.equal(model.speed, 50);
  const x1 = motion.sample(0.25).x, x2 = motion.sample(0.75).x; assert.ok(x2 > x1);
  assert.equal(motion.sample(-1).x, 0); assert.equal(motion.sample(2).x, 4);
});
test('recovery/reset discards old display poses so no interpolation crosses the track', () => {
  const model = new DrivingModel(), motion = new MotionInterpolation(model);
  motion.capture(); model.x = 200; model.heading = 7; motion.reset();
  for (const blend of [0, 0.5, 1]) { const pose = motion.sample(blend); assert.equal(pose.x, 200); assert.equal(pose.heading, 7); }
});

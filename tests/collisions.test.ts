import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrivingModel } from '../src/player/DrivingModel';
import { BoatCollisions, hullOverlap, type BoatBody } from '../src/physics/BoatCollisions';
import { AIController } from '../src/ai/AIController';
import { Track, signedAngle } from '../src/track/Track';
import { RaceController } from '../src/race/RaceController';
const dt = 1 / 60;
function boat(id: string, x: number, z: number, vx: number, vz: number, heading = Math.atan2(vx, vz)): BoatBody {
  const model = new DrivingModel(); Object.assign(model, { x, z, vx, vz, heading, speed: Math.hypot(vx, vz) }); return { id, model };
}
function advance(system: BoatCollisions, bodies: BoatBody[], time = dt) {
  system.capture(bodies); bodies.forEach(({ model }) => { model.x += model.vx * time; model.z += model.vz * time; }); system.resolve(bodies, time);
}
function separated(bodies: BoatBody[], tolerance = 0.002) {
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) assert.ok(hullOverlap(bodies[i].model, bodies[j].model) < tolerance, `${bodies[i].id}/${bodies[j].id} overlap ${hullOverlap(bodies[i].model, bodies[j].model)}`);
  bodies.forEach(({ model }) => { for (const value of [model.x, model.z, model.speed, model.vx, model.vz]) assert.ok(Number.isFinite(value)); });
}
test('player rear-ends AI: both separate, slow down and do not gain collision energy', () => {
  const system = new BoatCollisions(), bodies = [boat('player', 0, 0, 0, 50), boat('ai', 0, 4.85, 0, 40)];
  advance(system, bodies); separated(bodies); assert.equal(system.lastContacts, 1);
  assert.ok(bodies[0].model.speed < 50 && bodies[1].model.speed < 40);
  assert.ok(bodies[0].model.z < bodies[1].model.z);
});
test('side scrape offsets both boats and only loses a small amount of speed', () => {
  const system = new BoatCollisions(), bodies = [boat('player', 0, 0, 2, 48, 0), boat('ai', 1.61, 0, -2, 48, 0)];
  const initial = bodies[0].model.speed; advance(system, bodies); separated(bodies);
  assert.ok(bodies.every(b => b.model.speed > initial * 0.95 && b.model.speed <= initial));
  assert.ok(bodies[0].model.x < bodies[1].model.x);
});
test('180km/h head-on collision visibly slows both boats and prevents tunnelling', () => {
  const system = new BoatCollisions(), bodies = [boat('player', 0, -5, 0, 50, 0), boat('ai', 0, 5, 0, -50, Math.PI)];
  advance(system, bodies, 0.12); separated(bodies);
  assert.ok(system.lastSubsteps > 1); assert.equal(system.lastContacts, 1);
  assert.ok(bodies.every(b => b.model.speed < 10)); assert.ok(bodies[0].model.z < bodies[1].model.z);
});
test('AI/AI contact is symmetric and independent of array order', () => {
  const a = [boat('ai-1', 0, -2.35, 0, 48, 0), boat('ai-2', 0, 2.35, 0, -46, Math.PI)];
  const b = [boat('ai-2', 0, 2.35, 0, -46, Math.PI), boat('ai-1', 0, -2.35, 0, 48, 0)];
  advance(new BoatCollisions(), a); advance(new BoatCollisions(), b); separated(a); separated(b);
  for (const body of a) { const other = b.find(item => item.id === body.id)!.model; assert.ok(Math.abs(body.model.z - other.z) < 1e-8); assert.ok(Math.abs(body.model.speed - other.speed) < 1e-8); }
});
test('five overlapping starting boats separate without repeated impulses or numerical errors', () => {
  const system = new BoatCollisions(), bodies = Array.from({ length: 5 }, (_, i) => boat(`boat-${i}`, 120, -15, 0, 0, 0));
  advance(system, bodies); separated(bodies);
  assert.ok(system.lastContacts <= 10); assert.ok(bodies.every(b => b.model.speed === 0));
  const positions = bodies.map(b => [b.model.x, b.model.z]);
  for (let i = 0; i < 120; i++) advance(system, bodies);
  separated(bodies); assert.deepEqual(bodies.map(b => [b.model.x, b.model.z]), positions);
});
test('side impact at 180km/h is swept even when predicted end positions do not overlap', () => {
  const system = new BoatCollisions(), bodies = [boat('player', -5, 0, 50, 0), boat('ai', 5, 0, -50, 0)];
  advance(system, bodies, 0.2); separated(bodies); assert.equal(system.lastContacts, 1); assert.ok(bodies[0].model.x < bodies[1].model.x);
});
test('AI preserves collision displacement, recovers its lane and still finishes three laps', () => {
  const track = new Track(), ai = new AIController('ai', 'AI', 175 / 3.6, 0, track, -0.14), system = new BoatCollisions();
  const bodies = [{ id: 'ai', model: ai.model }, boat('player', ai.model.x + 1.2, ai.model.z, -8, 45, 0)];
  for (let i = 0; i < 300; i++) ai.update(dt);
  bodies[1].model.x = ai.model.x + 1.2; bodies[1].model.z = ai.model.z; bodies[1].model.heading = ai.model.heading;
  bodies[1].model.vx = ai.model.vx - 4; bodies[1].model.vz = ai.model.vz;
  advance(system, bodies); separated(bodies);
  const displaced = { x: ai.model.x, z: ai.model.z }, hitSpeed = ai.model.speed; ai.update(dt);
  assert.ok(Math.hypot(ai.model.x - displaced.x, ai.model.z - displaced.z) < 1.2); assert.ok(ai.model.speed <= hitSpeed + ai.acceleration * dt + 1e-8);
  const race = new RaceController(track, [{ id: 'player', name: 'Player', position: track.point(-0.14) }, { id: ai.id, name: ai.name, position: ai.model }]);
  race.phase = 'racing'; race.syncPosition(ai.id, ai.model);
  for (let i = 0; i < 90 * 60 && race.racers[1].finishTime === null; i++) { race.tick(dt); ai.update(dt); track.constrain(ai.model); race.record(ai.id, ai.model, dt); }
  assert.equal(race.racers[1].passed, 24); assert.ok(Math.abs(Math.hypot(ai.model.x, ai.model.z) - track.radius) < 0.1);
});
test('boats without contact retain exact original positions and velocities', () => {
  const system = new BoatCollisions(), body = boat('player', 0, 0, 7, 49), ai = boat('ai', 50, 50, 4, 48);
  system.capture([body, ai]); body.model.update(dt, { throttle: 1, brake: 0, steer: 1 });
  const expected = { ...body.model }; system.resolve([body, ai], dt); assert.deepEqual({ ...body.model }, expected);
});
test('collision resolution respects canal walls even when another boat pushes into the edge', () => {
  const track = new Track(), system = new BoatCollisions(), bodies = [boat('player', 140.9, 0, 0, 30, 0), boat('ai', 139.5, 0, 5, 30, 0)];
  system.capture(bodies); system.resolve(bodies, dt, model => { track.constrain(model); }); separated(bodies, 0.003);
  assert.ok(bodies.every(body => track.contains(body.model, 1 - 1e-8)));
});
test('crowded grid launches and all five boats keep racing instead of jittering or deadlocking', () => {
  const track = new Track(), system = new BoatCollisions(), player = new DrivingModel(); track.spawn(player);
  const ai = [175, 170, 165, 160].map((kmh, i) => new AIController(`ai-${i}`, 'AI', kmh / 3.6, 0, track, -0.14));
  const bodies: BoatBody[] = [{ id: 'player', model: player }, ...ai.map(a => ({ id: a.id, model: a.model }))];
  const race = new RaceController(track, bodies.map(b => ({ id: b.id, name: b.id, position: b.model }))); race.phase = 'racing';
  let contacts = 0;
  for (let frame = 0; frame < 120 * 60; frame++) {
    race.tick(dt); system.capture(bodies);
    {
      const p = track.point(track.angle(player) + 0.16), desired = Math.atan2(p.x - player.x, p.z - player.z);
      const turn = signedAngle(desired - player.heading) * 3 - player.yawRate;
      player.update(dt, { throttle: 1, brake: 0, steer: turn > 0.08 ? 1 : turn < -0.08 ? -1 : 0 }); track.constrain(player);
    }
    ai.forEach(a => { a.update(dt); track.constrain(a.model); });
    system.resolve(bodies, dt, model => { track.constrain(model); }); ai.forEach(a => { if (system.hasContact(a.id)) a.onContact(); }); contacts += system.lastContacts;
    separated(bodies, 0.006); bodies.forEach(b => race.record(b.id, b.model, dt, system.movementAllowance(b.id)));
    if (race.racers.every(r => r.finishTime !== null)) break;
  }
  assert.ok(contacts > 10); assert.ok(race.racers.every(r => r.passed === 24), JSON.stringify(race.racers.map(r => ({ id: r.id, passed: r.passed }))));
});
test('legitimate collision push across a checkpoint scores once without permitting unrelated teleports', () => {
  const track = new Track(), p = track.point(track.checkpointAngle(1) - 0.002);
  const player = boat('player', p.x, p.z, 0, 0, track.heading(track.checkpointAngle(1)));
  const behind = boat('ai', p.x + 0.5, p.z - 0.5, 0, 0, player.model.heading);
  const system = new BoatCollisions(), bodies = [player, behind];
  const race = new RaceController(track, [{ id: 'player', name: 'Player', position: player.model }]); race.phase = 'racing';
  system.capture(bodies); system.resolve(bodies, dt); race.record('player', player.model, dt, system.movementAllowance('player'));
  assert.equal(race.player.passed, 1); race.record('player', player.model, dt); assert.equal(race.player.passed, 1);
});
test('AI blocked by a stopped player clears the hull and resumes normal speed', () => {
  const track = new Track(), ai = new AIController('ai-1', 'AI', 175 / 3.6, 0, track, -0.14), system = new BoatCollisions();
  ai.model.speed = ai.targetSpeed; ai.model.vx = Math.sin(ai.model.heading) * ai.targetSpeed; ai.model.vz = Math.cos(ai.model.heading) * ai.targetSpeed;
  const obstacle = new DrivingModel(); track.spawn(obstacle, -0.08);
  const bodies = [{ id: 'ai-1', model: ai.model }, { id: 'player', model: obstacle }];
  let contacts = 0, travelledAngle = 0;
  for (let i = 0; i < 15 * 60; i++) {
    const before = track.angle(ai.model);
    system.capture(bodies); obstacle.update(dt, { throttle: 0, brake: 0, steer: 0 }); ai.update(dt);
    system.resolve(bodies, dt, model => { track.constrain(model); });
    if (system.hasContact(ai.id)) ai.onContact(); contacts += system.lastContacts; separated(bodies);
    travelledAngle += signedAngle(track.angle(ai.model) - before);
  }
  assert.ok(contacts > 0); assert.ok(ai.model.speed > 40); assert.ok(travelledAngle > 2);
});

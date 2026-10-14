import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Track, TAU, signedAngle } from '../src/track/Track';
import { RaceController } from '../src/race/RaceController';
import { AIController } from '../src/ai/AIController';
import { DrivingModel, MAX_SPEED } from '../src/player/DrivingModel';
import { SPEED_TUNING, kmhToMps } from '../src/config/speed';
import { formatTime } from '../src/ui/formatTime';
const dt = 1 / 60;
function setup() {
  const track = new Track();
  const race = new RaceController(track, [{ id: 'player', name: 'Player', position: track.point(-0.14) }, { id: 'ai', name: 'AI', position: track.point(-0.18) }]);
  return { track, race };
}
function start(race: RaceController) { for (let i = 0; i < 180; i++) race.tick(dt); }
function gate(race: RaceController, track: Track, index: number, id = 'player', reverse = false, lane = 0) {
  const angle = track.checkpointAngle(index), sign = reverse ? -1 : 1;
  race.syncPosition(id, track.point(angle - sign * 0.001, lane)); race.tick(dt);
  race.record(id, track.point(angle + sign * 0.001, lane), dt); race.completeStep();
}
test('countdown locks scoring and timer; racing starts after 3 seconds', () => {
  const { race, track } = setup(); race.record('player', track.point(1), dt);
  assert.equal(race.player.passed, 0); assert.equal(race.elapsed, 0);
  for (let i = 0; i < 179; i++) race.tick(dt);
  assert.equal(race.phase, 'countdown'); race.tick(dt); assert.equal(race.phase, 'racing');
  race.tick(dt); assert.ok(race.elapsed > 0);
});
test('start line, skipped gates, reverse crossings, off-track crossings and teleports do not grant laps', () => {
  const { race, track } = setup(); start(race);
  gate(race, track, 0); gate(race, track, 2); gate(race, track, 1, 'player', true); gate(race, track, 1, 'player', false, 30);
  assert.equal(race.player.passed, 0); assert.equal(race.lap(), 1);
  race.syncPosition('player', track.point(track.checkpointAngle(1) - 0.1));
  race.record('player', track.point(track.checkpointAngle(1) + 0.1), dt); assert.equal(race.player.passed, 0);
  gate(race, track, 1); assert.equal(race.player.passed, 1);
  gate(race, track, 1); assert.equal(race.player.passed, 1);
});
test('ordered gates complete exactly 3 laps and freeze finish time', () => {
  const { race, track } = setup(); start(race);
  for (let i = 1; i <= 24; i++) {
    gate(race, track, i % 8);
    assert.equal(race.player.passed, i);
    assert.equal(race.lap(), Math.min(3, Math.floor(i / 8) + 1));
    if (i < 24) assert.equal(race.phase, 'racing');
  }
  assert.equal(race.phase, 'finished'); const elapsed = race.elapsed; race.tick(10); assert.equal(race.elapsed, elapsed);
  assert.equal(race.player.finishTime, elapsed);
});
test('rank uses validated sector progress and finish order, and recovery retains timing/checkpoints', () => {
  const { race, track } = setup(); start(race);
  race.syncPosition('ai', track.point(0.1)); race.syncPosition('player', track.point(0.2)); assert.equal(race.playerRank, 1);
  gate(race, track, 1, 'ai'); race.syncPosition('player', track.point(3)); assert.equal(race.playerRank, 2);
  gate(race, track, 1); const elapsed = race.elapsed; race.syncPosition('player', track.point(track.checkpointAngle(1) + 0.025));
  assert.equal(race.elapsed, elapsed); assert.equal(race.player.passed, 1);
  for (let i = 2; i <= 24; i++) gate(race, track, i % 8, 'ai');
  for (let i = 2; i <= 24; i++) gate(race, track, i % 8);
  assert.equal(race.playerRank, 2); assert.ok(race.racers[1].finishTime! < race.player.finishTime!);
});
test('track walls constrain both boundaries and remove outward velocity', () => {
  const track = new Track(), model = new DrivingModel();
  model.x = 160; model.vx = 10; model.vz = 8; model.speed = 20;
  assert.ok(track.constrain(model)); assert.ok(track.contains(model, 1)); assert.equal(model.vx, 0); assert.equal(model.vz, 8); assert.ok(model.speed < 20);
  model.x = 80; model.vx = -10; track.constrain(model); assert.ok(track.contains(model, 1)); assert.equal(model.vx, 0);
});
test('four different AI racers follow the route and finish through the same gates', () => {
  const track = new Track();
  const ai = SPEED_TUNING.normalAI.maxKmh.map((speed, i) => new AIController(`ai-${i}`, `AI ${i}`, kmhToMps(speed), i % 2 ? 7 : -7, track, -0.13 - i * 0.03));
  const race = new RaceController(track, [{ id: 'player', name: 'Player', position: track.point(-0.07) }, ...ai.map(a => ({ id: a.id, name: a.name, position: a.model }))]); start(race);
  for (let i = 0; i < 100 * 60; i++) {
    race.tick(dt);
    ai.forEach(a => { if (race.racers.find(r => r.id === a.id)!.finishTime === null) { a.update(dt); race.record(a.id, a.model, dt); } assert.ok(track.contains(a.model)); });
  }
  assert.ok(race.racers.slice(1).every(r => r.finishTime !== null && r.passed === 24));
  // The shorter inner lane lets the 165 km/h racer beat the 170 km/h outer-lane racer.
  assert.deepEqual(race.standings().map(r => r.id), ['ai-0', 'ai-2', 'ai-1', 'ai-3', 'player']);
  ai.forEach(a => a.reset()); assert.equal(ai[0].model.speed, 0);
});
test('real player driving model can complete a full race with digital steering', () => {
  const { race, track } = setup(), model = new DrivingModel(); track.spawn(model); start(race);
  let wallHits = 0;
  for (let i = 0; i < 100 * 60 && race.phase === 'racing'; i++) {
    const angle = track.angle(model), target = track.point(angle + 0.16);
    const desired = Math.atan2(target.x - model.x, target.z - model.z);
    const turn = signedAngle(desired - model.heading) * 3 - model.yawRate;
    const steer = turn > 0.08 ? 1 : turn < -0.08 ? -1 : 0;
    race.tick(dt); model.update(dt, { throttle: 1, brake: 0, steer });
    if (track.constrain(model)) wallHits++;
    race.record('player', model, dt); race.completeStep();
  }
  assert.equal(race.phase, 'finished'); assert.equal(race.player.passed, 24); assert.equal(wallHits, 0);
  assert.ok(race.elapsed > track.length * 3 / MAX_SPEED && race.elapsed < 90);
});
test('new race clears all previous progress and timing; time formatting carries correctly', () => {
  const { race, track } = setup(); start(race); gate(race, track, 1);
  const fresh = new RaceController(track, [{ id: 'player', name: 'Player', position: track.point(-0.07) }]);
  assert.equal(fresh.player.passed, 0); assert.equal(fresh.phase, 'countdown'); assert.equal(fresh.elapsed, 0);
  assert.equal(formatTime(59.999), '00:59.99'); assert.equal(formatTime(60), '01:00.00');
});

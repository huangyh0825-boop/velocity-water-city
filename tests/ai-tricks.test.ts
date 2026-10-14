import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIController } from '../src/ai/AIController';
import { Track } from '../src/track/Track';
import { Ramps } from '../src/track/Ramps';

test('AI uses shared tricks, restores landing posture and rewards each jump once', () => {
  const track = new Track(), ramps = new Ramps(track);
  const ai = new AIController('ai-2', 'AI', 170/3.6, 7, track, -.18);
  ai.setRamps(ramps);
  let jumps=0, rewards=0;
  const kinds = new Set<string>();
  for (let i=0; i<3000; i++) {
    ai.update(1/60); track.constrain(ai.model); ai.finishStep();
    const energy = ai.nitro.energy;
    ai.updateActions(1/60, true);
    if (ai.flight.takeoff) jumps++;
    if (ai.tricks.kind) kinds.add(ai.tricks.kind);
    if (ai.flight.landed) {
      if (ai.tricks.message.startsWith('特技成功')) rewards++;
      assert.equal(ai.tricks.kind, null);
      assert.deepEqual(ai.tricks.rotation, {pitch:0,yaw:0});
      assert.equal(ai.nitro.energy, Math.min(100,energy+(ai.tricks.completed?35:0)));
      ai.updateActions(1/60,true); assert.equal(ai.nitro.energy,Math.min(100,energy+(ai.tricks.completed?35:0)));
    }
  }
  assert.ok(jumps>=3 && rewards>=2 && kinds.size>=2);
  ai.reset(); assert.equal(ai.nitro.energy,40); assert.equal(ai.tricks.kind,null);
});

test('AI refuses late or illegal tricks and shares failed landing penalty', () => {
  const ai = new AIController('ai-2','AI',45,0,new Track(),0);
  ai.flight.launch(50); ai.updateActions(1/60,true);
  ai.flight.height=.01; ai.flight.verticalSpeed=-10; ai.flight.elapsed=1.6;
  ai.updateActions(1/60,true); assert.equal(ai.tricks.used,false);
  ai.flight.reset(); ai.flight.height=2; ai.flight.fall(); ai.updateActions(1/60,true);
  assert.equal(ai.tricks.used,false);
  ai.flight.reset(); ai.flight.launch(50); ai.tricks.beginJump(); ai.tricks.request(ai.flight);
  ai.model.speed=50; ai.model.vx=50; ai.flight.beginStep(2); ai.updateActions(1/60,false);
  assert.equal(ai.model.speed,36); assert.equal(ai.nitro.energy,40);
  ai.updateActions(1/60,false); assert.equal(ai.model.speed,36);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NitroDecision } from '../src/ai/NitroDecision';
import { AIController } from '../src/ai/AIController';
import { Track } from '../src/track/Track';
import { Ramps } from '../src/track/Ramps';
import { NITRO_TUNING } from '../src/config/phase3';

test('AI requests stable bursts but danger, contact and empty fuel stop immediately', () => {
  const decision=new NitroDecision(0);
  const situation={safe:true,opportunity:true,energy:40};
  assert.equal(decision.update(1/60,situation),true);
  for(let i=0;i<30;i++) assert.equal(decision.update(1/60,{...situation,opportunity:false}),true);
  assert.equal(decision.update(1/60,{...situation,safe:false}),false);
  decision.reset();decision.update(1/60,situation);decision.contact();
  assert.equal(decision.update(1/60,situation),false);
  decision.reset(); assert.equal(decision.update(1/60,{...situation,energy:0}),false);
});

test('AI uses shared finite nitro and returns to its original normal cap; reset clears decisions', () => {
  const track=new Track(), ramps=new Ramps(track), ai=new AIController('ai-2','AI',170/3.6,7,track,-.18);
  ai.setRamps(ramps); let active=0,peak=0;
  for(let i=0;i<1300;i++){
    ai.update(1/60); track.constrain(ai.model); ai.finishStep();
    if(ai.nitro.active)active++;
    peak=Math.max(peak,ai.model.speed);
    assert.ok(ai.model.speed<=ai.targetSpeed*NITRO_TUNING.multiplier+1e-8);
    assert.ok(ai.nitro.energy>=0&&ai.nitro.energy<=40);
  }
  assert.ok(active>100&&peak>ai.targetSpeed*1.15);
  assert.equal(ai.nitro.energy,0); assert.equal(ai.nitro.active,false);assert.equal(ai.model.speed,ai.targetSpeed);
  ai.nitro.reward(35);const energy=ai.nitro.energy;
  const nearby={id:'player',model:{...ai.model,x:ai.model.x+3},height:ai.flight.height};
  ai.update(1/60,[nearby as any]);assert.equal(ai.nitro.active,false);assert.equal(ai.nitro.energy,energy);
  ai.reset(); assert.equal(ai.nitro.energy,40);assert.equal(ai.boostDecision.requested,false);assert.equal(ai.model.speed,0);
});

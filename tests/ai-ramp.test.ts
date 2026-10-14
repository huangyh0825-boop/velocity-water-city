import {test} from 'node:test';import assert from 'node:assert/strict';
import {Track} from '../src/track/Track';import {Ramps} from '../src/track/Ramps';import {AIController} from '../src/ai/AIController';import {RaceController} from '../src/race/RaceController';
test('AI approaches shared ramps smoothly, jumps, lands and finishes ordered checkpoints',()=>{
 const track=new Track(),ramps=new Ramps(track),ai=new AIController('ai-2','AI',170/3.6,7,track,-.18);ai.setRamps(ramps);
 const race=new RaceController(track,[{id:'player',name:'player',position:track.point(-.14)},{id:ai.id,name:ai.name,position:ai.model}]);race.phase='racing';let jumps=0,landings=0,approach=false;
 for(let i=0;i<7000&&race.racers[1].finishTime===null;i++){const old={x:ai.model.x,z:ai.model.z};race.tick(1/60);ai.update(1/60);track.constrain(ai.model);ai.finishStep();if(ai.flight.takeoff)jumps++;if(ai.flight.landed)landings++;approach ||= ai.navigation.mode==='approach';assert.ok(Math.hypot(ai.model.x-old.x,ai.model.z-old.z)<1.1);assert.ok(track.contains(ai.model,1-1e-8));race.record(ai.id,ai.model,1/60);}
 assert.ok(approach&&jumps>=2&&landings>=2);assert.equal(race.racers[1].passed,24);ai.reset();assert.equal(ai.flight.height,0);assert.equal(ai.navigation.mode,'route');
});
test('congested runway or inadequate alignment time causes bypass instead of center teleport',()=>{
 const track=new Track(),ramps=new Ramps(track),ai=new AIController('ai-2','AI',170/3.6,7,track,.2);ai.setRamps(ramps);ai.model.speed=45;
 const r=ramps.data[0],near=track.point(r.angle-.1),peers=[{id:'a',model:{...ai.model,...near}},{id:'b',model:{...ai.model,...track.point(r.angle-.05)}}];
 ai.update(1/60,peers as any);assert.ok(!ai.navigation.selected);assert.ok(Math.abs(Math.hypot(ai.model.x,ai.model.z)-(track.radius+7))<.2);
});

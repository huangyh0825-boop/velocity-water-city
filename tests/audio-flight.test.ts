import {test} from 'node:test';import assert from 'node:assert/strict';import {audioMix,distanceGain} from '../src/audio/AudioMix';
test('air reduces water to zero, retains engine and boost, and adds wind; landing restores water',()=>{
 const s={speed:50,throttle:1,boost:true,grounded:true,running:true,airborne:false};const water=audioMix(s),air=audioMix({...s,grounded:false,airborne:true});
 assert.ok(water.water>0&&water.breaking>0&&water.wind===0);assert.equal(air.water+air.breaking,0);assert.ok(air.engine>0&&air.wind>0&&air.rpm>water.rpm);assert.equal(air.boost,water.boost);assert.deepEqual(audioMix(s),water);
});
test('AI distance attenuation is finite and bounded and ramp climbing is not treated as flying',()=>{
 assert.equal(distanceGain(0),1);assert.ok(distanceGain(30)>distanceGain(100));assert.equal(distanceGain(140),0);
 assert.equal(audioMix({speed:40,throttle:1,boost:false,running:true,grounded:false,airborne:false}).wind,0);
});

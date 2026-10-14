import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CountdownCue } from '../src/audio/CountdownCue';
test('countdown emits 3/2/1/GO once and resets for a new race',()=>{
 const cue=new CountdownCue(),notes:number[]=[];
 for(let i=0;i<240;i++){const time=i/60,value=cue.update(time<3?'countdown':'racing',Math.max(0,3-time));if(value!==null)notes.push(value);}
 assert.deepEqual(notes,[3,2,1,0]);cue.reset();assert.equal(cue.update('countdown',3),3);assert.equal(cue.update('countdown',3),null);
});
test('late join, paused updates and finish do not replay old countdown tones',()=>{
 const cue=new CountdownCue();assert.equal(cue.update('racing',0),null);assert.equal(cue.update('racing',0),null);assert.equal(cue.update('finished',0),null);
 cue.reset();assert.equal(cue.update('countdown',1.4),2);assert.equal(cue.update('countdown',1.4),null);assert.equal(cue.update('racing',0),0);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CityTrack} from '../src/track/CityTrack';
import {RaceController} from '../src/race/RaceController';
import {TAU} from '../src/track/Track';

test('main-road CP12 counts when shortcut detection still tags the boat as tunnel-cut',()=>{
 const t=new CityTrack(),angle=t.checkpointAngle(12),before=t.point(angle-.0003,-10),after=t.point(angle+.0003,-10);
 const race=new RaceController(t,[{id:'player',name:'Player',position:before}]);race.phase='racing';race.player.passed=11;race.player.route='tunnel-cut';
 race.tick(1/60);race.record('player',after,1/60);
 assert.equal(race.player.route,'tunnel-cut','reproduce the overlapping-route marker, rather than clearing it to pass the test');
 assert.equal(race.player.passed,12);
});

test('main gates accept stale route markers and entered shortcut gates retain direction and height checks',()=>{
 const t=new CityTrack();
 for(let index=0;index<t.checkpointCount;index++){
  const angle=t.checkpointAngle(index),routes=[null,...t.shortcuts.filter(s=>angle>s.from&&angle<s.to).map(s=>s.id)];
  for(const physical of routes){
   const before=t.routePoint(angle-.0002,0,physical),after=t.routePoint(angle+.0002,0,physical);
   for(const marker of physical===null?[undefined,null,'tunnel-cut','harbor-cut']:[undefined,physical]){
    assert.ok(t.crossesGate(before,after,index,marker),`CP${index}, physical ${physical}, marker ${marker}`);
    assert.equal(t.crossesGate(after,before,index,marker),false,'reverse crossing remains invalid');
    assert.equal(t.crossesGate({...before,y:-5},{...after,y:-5},index,marker),false,'below-water crossing remains invalid');
   }
  }
 }
});

test('a continuous inside-main-road route without AI route intent advances all three laps and finishes',()=>{
 const t=new CityTrack(),dt=1/60,advance=40*dt/t.radius;
 let angle=-.014;const start={...t.point(angle,-10),route:null};
 const race=new RaceController(t,[{id:'player',name:'Player',position:start}]);race.phase='racing';
 const laps=[race.lap()];let taggedMain=false;
 for(let step=0;step<60*400&&race.player.finishTime===null;step++){
  angle+=advance;const position={...t.point(angle,-10),route:race.player.route};
  const elapsed=Math.max(dt,Math.hypot(position.x-race.player.previous.x,position.z-race.player.previous.z)/40);
  race.tick(elapsed);race.record('player',position,elapsed);race.completeStep();
  taggedMain ||= race.player.route==='tunnel-cut';
  if(laps.at(-1)!==race.lap())laps.push(race.lap());
 }
 assert.ok(taggedMain,'the player has no routeIntent, so automatic acquisition is exercised');
 assert.deepEqual(laps,[1,2,3]);assert.equal(race.player.passed,72);assert.equal(race.phase,'finished');
 assert.ok(Math.abs(angle-3*TAU)<.01,'exactly three complete circuits, allowing the offset lane to cross the finish plane just before its centreline sample');
 const finish=race.player.finishTime;race.tick(10);race.record('player',t.point(angle+advance,-10),dt);race.completeStep();
 assert.equal(race.player.finishTime,finish);assert.equal(race.elapsed,finish);assert.equal(race.player.passed,72);
});

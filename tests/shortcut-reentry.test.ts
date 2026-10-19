import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CityTrack} from '../src/track/CityTrack';
import {RaceController} from '../src/race/RaceController';
import type {Point} from '../src/track/Track';

function setup(){
 const track=new CityTrack(),cut=track.shortcuts[1],start=track.routePoint(cut.from,0,cut.id);
 const race=new RaceController(track,[{id:'player',name:'Player',position:start}]);race.phase='racing';race.player.passed=15;
 const move=(position:Point)=>{const previous=race.player.previous,dt=Math.max(1/60,Math.hypot(position.x-previous.x,position.z-previous.z)/40);race.tick(dt);race.record('player',position,dt);race.completeStep();};
 const point=(fraction:number,lane=0)=>track.routePoint(cut.from+(cut.to-cut.from)*fraction,lane,cut.id);
 return{track,cut,race,move,point};
}

test('S2 legal entrance survives flight deviation, reacquires downstream and counts CP19',()=>{
 const{race,move,point}=setup();
 for(let i=1;i<=64;i++)move(point(i/128));
 assert.equal(race.player.route,'harbor-cut');assert.equal(race.player.passed,18);assert.ok(race.player.enteredRoutes.has('harbor-cut'));
 // Matches the observed Game.frame failure: a small airborne steering change
 // takes the hull just past the 6m corridor plus 4m route-loss tolerance.
 move({...point(.522,11),y:1.9});
 assert.equal(race.player.route,null,'retain physical route recovery rather than pinning a false shortcut tag');
 assert.ok(race.player.enteredRoutes.has('harbor-cut'));
 move(point(.55,8));move(point(.57,4));
 assert.equal(race.player.route,'harbor-cut','returning to the actual shortcut restores its legal route');
 for(let i=74;i<=120;i++)move(point(i/128));
 assert.equal(race.player.passed,20,'CP19 and CP20 both count after returning');
});

test('downstream shortcut cannot be acquired without a legal entrance, in reverse, or by teleport',()=>{
 const{track,cut,race,point}=setup(),a=point(.67),b=point(.68);
 race.player.passed=18;race.syncPosition('player',a);race.record('player',b,1/60);
 assert.equal(race.player.route,null);assert.equal(race.player.passed,18);assert.equal(race.player.enteredRoutes.size,0);
 const entryA=point(.01),entryB=point(.02);race.syncPosition('player',entryA);race.record('player',entryB,1/6000);
 assert.equal(race.player.enteredRoutes.size,0,'discontinuous entry grants no authorization');
 assert.equal(track.raceRoute(b,a,null,new Set([cut.id])),null,'reverse movement cannot reacquire a branch');
});

test('shortcut entrance authorization is per racer and expires when that lap completes',()=>{
 const{track,race,move,point}=setup();
 for(let i=1;i<10;i++)move(point(i/128));assert.ok(race.player.enteredRoutes.has('harbor-cut'));
 const before=track.point(-.0003),after=track.point(.0003);race.player.passed=23;race.syncPosition('player',before);move(after);
 assert.equal(race.player.passed,24);assert.equal(race.player.enteredRoutes.size,0);
 const a=point(.67),b=point(.68),fresh=new RaceController(track,[{id:'player',name:'new',position:a},{id:'ai',name:'AI',position:a}]);
 fresh.phase='racing';fresh.player.enteredRoutes.add('harbor-cut');fresh.player.passed=18;fresh.racers[1].passed=18;
 const dt=Math.hypot(b.x-a.x,b.z-a.z)/40;fresh.record('player',{...b},dt);fresh.record('ai',{...b},dt);
 assert.equal(fresh.player.passed,19);assert.equal(fresh.racers[1].passed,18);assert.equal(fresh.racers[1].enteredRoutes.size,0);
});

test('recovery preserves this lap entrance history while a new race starts with none',()=>{
 const{track,race,move,point}=setup();for(let i=1;i<10;i++)move(point(i/128));
 race.syncPosition('player',point(.55));assert.ok(race.player.enteredRoutes.has('harbor-cut'));
 const before=race.player.previous,after=point(.56),dt=Math.hypot(after.x-before.x,after.z-before.z)/40;race.record('player',after,dt);
 assert.equal(race.player.route,'harbor-cut');
 const restart=new RaceController(track,[{id:'player',name:'Player',position:point(0)}]);
 assert.equal(restart.player.enteredRoutes.size,0);assert.equal(restart.phase,'countdown');assert.equal(restart.player.passed,0);
});

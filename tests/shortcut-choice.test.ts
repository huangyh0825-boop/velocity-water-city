import{test}from'node:test';
import assert from'node:assert/strict';
import{CityTrack}from'../src/track/CityTrack';
import{RaceController}from'../src/race/RaceController';
import{TAU,type Point}from'../src/track/Track';

function course(firstCut:boolean,entryCut:boolean,exitCut:boolean){
 const track=new CityTrack(),start=track.point(-.014),race=new RaceController(track,[{id:'player',name:'P',position:start}]);race.phase='racing';
 const move=(p:Point)=>{const a=race.player.previous,dt=Math.max(1/60,Math.hypot(p.x-a.x,p.z-a.z)/35);race.tick(dt);race.record('player',p,dt);race.completeStep();};
 const main=(from:number,to:number)=>{const steps=Math.ceil((to-from)*6000);for(let i=1;i<=steps;i++)move(track.point((from+(to-from)*i/steps)*TAU));};
 const cut=(index:number,from=0,to=1)=>{const c=track.shortcuts[index],steps=Math.ceil((to-from)*1400);for(let i=1;i<=steps;i++)move(track.routePoint(c.from+(c.to-c.from)*(from+(to-from)*i/steps),0,c.id));};
 const checkpoints:number[]=[];
 for(let lap=0;lap<3;lap++){
  main(lap===0?-.014/TAU:0,.48);if(firstCut)cut(0);else main(.48,.61);main(.61,.65);
  if(entryCut)cut(1,0,.5);else main(.65,.7459);
  // The lower S2 crossing connects these corridors at the water surface.
  // Main-road entrants have never acquired harbor-cut at its raised entrance.
  if(!entryCut)assert.equal(race.player.enteredRoutes.has('harbor-cut'),false);
  if(exitCut)cut(1,.5,1);else main(.7459,.86);
  main(.86,1);checkpoints.push(race.player.passed);
 }
 return{track,race,checkpoints};
}

test('both shortcuts allow every main/branch choice, including entry at the lower S2 crossing, for three laps',()=>{
 for(const firstCut of[false,true])for(const entryCut of[false,true])for(const exitCut of[false,true]){
  const{race,checkpoints}=course(firstCut,entryCut,exitCut);
  assert.deepEqual(checkpoints,[24,48,72],JSON.stringify({firstCut,entryCut,exitCut,checkpoints}));
  assert.equal(race.phase,'finished');assert.equal(race.lap(),3);assert.ok(race.player.finishTime!>0);
 }
});

test('only shortcut fork-to-merge markers are optional; HUD targets the next common mandatory gate',()=>{
 const track=new CityTrack(),race=new RaceController(track,[{id:'player',name:'P',position:track.point(0)}]);
 assert.deepEqual(Array.from({length:24},(_,i)=>i).filter(i=>!track.checkpointRequired(i)),[12,13,14,16,17,18,19,20]);
 for(const[passed,next]of[[10,11],[11,15],[12,15],[14,15],[15,21],[17,21],[20,21],[21,22],[23,0],[35,15],[39,21]]){race.player.passed=passed;assert.equal(race.nextCheckpoint(),next);}
});

test('missing a mandatory gate, reverse travel, off-water travel, discontinuities and repeated exits cannot gain laps',()=>{
 const track=new CityTrack();
 for(const passed of[10,11,14,15,18,20,23]){
  const gate=passed<15?15:21,angle=track.checkpointAngle(gate),a=track.point(angle-.0001),b=track.point(angle+.0001);
  for(const invalid of['missing','reverse','off-water','teleport','height']){
   const start=invalid==='reverse'?b:a,race=new RaceController(track,[{id:'player',name:'P',position:start}]);race.phase='racing';race.player.passed=invalid==='missing'?(gate===15?10:14):passed;
   const before=race.player.passed;
   if(invalid==='off-water')race.syncPosition('player',track.point(angle-.0001,80));
   if(invalid==='height')race.syncPosition('player',{...a,y:80});
   race.record('player',invalid==='reverse'?a:invalid==='off-water'?track.point(angle+.0001,80):invalid==='height'?{...b,y:80}:b,invalid==='teleport'?1/100000:1/60);
   assert.equal(race.player.passed,before,`${passed}: ${invalid}`);
  }
 }
 const race=new RaceController(track,[{id:'player',name:'P',position:track.point(21/24*TAU-.0001)}]);race.phase='racing';race.player.passed=15;
 race.record('player',track.point(21/24*TAU+.0001),1/60);assert.equal(race.player.passed,21);
 race.record('player',track.point(21/24*TAU-.0001),1/60);race.record('player',track.point(21/24*TAU+.0001),1/60);assert.equal(race.player.passed,21);
 assert.equal(race.player.finishTime,null);assert.equal(race.lap(),1);
});

import {test}from'node:test';import assert from'node:assert/strict';
import{CityTrack}from'../src/track/CityTrack';import{DrivingModel}from'../src/player/DrivingModel';
import{RaceController}from'../src/race/RaceController';import{signedAngle,type Point}from'../src/track/Track';
import{Ramps}from'../src/track/Ramps';import{FlightController}from'../src/player/FlightController';

test('every safe main and shortcut surface remains open with either route tag, sideways or reversed',()=>{
 const t=new CityTrack();let checked=0;
 for(const cut of t.shortcuts)for(const fraction of[0,.02,.05,.10,.15,.20,.25,.3,.4,.5,.6,.7,.8,.85,.9,.95,.98,1])for(const physical of[null,cut.id])for(const lane of[-4,0,4])for(const logical of[null,cut.id]){
  const angle=cut.from+(cut.to-cut.from)*fraction,p=t.routePoint(angle,lane,physical),q=t.project(p,physical);
  if(q.distance>q.width-3)continue;
  for(const rotation of[0,Math.PI/2,Math.PI])for(const kmh of[5,40,100,160]){
   const m=new DrivingModel();t.spawn(m,angle);Object.assign(m,p,{route:logical,heading:t.routeHeading(angle,physical)+rotation,speed:kmh/3.6});m.vx=Math.sin(m.heading)*m.speed;m.vz=Math.cos(m.heading)*m.speed;
   const before={...m};
   assert.equal(t.constrain(m),false,`${cut.id} fraction ${fraction}, physical ${physical}, logical ${logical}, lane ${lane}, rotation ${rotation}, ${kmh}km/h`);
   assert.deepEqual({...m},before);assert.equal(t.contains(m,2.6),true);assert.ok(Math.abs(t.surface(m).height-p.y!)<=1);checked++;
  }
 }
 assert.equal(checked,3912);
});

test('a five-kmh racer on main water outside the old mouth cap accelerates without being pulled into a shortcut',()=>{
 const t=new CityTrack();
 for(const cut of t.shortcuts){
  const angle=cut.from+(cut.to-cut.from)*.25,m=new DrivingModel(),flight=new FlightController(),ramps=new Ramps(t);
  t.spawn(m,angle);m.route=cut.id;m.speed=5/3.6;m.vx=Math.sin(m.heading)*m.speed;m.vz=Math.cos(m.heading)*m.speed;
  ramps.place(m,flight);const start=t.project(m,null).angle,race=new RaceController(t,[{id:'player',name:'p',position:m}]);race.phase='racing';race.player.route=cut.id;
  let completed=false;
  for(let i=0;i<1500;i++){
   const before={...m},target=t.routeTarget(m,Math.max(18,m.speed*.65),0,null),desired=Math.atan2(target.x-m.x,target.z-m.z);
   flight.beginStep(1/60);m.update(1/60,{throttle:m.speed<40/3.6?1:0,brake:m.speed>40/3.6+.3?1:0,steer:Math.max(-1,Math.min(1,signedAngle(desired-m.heading)*2.7/.67))});
   const q=t.project(m,null),safe=q.distance<=q.width-3;
   if(safe)assert.equal(t.constrain(m),false,`${cut.id}: no invisible bank while recovering from 5km/h`);else t.constrain(m);
   ramps.prepare(m,flight);ramps.update(before,m,flight);race.tick(1/60);race.record('player',m,1/60);
   if((t.project(m,null).angle-start)*t.radius>80){completed=true;break;}
  }
  assert.ok(completed);assert.equal(m.route,null);assert.ok(m.speed*3.6>35);
 }
});

test('physical support follows actual water height with a stale route and invalidates its cache when height changes',()=>{
 const t=new CityTrack(),cut=t.shortcuts[1],angle=cut.from+(cut.to-cut.from)*.32,p=t.routePoint(angle,0,cut.id),m={...p,route:null};
 assert.equal(t.surface(m).height,12);m.y=0;
 assert.equal(t.surface(m).height,t.heightAt(t.project(m,null).angle));
});

test('recognizing a shortcut never closes safe main-canal water at its entrance or exit',()=>{
 const t=new CityTrack();
 for(const cut of t.shortcuts)for(const mouth of ['entrance','exit']as const){
  let checked=0,outsideShortcut=0;
  for(let distance=0;distance<=100;distance+=2){
   const angle=mouth==='entrance'?cut.from+distance/t.radius:cut.to-distance/t.radius;
   for(const lane of[-8,-4,0,4,8]){
    const p=t.routePoint(angle,lane,null),main=t.project(p,null),branch=t.project(p,cut.id),fraction=(branch.angle-cut.from)/(cut.to-cut.from);
    if(main.distance>main.width-3||Math.abs(t.heightAt(main.angle,null)-t.heightAt(branch.angle,cut.id))>1)continue;
    if(mouth==='entrance'?fraction>Math.max(.15,cut.entryPortal??.15):fraction<Math.min(.85,cut.exitPortal??.85))continue;
    const m=new DrivingModel();Object.assign(m,p,{route:cut.id,heading:t.heading(angle),speed:30,vx:Math.sin(t.heading(angle))*30,vz:Math.cos(t.heading(angle))*30});
    const before={x:m.x,z:m.z,speed:m.speed,vx:m.vx,vz:m.vz};
    assert.equal(t.constrain(m),false,`${cut.id} ${mouth}, main distance ${distance}m, lane ${lane}, branch distance ${branch.distance.toFixed(2)}`);
    assert.deepEqual({x:m.x,z:m.z,speed:m.speed,vx:m.vx,vz:m.vz},before);assert.equal(t.contains(m,2.6),true);
    checked++;if(branch.distance>branch.width-1)outsideShortcut++;
   }
  }
  assert.ok(checked>10,`${cut.id}/${mouth} shared water tested`);
  if(mouth==='entrance')assert.ok(outsideShortcut>0,`${cut.id} main water beyond shortcut's narrow bounds tested`);
 }
});

test('a manually recognized shortcut can be declined and the racer can continue down the main canal',()=>{
 const t=new CityTrack();
 for(const cut of t.shortcuts)for(const kmh of[40,100,160])for(const lane of[-6,0,6]){
  const entry=cut.samples.find((s,i)=>{const q=t.project(s,null);return i>1&&i<128*Math.max(.15,cut.entryPortal??.15)&&q.distance>1&&q.distance<q.width-4&&Math.abs(t.heightAt(q.angle,null)-t.heightAt(s.angle,cut.id))<.5;});
  assert.ok(entry,`${cut.id} naturally recognized, connected entry`);
  const m=new DrivingModel(),angle=entry.angle-1/cut.length*(cut.to-cut.from);const before:Point=t.routePoint(angle,0,cut.id);delete before.route;
  t.spawn(m,entry.angle);
  Object.assign(m,entry,{route:undefined,heading:t.heading(t.project(entry,null).angle),speed:kmh/3.6});m.vx=Math.sin(m.heading)*m.speed;m.vz=Math.cos(m.heading)*m.speed;
  const race=new RaceController(t,[{id:'player',name:'p',position:before}]);race.phase='racing';race.player.passed=Math.floor(cut.from/(Math.PI*2)*t.checkpointCount);race.record('player',m,.05);
  assert.equal(m.route,cut.id,`${cut.id} recognized by real race rules`);const start=t.project(m,null).angle;let completed=false,safeSamples=0;
  for(let i=0;i<2400;i++){
   const target=t.routeTarget(m,Math.max(18,m.speed*.65),lane,null),desired=Math.atan2(target.x-m.x,target.z-m.z);
   m.update(1/60,{throttle:m.speed<kmh/3.6?1:0,brake:m.speed>kmh/3.6+.3?1:0,steer:Math.max(-1,Math.min(1,signedAngle(desired-m.heading)*2.7/.67))});
   const main=t.project(m,null),branch=t.project(m,cut.id),f=(branch.angle-cut.from)/(cut.to-cut.from),safe=main.distance<main.width-3&&f<=Math.max(.15,cut.entryPortal??.15)&&Math.abs(t.heightAt(main.angle)-t.heightAt(branch.angle,cut.id))<=1;
   const contact=t.constrain(m);if(safe){safeSamples++;assert.equal(contact,false,`${cut.id} ${kmh}km/h, lane ${lane}: recognized route cannot block legal main water`);}
   race.tick(1/60);race.record('player',m,1/60);
   if(m.route===null&&(t.project(m,null).angle-start)*t.radius>100){completed=true;break;}
  }
  assert.ok(completed,`${cut.id}/${kmh}/${lane} main continuation: ${JSON.stringify({route:m.route,main:t.project(m,null),branch:t.project(m,cut.id),start,speed:m.speed})}`);assert.ok(safeSamples>20,`${cut.id}/${kmh}/${lane}: ${safeSamples} safe main samples`);
 }
});

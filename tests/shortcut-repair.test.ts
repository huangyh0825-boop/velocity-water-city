import{test}from'node:test';import assert from'node:assert/strict';
import{CityTrack}from'../src/track/CityTrack';import{DrivingModel}from'../src/player/DrivingModel';import{FlightController}from'../src/player/FlightController';import{Ramps}from'../src/track/Ramps';import{RaceController}from'../src/race/RaceController';import{canalBanks}from'../src/track/CanalBanks';
import{trackClearance}from'../src/track/TrackClearance';
test('manual shortcut entry survives delayed centre-line separation, all speeds and approach lanes',()=>{
 const t=new CityTrack();for(const cut of t.shortcuts)for(const kmh of[40,100,160])for(const lane of[-3,0,3]){
  const m=new DrivingModel(),f=new FlightController(),ramps=new Ramps(t),start=cut.from-35/t.radius;t.spawn(m,start,lane);m.speed=kmh/3.6;m.vx=Math.sin(m.heading)*m.speed;m.vz=Math.cos(m.heading)*m.speed;ramps.place(m,f);
  const race=new RaceController(t,[{id:'player',name:'p',position:m}]);race.phase='racing';race.player.passed=Math.floor(start/(Math.PI*2)*24);let entered=false,exited=false;
  for(let i=0;i<6000;i++){
   const p=t.routeTarget(m,Math.max(18,m.speed*.65),0,cut.id),desired=Math.atan2(p.x-m.x,p.z-m.z),error=Math.atan2(Math.sin(desired-m.heading),Math.cos(desired-m.heading)),before={...m};
   f.beginStep(1/60);race.tick(1/60);m.update(1/60,{throttle:m.speed<kmh/3.6?1:0,brake:m.speed>kmh/3.6+.3?1:0,steer:Math.max(-1,Math.min(1,error*2.7/.67))});t.constrain(m);ramps.prepare(m,f);ramps.update(before,m,f);race.record('player',m,1/60);
   if(m.route===cut.id)entered=true;if(entered&&m.route===null&&t.project(m,null).angle>cut.to){exited=true;break;}
  }
  assert.equal(m.routeIntent,undefined);assert.ok(entered&&exited,`${cut.id}, ${kmh}, ${lane}`);assert.equal(race.player.passed,Math.floor(cut.to/(Math.PI*2)*24));
 }
});
test('bank mouths contain no collapsed geometry and retain rails at separated heights',()=>{
 const t=new CityTrack(),spans=canalBanks(t);assert.ok(spans.length>1500);
 for(const p of spans){assert.ok(p.length>0&&Number.isFinite(p.pitch));const others=p.route?[null]:t.shortcuts.map(s=>s.id);
  for(const route of others){const q=t.project(p,route);if(Math.abs(t.heightAt(q.angle,route)-p.y)<1.8)assert.ok(q.distance>=q.width+.78,`rail inside ${route??'main'} water`);}
 }
 assert.ok(spans.some(p=>p.route==='harbor-cut'&&p.y>10));
});
test('junction union does not open a distant wall or permit crossing vertical decks',()=>{
 const t=new CityTrack(),m=new DrivingModel(),cut=t.shortcuts[1],a=cut.from+(cut.to-cut.from)*.32;t.spawn(m,a);const p=t.routePoint(a,0,cut.id);Object.assign(m,p,{route:null,y:0});assert.equal(t.constrain(m),true);
 t.spawn(m,.2*Math.PI*2,80);assert.equal(t.constrain(m),true);assert.ok(t.contains(m));
});
test('real deck framing retains its supports without exempting other routes or flight space',()=>{
 const t=new CityTrack(),c=trackClearance(t),cut=t.shortcuts[1],a=cut.from+(cut.to-cut.from)*.3,p=t.routePoint(a,0,cut.id),b={...p,y:p.y!-.85,width:17,height:.65,depth:1.6,heading:t.routeHeading(a,cut.id)};
 assert.ok(c.intersects(b));assert.ok(c.underDeckClear(b,cut.id,p.y!));assert.ok(!c.underDeckClear({...b,y:p.y!+.1},cut.id,p.y!));assert.ok(!c.underDeckClear(b,null,p.y!));
 const flight=c.volumes.find(v=>v.kind==='flight')!,box={x:(flight.ax+flight.bx)/2,z:(flight.az+flight.bz)/2,y:(flight.low+flight.high)/2,width:1,depth:1,height:1};assert.ok(!c.underDeckClear(box,null,box.y+10));
});

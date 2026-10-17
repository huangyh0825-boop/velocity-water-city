import {test} from 'node:test';import assert from 'node:assert/strict';
import {CityTrack} from '../src/track/CityTrack';import {DrivingModel} from '../src/player/DrivingModel';import {FlightController} from '../src/player/FlightController';import {Ramps} from '../src/track/Ramps';import {RaceController} from '../src/race/RaceController';
import{BoatCollisions,hullOverlap}from'../src/physics/BoatCollisions';import{readBest,saveBest}from'../src/race/BestTimes';import{simulateVerticalRace}from'./helpers/vertical-race';
import{AIController}from'../src/ai/AIController';
const tau=Math.PI*2;
function traverse(from:number,to:number,speed:number,route:string|null=null,dt=1/60){
 const track=new CityTrack(),ramps=new Ramps(track),m=new DrivingModel(),f=new FlightController(),cut=track.shortcuts.find(s=>s.id===route),length=cut?.length??track.length;
 let q=from;const angle=()=>cut?cut.from+q*(cut.to-cut.from):q*tau;
 Object.assign(m,track.routePoint(angle(),0,route));ramps.place(m,f);let launches=0,lands=0,peak=0,lastLanding=0,legal=false;
 while(q<to){const before={x:m.x,z:m.z};f.beginStep(dt);q+=speed/length*dt;const p=track.routePoint(angle(),0,route);m.heading=Math.atan2(p.x-m.x,p.z-m.z);m.vx=Math.sin(m.heading)*speed;m.vz=Math.cos(m.heading)*speed;m.speed=speed;m.x=p.x;m.z=p.z;ramps.prepare(m,f);ramps.update(before,m,f);if(f.takeoff){launches++;legal=f.legalLaunch;}if(f.landed){lands++;lastLanding=q;}peak=Math.max(peak,f.height);assert.ok(Number.isFinite(f.height)&&f.height>=-.01);}
 return{launches,lands,peak,lastLanding,legal,f,m};
}
test('16m engineered spillway leaves support ballistically at different speeds and lands on actual water',()=>{
 for(const speed of [8,25,50,60]){const r=traverse(.295,.398,speed);assert.equal(r.launches,speed>12?1:0);assert.equal(r.legal,speed>12);assert.equal(r.lands,1);assert.equal(r.f.height,0);assert.ok(r.peak>=15.8&&r.peak<19);if(speed>=50)assert.ok(r.lastLanding<.384);}
});
test('8m convex crest holds slow boats but releases high speed boats without a ramp trigger',()=>{
 const slow=traverse(.685,.76,8),fast=traverse(.685,.76,50);assert.equal(slow.launches,0);assert.equal(slow.lands,0);assert.equal(fast.launches,1);assert.equal(fast.lands,1);assert.ok(fast.legal);assert.equal(fast.f.height,0);
});
test('high shortcut has a real supported climb, one 14m departure and a finite landing',()=>{const r=traverse(.01,.70,50,'harbor-cut');assert.equal(r.launches,1);assert.equal(r.lands,1);assert.ok(r.peak>=14&&r.peak<17);assert.equal(r.f.height,0);});
test('30/60/120Hz support steps do not miss or duplicate natural takeoffs',()=>{
 for(const hz of [30,60,120])for(const [from,to,route]of [[.295,.398,null],[.685,.76,null],[.01,.70,'harbor-cut']] as const){const r=traverse(from,to,50,route,1/hz);assert.equal(r.launches,1,`${hz} ${route??from} launch`);assert.equal(r.lands,1,`${hz} ${route??from} land`);assert.equal(r.f.height,0);}
});
test('S2 physically flies across the lower main canal and retains branch progress',()=>{
 const t=new CityTrack(),cut=t.shortcuts[1],ramps=new Ramps(t),m=new DrivingModel(),f=new FlightController(),angle=(q:number)=>cut.from+q*(cut.to-cut.from);
 assert.ok(cut.length<(cut.to-cut.from)*t.radius);
 for(const speed of [40,50,60]){Object.assign(m,t.routePoint(angle(.43),0,cut.id));f.reset();ramps.place(m,f);let crossed=false;
  for(let q=.43;q<.57;){const before={x:m.x,z:m.z,route:cut.id};f.beginStep(1/60);q+=speed/cut.length/60;Object.assign(m,t.routePoint(angle(q),0,cut.id));m.heading=t.routeHeading(angle(q),cut.id);m.speed=speed;m.vx=Math.sin(m.heading)*speed;m.vz=Math.cos(m.heading)*speed;ramps.prepare(m,f);ramps.update(before,m,f);const main=t.project(m,null);
   if(q>.47&&q<.54&&main.distance<1){crossed=true;assert.ok(f.airborne&&f.legalLaunch&&f.height>4);assert.equal(m.route,cut.id);assert.ok(main.angle/tau>.74&&main.angle/tau<.76);}
  }assert.ok(crossed);
 }
});
test('a narrow crossing branch cannot hide points inside the main checkpoint aperture',()=>{
 const t=new CityTrack(),gate=18;for(const lane of [-7,0,7]){const a=t.point((gate/24-.0001)*tau,lane),b=t.point((gate/24+.0001)*tau,lane);assert.ok(t.contains({x:b.x,z:b.z}));assert.ok(t.crossesGate(a,b,gate,null));}
});
test('descending flight contacts an elevated deck rather than being forced to world zero',()=>{
 const t=new CityTrack(),r=new Ramps(t),m=new DrivingModel(),f=new FlightController();Object.assign(m,t.point(.335*tau));f.managedSurface=true;f.height=13;f.verticalSpeed=-6;f.airborne=true;
 for(let i=0;i<20&&f.airborne;i++){f.beginStep(1/60);r.update(m,m,f);}assert.ok(f.landed);assert.equal(f.height,12);assert.equal(m.y,12);
});
test('gate height rejects flying far above its aperture and an unentered branch cannot credit a sector',()=>{
 const t=new CityTrack(),gate=8,a=t.point((gate/24-.0001)*tau),b=t.point((gate/24+.0001)*tau);assert.ok(t.crossesGate(a,b,gate));assert.ok(!t.crossesGate({...a,y:80},{...b,y:80},gate));
 const cut=t.shortcuts[0],index=13,pa=t.routePoint((index/24-.0001)*tau,0,cut.id),pb=t.routePoint((index/24+.0001)*tau,0,cut.id),race=new RaceController(t,[{id:'player',name:'p',position:pa}]);race.phase='racing';race.player.passed=index-1;race.record('player',pb,1/60);assert.equal(race.player.passed,index-1);assert.equal(race.player.route,null);
});
test('elevated side contacts separate hulls but a lower boat cannot hit the high deck rider',()=>{
 const t=new CityTrack(),a=new DrivingModel(),b=new DrivingModel();t.spawn(a,.335*tau);t.spawn(b,.335*tau,.4);const c=new BoatCollisions(),bodies=[{id:'a',model:a,height:12},{id:'b',model:b,height:0}];c.capture(bodies);c.resolve(bodies,1/60);assert.equal(c.lastContacts,0);bodies[1].height=12;c.capture(bodies);c.resolve(bodies,1/60,m=>t.constrain(m));assert.ok(c.lastContacts>0);assert.ok(hullOverlap(a,b)<.008);
 const f=new FlightController();f.height=f.previousHeight=14;f.verticalSpeed=3.5;f.airborne=true;new Ramps(t).update(a,a,f);assert.equal(f.verticalSpeed,3.5);assert.ok(f.airborne);
});
test('best times are isolated by layout version and unavailable storage cannot break settlement',()=>{
 const values=new Map<string,string>(),store={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 assert.equal(saveBest('old-layout',300,store),300);assert.equal(readBest('vertical-v2',store),null);assert.equal(saveBest('vertical-v2',350,store),350);assert.equal(saveBest('vertical-v2',370,store),350);assert.equal(saveBest('vertical-v2',340,store),340);assert.equal(readBest('old-layout',store),300);assert.equal(saveBest('vertical-v2',NaN,store),340);
 assert.doesNotThrow(()=>saveBest('denied',300,{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}));
});
test('collision correction across the real spillway edge preserves natural takeoff momentum',()=>{
 const t=new CityTrack(),r=new Ramps(t),lip=t.point(.354*tau),h=t.heading(.354*tau),at=(along:number)=>({x:lip.x+Math.sin(h)*along,z:lip.z+Math.cos(h)*along}),a=new DrivingModel(),b=new DrivingModel(),f=new FlightController();
 Object.assign(a,at(-.5),{heading:h,speed:24,vx:Math.sin(h)*24,vz:Math.cos(h)*24});Object.assign(b,at(-3.8),{heading:h,speed:24,vx:Math.sin(h)*24,vz:Math.cos(h)*24});r.place(a,f);f.verticalSpeed=t.surface(a).slope*24;f.beginStep(1/60);
 const c=new BoatCollisions(),bodies=[{id:'player',model:a,height:f.height},{id:'ai',model:b,height:t.surface(b).height}];c.capture(bodies);const before={x:a.x,z:a.z};Object.assign(a,at(-.1));Object.assign(b,at(-3.4));r.prepare(a,f);bodies[0].height=f.height;c.resolve(bodies,1/60,m=>t.constrain(m));assert.ok(c.hasContact('player'));r.update(before,a,f,'player',c.sweptPath('player'),c.movementAllowance('player'));assert.ok(f.airborne&&f.legalLaunch&&f.verticalSpeed>0&&f.height>15);assert.equal(t.surface(a).height,0);
});
test('two actual AI collide on the 12m deck and continue through its departure without height overwrite',()=>{
 const t=new CityTrack(),r=new Ramps(t),ai=[new AIController('ai-1','a',48,0,t,.335*tau),new AIController('ai-2','b',47,.4,t,.335*tau)],c=new BoatCollisions();ai.forEach(a=>{a.setRamps(r);a.model.speed=35;a.model.vx=Math.sin(a.model.heading)*35;a.model.vz=Math.cos(a.model.heading)*35;});const bodies=ai.map(a=>({id:a.id,model:a.model,height:a.flight.height}));let highContacts=0,departures=0;
 for(let i=0;i<240;i++){c.capture(bodies);ai.forEach((a,j)=>{a.update(1/60,bodies);t.constrain(a.model);bodies[j].height=a.flight.height;});c.resolve(bodies,1/60,m=>t.constrain(m));if(c.lastContacts&&bodies.every(b=>b.height>10))highContacts++;ai.forEach((a,j)=>{a.finishStep(c.sweptPath(a.id),c.movementAllowance(a.id));a.updateActions(1/60,!c.hasContact(a.id));if(c.hasContact(a.id))a.onContact();bodies[j].height=a.flight.height;if(a.flight.takeoff)departures++;assert.ok(Number.isFinite(a.flight.height)&&a.flight.height>=0);});}
 assert.ok(highContacts>0);assert.ok(departures>=2);
});
test('player and four solid AI complete three laps including both legal branches, tricks and finite nitro',()=>{
 const r=simulateVerticalRace();assert.deepEqual(r.passed,[72,72,72,72,72],JSON.stringify(r));assert.equal(r.phase,'finished');assert.ok(r.routes.includes('player:tunnel-cut')&&r.routes.includes('player:harbor-cut'),JSON.stringify(r));assert.ok(r.jumps['player:D1']>=1&&r.jumps['player:D2']>=1&&r.jumps['player:S2J']>=1);assert.ok(r.peaks.every(h=>h>=16&&h<35));assert.ok(r.energy.every(e=>e>=0&&e<=100));assert.ok(r.rewards.player>0);assert.equal(r.jumps["ai-4:D2"],3,"landing on a descending canal must not create another jump");
});



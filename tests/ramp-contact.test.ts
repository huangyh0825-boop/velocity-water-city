import {test} from 'node:test';import assert from 'node:assert/strict';
import {Track} from '../src/track/Track';import {Ramps,RAMP_ANGLES} from '../src/track/Ramps';import {FlightController} from '../src/player/FlightController';import {DrivingModel} from '../src/player/DrivingModel';import {BoatCollisions} from '../src/physics/BoatCollisions';
const track=new Track(),angle=RAMP_ANGLES[0],lip=track.point(angle);
const point=(s:number,r:number)=>({x:lip.x-Math.sin(angle)*s+Math.cos(angle)*r,z:lip.z+Math.cos(angle)*s+Math.sin(angle)*r});
function model(s:number,r=0,speed=50){const m=new DrivingModel();Object.assign(m,point(s,r),{heading:-angle,speed,vx:-Math.sin(angle)*speed,vz:Math.cos(angle)*speed});return m;}
test('lip sweep checks hull support at the crossing, not just the final center',()=>{const ramps=new Ramps(track),m=model(.2,4.35),f=new FlightController();ramps.update(point(-.2,4),m,f);assert.ok(f.takeoff&&f.legalLaunch);assert.equal(ramps.decisions.get('player')!.reason,'launched');});
test('collision correction crossing the lip is included in the actual swept path',()=>{
 const ramps=new Ramps(track),m=model(-.5,0,24),ai=model(-3.8,0,24),f=new FlightController(),c=new BoatCollisions();const bodies=[{id:'player',model:m,height:ramps.surfaceHeight(m)},{id:'ai',model:ai,height:ramps.surfaceHeight(ai)}];
 c.capture(bodies);const before={x:m.x,z:m.z};Object.assign(m,point(-.1,0));Object.assign(ai,point(-3.4,0));ramps.prepare(m,f);bodies[0].height=f.height;bodies[1].height=ramps.surfaceHeight(ai);c.resolve(bodies,1/60);assert.ok(c.hasContact('player'));
 ramps.update(before,m,f,'player',c.sweptPath('player'),c.movementAllowance('player'));assert.ok(f.takeoff);assert.ok(f.verticalSpeed>0);assert.ok(c.movementAllowance('player')>0);
 f.beginStep(1/60);const vy=f.verticalSpeed;ramps.prepare(m,f);ramps.update(m,m,f);assert.equal(f.verticalSpeed,vy);assert.ok(f.airborne);
});
test('side graze, reverse, low speed and transverse heading do not qualify for launch',()=>{
 for(const [radial,speed,heading] of [[5.5,50,-angle],[0,1,-angle],[0,50,-angle+Math.PI/2]]){const ramps=new Ramps(track),f=new FlightController(),m=model(.2,radial,speed);m.heading=heading;ramps.update(point(-.2,radial),m,f);assert.ok(!f.legalLaunch);}
 const ramps=new Ramps(track),f=new FlightController(),m=model(-.2);ramps.update(point(.2,0),m,f);assert.ok(!f.takeoff);
});
test('a boat pushed off the slope falls ballistically instead of snapping to water',()=>{const ramps=new Ramps(track),f=new FlightController(),m=model(-6);ramps.update(point(-7,0),m,f);assert.ok(f.height>.8);Object.assign(m,point(-5,7));ramps.update(point(-6,0),m,f);assert.ok(f.airborne&&!f.legalLaunch);assert.ok(f.height>.8);while(f.airborne)f.beginStep(1/60);assert.equal(f.height,0);assert.equal(f.state,'landing');});
test('physical side collision can remove actual ramp support without awarding a legal jump',()=>{
 const ramps=new Ramps(track),f=new FlightController(),m=model(-6,4.7,45),other=model(-6,3.9,45),c=new BoatCollisions();
 const bodies=[{id:'player',model:m,height:ramps.surfaceHeight(m)},{id:'ai',model:other,height:ramps.surfaceHeight(other)}];
 ramps.prepare(m,f);assert.ok(f.height>.8);c.capture(bodies);const before={x:m.x,z:m.z};
 m.x+=m.vx/60;m.z+=m.vz/60;other.x+=other.vx/60;other.z+=other.vz/60;c.resolve(bodies,1/60);
 ramps.update(before,m,f,'player',c.sweptPath('player'),c.movementAllowance('player'));
 assert.ok(c.hasContact('player')&&f.airborne&&!f.legalLaunch&&!f.takeoff);assert.equal(ramps.decisions.get('player')!.reason,'lost-ramp-support');assert.ok(f.height>.8);
});
test('same ramp is locked after landing and rearms away from it on the next lap',()=>{const ramps=new Ramps(track),f=new FlightController(),m=model(.2);ramps.update(point(-.2,0),m,f);while(f.airborne)f.beginStep(1/60);for(let i=0;i<60;i++)f.beginStep(1/60);ramps.update(point(-.2,0),m,f);assert.ok(!f.takeoff);assert.equal(ramps.decisions.get('player')!.reason,'ramp-locked');Object.assign(m,point(40,0));ramps.update(m,m,f);while(f.airborne)f.beginStep(1/60);for(let i=0;i<60;i++)f.beginStep(1/60);Object.assign(m,point(.2,0));ramps.update(point(-.2,0),m,f);assert.ok(f.takeoff);});
test('crossing a lip at high speed has no arbitrary two-metre rejection',()=>{const ramps=new Ramps(track),f=new FlightController(),m=model(4,0,60);ramps.update(point(-4,0),m,f);assert.ok(f.takeoff);});
test('a boat stopped above the ramp lands on its real surface, only on descent, without relaunching',()=>{
 const ramps=new Ramps(track),f=new FlightController(),m=model(.2,0,24);ramps.update(point(-.2,0),m,f);assert.ok(f.takeoff);
 let landed=0,jumps=1;
 for(let i=0;i<180;i++){
   f.beginStep(1/60);ramps.update(m,m,f);
   if(f.takeoff)jumps++;if(f.landed){landed++;assert.equal(f.height,2);assert.equal(f.verticalSpeed,0);}
   assert.ok(f.height>=2); // No horizontal motion after a collision stops the boat above the lip.
 }
 assert.equal(landed,1);assert.equal(jumps,1);assert.equal(f.airborne,false);
});
test('30/60/120 render schedules with fixed 60Hz simulation have identical jump counts',()=>{
 const run=(fps:number)=>{const ramps=new Ramps(track),f=new FlightController(),m=model(-15,0,50);let accumulator=0,jumps=0;for(let frame=0;frame<fps*4;frame++){accumulator+=1/fps;while(accumulator>=1/60-1e-10){const before={x:m.x,z:m.z};f.beginStep(1/60);m.x+=m.vx/60;m.z+=m.vz/60;ramps.update(before,m,f);if(f.takeoff)jumps++;accumulator-=1/60;}}return{jumps,height:f.height,state:f.state};};
 assert.deepEqual(run(30),run(60));assert.deepEqual(run(60),run(120));assert.equal(run(60).jumps,1);
});


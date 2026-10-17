import{test}from'node:test';import assert from'node:assert/strict';import{driveShortcut}from'./helpers/shortcut-drive';
import{CityTrack}from'../src/track/CityTrack';import{TrackClearance}from'../src/track/TrackClearance';import{driveJump,driveAIJump}from'./helpers/jump-drive';
import{AIController}from'../src/ai/AIController';import{DrivingModel}from'../src/player/DrivingModel';import{BoatCollisions,hullOverlap}from'../src/physics/BoatCollisions';import{signedAngle}from'../src/track/Track';
import{Ramps}from'../src/track/Ramps';import{NATURAL_JUMPS}from'../src/track/Elevation';
test('S1 exit accepts real player driving at 120/140/160kmh without wall assistance',()=>{
 for(const speed of [120,140,160]){const r=driveShortcut(speed);assert.ok(r.finished);assert.equal(r.walls,0);assert.ok(r.minKmh>speed-1);}
});
test('nitro approach can brake normally before the S1 exit without stopping or hitting walls',()=>{const r=driveShortcut(216,true);assert.ok(r.finished);assert.equal(r.walls,0);assert.ok(r.brakeSteps>0&&r.brakeSteps<120);assert.ok(r.minKmh>150);});
test('3D clearance covers branch metadata, full rotated buildings, flight space and safe overhead structures',()=>{
 const t=new CityTrack(),c=new TrackClearance(t);assert.ok(c.intersects({x:764.25,y:7.5,z:-546.36,width:35,height:15,depth:24,heading:t.heading(.6708333333*Math.PI*2)}));
 const p=t.point(.36*Math.PI*2);assert.ok(c.conflicts({x:p.x,y:14,z:p.z,width:2,height:2,depth:2}).some(v=>v.kind==='flight'));assert.ok(!c.intersects({x:p.x,y:60,z:p.z,width:2,height:2,depth:2}));
 const branch=t.routePoint(t.shortcuts[1].from+.30*(t.shortcuts[1].to-t.shortcuts[1].from),0,'harbor-cut');assert.ok(c.intersects({x:branch.x,y:branch.y!+2,z:branch.z,width:3,height:3,depth:3}));
});
test('each new jump is playable using actual player inputs and has a distinct flight duration',()=>{
 const a=driveJump('N1',120),b=driveJump('N2',160),c=driveJump('N3',180),d=driveJump('port-drop-10',180);for(const r of [a,b,c,d]){assert.equal(r.launches,1);assert.ok(r.landed);assert.equal(r.walls,0);assert.ok(r.trace.every(p=>Number.isFinite(p.y)));}assert.ok(a.airtime<b.airtime&&b.airtime<c.airtime);assert.ok(c.reward>0&&d.reward>0);
});
test('all ten opportunities are usable by the AI with shared physical flight and actual landings',()=>{const ids=[...new Ramps(new CityTrack()).data.map(r=>r.id),...NATURAL_JUMPS.map(j=>j.id)];assert.equal(ids.length,10);for(const id of ids){const r=driveAIJump(id);assert.equal(r.launches,1,id);assert.ok(r.landed,id);assert.equal(r.walls,0,id);if(id!=='crest-8')assert.ok(r.trick,id);}});
test('major terrain trajectories stay finite at 120/140/160/180kmh and nitro speed',()=>{
 for(const id of ['drop-16','port-drop-10','sky-cut-jump'])for(const kmh of [120,140,160,180]){const r=driveJump(id,kmh);assert.equal(r.launches,1);assert.ok(r.landed);assert.equal(r.walls,0);assert.ok(r.reward>0);}
 for(const kmh of [120,140])assert.equal(driveJump('crest-8',kmh).launches,0);for(const kmh of [160,180])assert.equal(driveJump('crest-8',kmh).launches,1);
 for(const id of ['drop-16','port-drop-10','sky-cut-jump']){const r=driveJump(id,180,true);assert.ok(r.landed&&r.launchSpeed>210&&r.walls===0);}
});
test('player and two solid AI can merge from S1 and main without overlap or deadlock',()=>{
 const t=new CityTrack(),cut=t.shortcuts[0],player=new DrivingModel(),at=cut.from+(cut.to-cut.from)*.86;t.spawn(player,at);Object.assign(player,t.routePoint(at,-1.5,cut.id));player.heading=t.routeHeading(at,cut.id);
 const ai=[new AIController('ai-1','branch',140/3.6,0,t,at),new AIController('ai-2','main',140/3.6,0,t,cut.to-65/t.radius)];Object.assign(ai[0].model,t.routePoint(at,1.5,cut.id));ai[0].model.heading=t.routeHeading(at,cut.id);ai[0].route=cut.id;
 for(const m of [player,...ai.map(a=>a.model)]){m.speed=30;m.vx=Math.sin(m.heading)*30;m.vz=Math.cos(m.heading)*30;}
 const bodies=[{id:'player',model:player,height:0},...ai.map(a=>({id:a.id,model:a.model,height:0}))],c=new BoatCollisions(),done=new Set<string>();let contacts=0;
 for(let i=0;i<1500&&done.size<3;i++){c.capture(bodies);const before={x:player.x,z:player.z,route:player.route},p=t.routeTarget(player,Math.max(18,player.speed*.65),0,player.route??null),e=signedAngle(Math.atan2(p.x-player.x,p.z-player.z)-player.heading);player.routeIntent=player.route;
  player.update(1/60,{throttle:player.speed<140/3.6?1:0,brake:0,steer:Math.max(-1,Math.min(1,e*2.7/.67))});player.route=t.raceRoute(before,player,player.route??null);t.constrain(player);ai.forEach(a=>{a.update(1/60,bodies);t.constrain(a.model);});c.resolve(bodies,1/60,m=>t.constrain(m));contacts+=c.lastContacts;
  for(let a=0;a<bodies.length;a++){const b=bodies[a];for(let j=a+1;j<bodies.length;j++)assert.ok(hullOverlap(b.model,bodies[j].model)<.012);if(b.model.route===null&&t.project(b.model,null).angle>cut.to+65/t.radius)done.add(b.id);}
 }assert.equal(done.size,3);assert.ok(contacts>0);
});

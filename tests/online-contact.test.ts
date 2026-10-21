import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulateContact} from './helpers/online-contact';
import {ONLINE_RACER_COLORS,onlineRacerColor} from '../src/gameplay/RacerColors';
import {RoomRace} from '../server/RoomRace';
import {isOnlineFrame} from '../src/lobby/racing';
import {NetworkRaceSession,onlinePeers} from '../src/gameplay/NetworkRaceSession';
import {CityTrack} from '../src/track/CityTrack';
import {DrivingModel} from '../src/player/DrivingModel';
import {FlightController} from '../src/player/FlightController';
import {TrickController} from '../src/player/TrickController';
import {NitroController} from '../src/player/NitroController';
import {Ramps} from '../src/track/Ramps';
import {BoatCollisions} from '../src/physics/BoatCollisions';
import type {LobbyClient} from '../src/lobby/LobbyClient';
for(const delay of [0,50,100,250])test(`sustained rear contact at ${delay*2}ms RTT uses local hull response without network pullbacks`,()=>{
 const r=simulateContact(delay);assert.deepEqual(r.errors,[]);assert.ok(r.contacts>30);assert.ok(r.maxOverlap<.18,JSON.stringify(r));assert.ok(r.maxCorrection<.5,JSON.stringify(r));assert.ok(r.correctionCount<10,JSON.stringify(r));
});
test('players can steer away after sustained contact instead of being held by old server poses',()=>{
 const r=simulateContact(100,true);assert.deepEqual(r.errors,[]);assert.ok(r.finalDistance>10,JSON.stringify(r));assert.ok(r.finalSpeed>8,JSON.stringify(r));
});
for(const scenario of ['moving-rear','head-on','side']as const)test(`${scenario} contact keeps steering and avoids repeated server position jumps`,()=>{
 const r=simulateContact(100,false,scenario);assert.deepEqual(r.errors,[]);assert.ok(r.contacts>0);assert.ok(r.maxCorrection<.5,JSON.stringify(r));assert.ok(r.correctionCount<10,JSON.stringify(r));assert.ok(r.maxOverlap<.6,JSON.stringify(r));
});
test('late collision corrections retain unacknowledged movement, steering, flight and tricks; recovery still resets',()=>{
 const ids=['a'.repeat(24),'b'.repeat(24)],server=new RoomRace(ids.map(id=>({id,playerId:id})),0);server.loaded(ids[0],0);server.loaded(ids[1],0);
 let clock=8000;const listeners=new Set<()=>void>(),poses:any[]=[],lobby={connection:{room:{race:server.view},memberId:ids[0],status:'connected'},frame:server.frame(clock),now:()=>clock,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},raceCommand:async()=>{},sendRaceState:(_id:string,p:any)=>poses.push(p)};
 const track=new CityTrack(),player=new DrivingModel(),flight=new FlightController(),tricks=new TrickController(),nitro=new NitroController(),ramps=new Ramps(track),state={track,player,flight,tricks,nitro,ramps,ai:[],bodies:[{id:'player',model:player}],collisions:new BoatCollisions()};
 const options={lobby:lobby as unknown as LobbyClient,race:server.view,memberId:ids[0]},session=new NetworkRaceSession(state,onlinePeers(track,options),options);
 for(let i=0;i<60;i++){clock+=1000/60;session.step(1/60,{throttle:1,steer:.5,brake:0,boost:false,trick:false});}
 const reference=poses[2],before={x:player.x,z:player.z,heading:player.heading};assert.ok(Math.hypot(before.x-reference.x,before.z-reference.z)>1);
 flight.airborne=true;flight.height=4;flight.verticalSpeed=6;const generation=flight.generation;tricks.kind='spin';tricks.progress=.4;
 const corrected={...server.frame(clock).states[0],...reference,x:reference.x-.2,z:reference.z-.3,vx:reference.vx-1,speed:reference.speed-1,correction:1,correctionKind:'collision' as const};
 lobby.frame={...server.frame(clock),states:[corrected,server.frame(clock).states[1]]};for(const fn of listeners)fn();
 assert.ok(Math.abs(player.x-(before.x-.2))<1e-8);assert.ok(Math.abs(player.z-(before.z-.3))<1e-8);assert.equal(player.heading,before.heading);assert.equal(flight.generation,generation);assert.equal(flight.height,4);assert.equal(tricks.progress,.4);
 const visual=Object.assign(new DrivingModel(),player);session.applyVisualOffset(visual);assert.ok(Math.abs(visual.x-before.x)<1e-8);
 lobby.frame={...lobby.frame,states:[{...corrected,x:corrected.x-.1,correction:2},lobby.frame.states[1]]};for(const fn of listeners)fn();assert.ok(Math.abs(player.x-(before.x-.3))<1e-8,'same acknowledged sample receives only the incremental correction');
 lobby.frame={...lobby.frame,states:[{...corrected,x:100,z:100,y:0,airborne:false,correction:3,correctionKind:'reset'},lobby.frame.states[1]]};for(const fn of listeners)fn();assert.equal(player.x,100);assert.equal(player.z,100);assert.ok(flight.generation>generation);assert.equal(tricks.progress,0);
 lobby.frame={...lobby.frame,states:[lobby.frame.states[0],{...lobby.frame.states[1],x:100,z:100,y:8,airborne:true}]};for(const fn of listeners)fn();clock+=1000/60;session.step(1/60,{throttle:1,brake:0,steer:0,boost:false,trick:false});assert.equal(state.collisions.hasContact('player'),false,'an elevated peer does not block the water below');session.dispose();
});
test('all viewpoints assign the same five distinct paint colors to the same race slots, including reconnect order',()=>{
 const roster=Array.from({length:5},(_,i)=>({id:String(i).repeat(24),playerId:'玩家'+i})),r=new RoomRace(roster,1000);
 assert.equal(new Set(ONLINE_RACER_COLORS).size,5);
 for(const viewer of roster){const order=[viewer,...roster.filter(p=>p!==viewer).reverse()];assert.deepEqual(order.map(p=>onlineRacerColor(r.view,p.id)),order.map(p=>ONLINE_RACER_COLORS[roster.indexOf(p)]));}
 r.resume(roster[1].id,2000);assert.equal(onlineRacerColor(r.view,roster[1].id),'#f6cc61');assert.equal(onlineRacerColor(r.view,roster[0].id),'#126bba');
 assert.throws(()=>onlineRacerColor(r.view,'unknown'),/名单/);
});
test('correction reason metadata remains optional for older servers and rejects invalid variants',()=>{
 const r=new RoomRace([{id:'a'.repeat(24),playerId:'A'},{id:'b'.repeat(24),playerId:'B'}],0),frame=r.frame(0);assert.ok(isOnlineFrame(frame));
 delete frame.states[0].correctionKind;assert.ok(isOnlineFrame(frame));(frame.states[0] as any).correctionKind='teleport-anywhere';assert.equal(isOnlineFrame(frame),false);
});

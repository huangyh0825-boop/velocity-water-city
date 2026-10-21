import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RoomRace} from '../server/RoomRace';
import {CityTrack} from '../src/track/CityTrack';
import {isOnlineFrame,isOnlineRace} from '../src/lobby/racing';
import {NetworkRaceSession,onlinePeers} from '../src/gameplay/NetworkRaceSession';
import {DrivingModel} from '../src/player/DrivingModel';
import {FlightController} from '../src/player/FlightController';
import {TrickController} from '../src/player/TrickController';
import {NitroController} from '../src/player/NitroController';
import {Ramps} from '../src/track/Ramps';
import {BoatCollisions} from '../src/physics/BoatCollisions';
import type {LobbyClient} from '../src/lobby/LobbyClient';
const ids=['a'.repeat(24),'b'.repeat(24)];
const room=()=>new RoomRace(ids.map((id,i)=>({id,playerId:'玩家'+i})),1000);
test('loading barrier waits for everyone, then permits exactly five seconds of countdown',()=>{
 const r=room();assert.ok(isOnlineRace(r.view));assert.ok(isOnlineFrame(r.frame(1000)));
 r.loaded(ids[0],2000);r.tick(90000);assert.equal(r.view.phase,'loading');
 r.loaded(ids[1],90000);assert.equal(r.view.phase,'countdown');assert.equal(r.view.startAt!-r.view.countdownAt!,5000);
 r.tick(r.view.startAt!-1);assert.equal(r.view.phase,'countdown');r.tick(r.view.startAt!);assert.equal(r.view.phase,'racing');
});
test('a countdown disconnect cancels GO until that player reconnects and reloads; leaving/loading failure aborts',()=>{
 const r=room();r.loaded(ids[0],1000);r.loaded(ids[1],1000);r.connected(ids[1],false,4000);
 assert.equal(r.view.phase,'loading');assert.equal(r.view.startAt,null);r.tick(20000);assert.equal(r.view.phase,'loading');
 r.resume(ids[1],20000);assert.equal(r.view.phase,'loading');r.loaded(ids[1],21000);assert.equal(r.view.startAt,28000);
 r.leave(ids[1]);assert.equal(r.view.phase,'aborted');
 const failed=room();failed.abort('加载失败');failed.loaded.bind(failed);assert.equal(failed.view.phase,'aborted');
 const timeout=room();timeout.tick(601001);assert.equal(timeout.view.phase,'aborted');
});
test('server rejects fabricated motion/time, ignores stale sequences, and recovers without checkpoint credit',()=>{
 const r=room();r.loaded(ids[0],1000);r.loaded(ids[1],1000);r.tick(8000);
 const initial=r.frame(8000).states[0];assert.throws(()=>r.accept(ids[0],{...initial,seq:1,t:100},8100),/时间/);
 r.accept(ids[0],{...initial,seq:2,t:.1,x:initial.x+200},8100);assert.equal(r.players.get(ids[0])!.correction,1);assert.equal(r.rules.player.passed,0);
 r.accept(ids[0],{...initial,seq:3,t:.2,x:initial.x+1,correction:0},8200);r.tick(8200);assert.ok(Math.abs(r.players.get(ids[0])!.model.x-initial.x)<.001);
 r.recover(ids[0],8300);assert.equal(r.rules.player.passed,0);assert.equal(r.players.get(ids[0])!.correction,2);
});
test('network samples complete three ordered laps using shared track rules and finalize remaining DNF racers',()=>{
 const r=room(),t=new CityTrack();r.loaded(ids[0],1000);r.loaded(ids[1],1000);const start=r.view.startAt!;r.tick(start);r.leave(ids[1]);
 let angle=-.014,elapsed=0,seq=0;
 for(let i=0;i<4000&&r.active;i++){
  angle+=40*.2/t.radius;elapsed+=.2;const position=t.point(angle,-7),p=r.players.get(ids[0])!;
  r.accept(ids[0],{...r.frame(start+elapsed*1000).states[0],...position,seq:++seq,t:elapsed,heading:t.heading(angle),speed:40,correction:p.correction},start+elapsed*1000);r.tick(start+elapsed*1000);
 }
 assert.equal(r.rules.player.passed,72);assert.equal(r.view.phase,'finished');assert.ok(r.rules.player.finishTime!>300);assert.equal(r.frame(start+elapsed*1000).states[1].dnf,true);
});
test('server resolves real hull contact and issues correction tokens to both colliding players',()=>{
 const r=room(),t=new CityTrack();r.loaded(ids[0],1000);r.loaded(ids[1],1000);const now=r.view.startAt!+1000;
 const point=t.point(-.014,0);for(const [i,id]of ids.entries())r.accept(id,{...r.players.get(id)!.pose,...point,x:point.x+i*.1,seq:1,t:1,heading:t.heading(-.014)},now);
 r.tick(now);const states=r.frame(now).states;assert.ok(states.every(p=>p.correction>0));assert.ok(Math.hypot(states[0].x-states[1].x,states[0].z-states[1].z)>1);
});
test('online session keeps the existing driving frozen until all loaded and GO, samples at ten Hz and honors authoritative correction',async()=>{
 const server=room();let clock=2000;const listeners=new Set<()=>void>(),sent:any[]=[];
 const lobby={connection:{room:{race:server.view},memberId:ids[0],status:'connected'},frame:server.frame(clock),error:'',now:()=>clock,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},raceCommand:async(type:string)=>{if(type==='race.loaded')server.loaded(ids[0],clock);},sendRaceState:(_id:string,p:any)=>sent.push(p)};
 const track=new CityTrack(),player=new DrivingModel(),flight=new FlightController(),tricks=new TrickController(),nitro=new NitroController(),ramps=new Ramps(track);
 const options={lobby:lobby as unknown as LobbyClient,race:server.view,memberId:ids[0]},peers=onlinePeers(track,options);
 const session=new NetworkRaceSession({track,player,flight,tricks,nitro,ramps,ai:[],bodies:[{id:'player',model:player}],collisions:new BoatCollisions()},peers,options);
 const command={throttle:1,brake:0,steer:0,boost:false,trick:false},x=player.x,z=player.z;
 session.markLoaded();await Promise.resolve();for(let i=0;i<600;i++)session.step(1/60,command);assert.equal(player.x,x);assert.equal(player.z,z);assert.equal(sent.length,0);
 server.loaded(ids[1],clock);clock=server.view.startAt!-1;session.step(1/60,command);assert.equal(player.speed,0);
 clock++;session.step(1/60,command);assert.equal(session.race.phase,'racing');for(let i=0;i<60;i++){clock+=1000/60;session.step(1/60,command);}assert.ok(player.speed>0);assert.ok(sent.length>=9&&sent.length<=11);
 const f=server.frame(clock);f.states[0].correction++;f.states[0].x=x+4;lobby.frame=f;for(const fn of listeners)fn();assert.equal(player.x,x+4);assert.equal(session.consumeCorrection(),true);
 session.dispose();assert.equal(listeners.size,0);
});

import {RoomRace} from '../../server/RoomRace';
import {CityTrack} from '../../src/track/CityTrack';
import {NetworkRaceSession,onlinePeers} from '../../src/gameplay/NetworkRaceSession';
import {DrivingModel} from '../../src/player/DrivingModel';
import {FlightController} from '../../src/player/FlightController';
import {TrickController} from '../../src/player/TrickController';
import {NitroController} from '../../src/player/NitroController';
import {Ramps} from '../../src/track/Ramps';
import {BoatCollisions,hullOverlap} from '../../src/physics/BoatCollisions';
import type {LobbyClient} from '../../src/lobby/LobbyClient';
export function simulateContact(delay=100,escape=false,scenario:'rear'|'moving-rear'|'head-on'|'side'='rear'){
 const ids=['a'.repeat(24),'b'.repeat(24)],track=new CityTrack(),server=new RoomRace(ids.map((id,i)=>({id,playerId:'Test'+i})),0);
 for(const [i,id]of ids.entries()){const p=server.players.get(id)!;track.spawn(p.model,scenario==='side'?-.014:-.014-i*.008,scenario==='side'?(i?1:-1)*.6:0);if(scenario==='head-on'&&!i)p.model.heading+=Math.PI;p.pose={...p.pose,...p.model};server.rules.syncPosition(id,p.model);}
 server.loaded(ids[0],0);server.loaded(ids[1],0);let clock=0;const queue:{at:number;run:()=>void}[]=[];
 const delayed=(run:()=>void)=>queue.push({at:clock+delay,run});
 const errors:string[]=[],moves:number[]=[],overlaps:number[]=[];
 const clients=ids.map(id=>{
  const listeners=new Set<()=>void>(),lobby={connection:{room:{race:structuredClone(server.view)},memberId:id,status:'connected'},frame:server.frame(clock),error:'',now:()=>clock,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},raceCommand:async()=>{},sendRaceState:(_id:string,p:any)=>{delayed(()=>{try{server.accept(id,p,clock);}catch(e){errors.push((e as Error).message);}});}};
  const player=new DrivingModel(),flight=new FlightController(),nitro=new NitroController(),tricks=new TrickController(),ramps=new Ramps(track),state={track,player,flight,nitro,tricks,ramps,ai:[],bodies:[{id:'player',model:player}],collisions:new BoatCollisions()};
  const options={lobby:lobby as unknown as LobbyClient,race:structuredClone(server.view),memberId:id},peers=onlinePeers(track,options),session=new NetworkRaceSession(state,peers,options);return{session,lobby,listeners,state};
 });
 let contacts=0;const speeds:number[]=[];
 for(let step=0;step<60*22;step++){
  clock=step*1000/60;
  for(let i=0;i<queue.length;){if(queue[i].at<=clock){const job=queue.splice(i,1)[0];job.run();}else i++;}
  clients.forEach((c,i)=>{c.session.step(1/60,{throttle:i||scenario==='head-on'||scenario==='side'?1:scenario==='moving-rear'?.45:0,brake:0,steer:escape&&i&&clock>14000?.7:0,boost:false,trick:false});if(c.state.collisions.hasContact('player'))contacts++;});
  if(step%12===0){server.tick(clock);const frame=server.frame(clock),race=structuredClone(server.view);clients.forEach(c=>delayed(()=>{const x=c.state.player.x,z=c.state.player.z;c.lobby.frame=structuredClone(frame);c.lobby.connection.room.race=structuredClone(race);for(const f of c.listeners)f();const move=Math.hypot(c.state.player.x-x,c.state.player.z-z);if(move>.001&&clock>8000)moves.push(move);}));}
  if(clock>=8000){overlaps.push(hullOverlap(clients[0].state.player,clients[1].state.player));speeds.push(clients[1].state.player.speed);}
 }
 const result={maxCorrection:Math.max(0,...moves),correctionCount:moves.length,totalCorrection:moves.reduce((a,b)=>a+b,0),maxOverlap:Math.max(...overlaps),contacts,finalDistance:Math.hypot(clients[0].state.player.x-clients[1].state.player.x,clients[0].state.player.z-clients[1].state.player.z),finalSpeed:clients[1].state.player.speed,errors};
 clients.forEach(c=>c.session.dispose());return result;
}

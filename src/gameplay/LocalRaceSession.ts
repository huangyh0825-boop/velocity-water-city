import type{CityTrack}from'../track/CityTrack';
import type{DrivingModel}from'../player/DrivingModel';
import type{FlightController}from'../player/FlightController';
import type{TrickController}from'../player/TrickController';
import type{NitroController}from'../player/NitroController';
import type{AIController}from'../ai/AIController';
import type{Ramps}from'../track/Ramps';
import{BoatCollisions,type BoatBody}from'../physics/BoatCollisions';
import{RaceController}from'../race/RaceController';
import{cityEntrants}from'../ai/CityOpponents';
import type{TrainingOptions,TrainingRun}from'../modes/TrainingOptions';
import type{PlayerCommand}from'./PlayerCommand';
import type{RaceSession}from'./RaceSession';
export interface LocalRaceState {
 track:CityTrack;player:DrivingModel;flight:FlightController;tricks:TrickController;nitro:NitroController;
 ai:AIController[];ramps:Ramps;collisions:BoatCollisions;bodies:BoatBody[];
}
export const IDLE_COMMAND:PlayerCommand={throttle:0,brake:0,steer:0,boost:false,trick:false};
/** Fixed-step rules only: no renderer, DOM, audio, browser storage or network. */
export class LocalRaceSession implements RaceSession {
 readonly mode='training' as const;
 race!:RaceController;
 private stepResult={drove:false,started:false,finished:false,wallContact:false};
 constructor(readonly state:LocalRaceState,readonly options:TrainingOptions,private playerName='你 / PLAYER'){this.restart();}
 restart(){
  const s=this.state;s.track.spawn(s.player);s.ai.forEach(a=>a.reset());s.ramps.place(s.player,s.flight);s.bodies.forEach((b,i)=>b.height=i?s.ai[i-1].flight.height:s.flight.height);
  s.ramps.decisions.clear();s.tricks.reset();s.nitro.reset();
  this.race=new RaceController(s.track,[{id:'player',name:this.playerName,position:s.player},...cityEntrants(s.ai)],'player',{laps:this.options.laps,bestKey:`${s.track.name}:training:${this.options.difficulty}:laps:${this.options.laps}`});
 }
 recover(){
  if(this.race.phase!=='racing')return false;
  const s=this.state,angle=this.race.player.passed===0?-.014:s.track.checkpointAngle(this.race.player.passed%s.track.checkpointCount)+10/s.track.radius,branch=this.race.player.route,cut=s.track.shortcuts.find(c=>c.id===branch),valid=cut&&angle>cut.from&&angle<cut.to;
  s.track.spawn(s.player,angle);if(valid)Object.assign(s.player,s.track.routePoint(angle,0,branch),{heading:s.track.routeHeading(angle,branch)});
  s.ramps.place(s.player,s.flight);s.bodies[0].height=s.flight.height;s.tricks.reset();s.nitro.active=false;this.race.syncPosition('player',s.player);if(valid)this.race.player.route=branch;return true;
 }
 step(dt:number,input:PlayerCommand){
  const out=this.stepResult,s=this.state,r=this.race;out.drove=r.phase==='racing';out.started=out.finished=out.wallContact=false;r.tick(dt);out.started=!out.drove&&r.phase==='racing';
  if(!out.drove)return out;
  s.collisions.capture(s.bodies);const before={x:s.player.x,z:s.player.z,route:s.player.route};s.flight.beginStep(dt);s.nitro.update(dt,input.boost);
  s.player.update(dt,input,s.nitro.active);out.wallContact=s.track.constrain(s.player);s.ramps.prepare(s.player,s.flight);s.bodies[0].height=s.flight.height;
  const aiWall=s.ai.map((a,i)=>{a.update(dt,s.bodies,r.racers[i+1].finishTime===null);const w=s.track.constrain(a.model);s.bodies[i+1].height=a.flight.height;return w;});
  s.collisions.resolve(s.bodies,dt,m=>{if(!s.track.constrain(m))return;if(m===s.player)out.wallContact=true;const i=s.ai.findIndex(a=>a.model===m);if(i>=0)aiWall[i]=true;});
  s.ramps.update(before,s.player,s.flight,'player',s.collisions.sweptPath('player'),s.collisions.movementAllowance('player'));s.bodies[0].height=s.flight.height;
  s.ai.forEach((a,i)=>{a.finishStep(s.collisions.sweptPath(a.id),s.collisions.movementAllowance(a.id));s.bodies[i+1].height=a.flight.height;});
  s.ai.forEach((a,i)=>a.updateActions(dt,!aiWall[i]&&a.model.speed>8&&!s.collisions.hasContact(a.id),r.racers[i+1].finishTime===null));
  if(s.flight.takeoff)s.tricks.beginJump();if(input.trick)s.tricks.request(s.flight);s.tricks.update(dt);s.ai.forEach(a=>{if(s.collisions.hasContact(a.id))a.onContact();});
  if(s.flight.landed){const factor=s.flight.impactFactor;s.player.speed*=factor;s.player.vx*=factor;s.player.vz*=factor;const result=s.tricks.land(!out.wallContact&&s.player.speed>8&&!s.collisions.hasContact('player'));s.nitro.reward(result.reward);if(result.penalty){s.player.speed*=.72;s.player.vx*=.72;s.player.vz*=.72;}}
  r.record('player',s.player,dt,s.collisions.movementAllowance('player'));s.ai.forEach(a=>r.record(a.id,a.model,dt,s.collisions.movementAllowance(a.id)));r.completeStep();
  if(r.phase==='finished'){out.finished=true;s.nitro.active=false;s.ai.forEach(a=>a.nitro.active=false);s.player.speed=0;}
  return out;
 }
 summary():TrainingRun{return{...this.options,elapsed:this.race.player.finishTime??this.race.elapsed,completedLaps:Math.floor(this.race.player.passed/this.state.track.checkpointCount),rank:this.race.playerRank,completed:this.race.phase==='finished'};}
}

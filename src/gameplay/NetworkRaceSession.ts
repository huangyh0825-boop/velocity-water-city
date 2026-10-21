import {LocalRaceSession,type LocalRaceState,IDLE_COMMAND} from './LocalRaceSession';
import {RaceController} from '../race/RaceController';
import {AIController} from '../ai/AIController';
import {onlineSpawn} from './OnlineSpawn';
import type {PlayerCommand} from './PlayerCommand';
import type {RaceSession,SessionStep} from './RaceSession';
import type {LobbyClient} from '../lobby/LobbyClient';
import type {OnlineRace,OnlineFrame,OnlineRacerState} from '../lobby/racing';
import type {TrainingRun} from '../modes/TrainingOptions';

export interface OnlineGameOptions {lobby:LobbyClient;race:OnlineRace;memberId:string}
/** Remote crafts reuse the existing visuals only; no AI decisions run online. */
export function onlinePeers(track:LocalRaceState['track'],options:OnlineGameOptions){return options.race.participants.filter(p=>p.id!==options.memberId).map(p=>new AIController(p.id,p.name,0,0,track,0));}
export class NetworkRaceSession implements RaceSession {
 readonly mode='online' as const;
 private local:LocalRaceSession;
 private unsubscribe:()=>void;
 private sequence=0;private correction=-1;private sendTime=0;private frame?:OnlineFrame;
 private ready=false;private loading=false;private previousPhase='countdown';private changed=false;private recoverPending=false;
 private targets=new Map<string,OnlineRacerState>();
 message='等待所有玩家加载赛道';
 get race(){return this.local.race;}
 constructor(readonly state:LocalRaceState,readonly peers:AIController[],readonly online:OnlineGameOptions){
  this.local=new LocalRaceSession(state,{laps:online.race.laps,difficulty:'hard'},'你',true);
  this.restart();this.unsubscribe=online.lobby.subscribe(()=>this.receive());this.receive();
 }
 restart(){
  this.local.restart();const {race,memberId}=this.online;
  onlineSpawn(this.state.track,this.state.player,race.participants.find(p=>p.id===memberId)!.slot);
  this.state.ramps.place(this.state.player,this.state.flight);
  this.peers.forEach(peer=>{const p=race.participants.find(p=>p.id===peer.id)!;onlineSpawn(this.state.track,peer.model,p.slot);peer.flight.surface(this.state.track.surface(peer.model).height);peer.flight.previousHeight=peer.flight.height;});
  this.local.race=new RaceController(this.state.track,race.participants.map(p=>({id:p.id,name:p.name,position:p.id===memberId?this.state.player:this.peers.find(a=>a.id===p.id)!.model})),memberId,{laps:race.laps,bestKey:'online'});
  this.local.race.countdown=5;this.correction=-1;this.previousPhase='countdown';if(this.frame)this.applyFrame(this.frame);
 }
 markLoaded(){this.ready=true;this.receive();}
 private receive(){
  const {lobby,race}=this.online,current=lobby.connection?.room.race;
  if(current?.id===race.id){this.online.race=current;
   const own=current.participants.find(p=>p.id===this.online.memberId);
   if(this.ready&&!this.loading&&own&&!own.loaded&&lobby.connection?.status==='connected'&&current.phase==='loading'){
    this.loading=true;void lobby.raceCommand('race.loaded',race.id).catch(e=>{this.message=e.message;}).finally(()=>{this.loading=false;});
   }
  }
  if(lobby.frame?.raceId===race.id&&lobby.frame!==this.frame){this.frame=lobby.frame;this.applyFrame(lobby.frame);}
 }
 private applyFrame(frame:OnlineFrame){
  for(const pose of frame.states){const racer=this.race.racers.find(r=>r.id===pose.id);if(!racer)continue;
   racer.passed=pose.passed;racer.progress=pose.progress;racer.finishTime=pose.finishTime;
   const participant=this.online.race.participants.find(p=>p.id===pose.id);if(participant)racer.name=participant.name+(pose.dnf?'（已退出）':'');
   this.targets.set(pose.id,pose);
   if(pose.id===this.online.memberId){
    if(this.correction!==pose.correction){
     const {player,flight,tricks,nitro}=this.state;Object.assign(player,{x:pose.x,z:pose.z,y:pose.y,heading:pose.heading,speed:pose.speed,vx:pose.vx,vz:pose.vz});
     // Server corrections retain current vertical momentum during a jump.
     if(!pose.airborne){flight.reset();flight.managedSurface=this.state.track.vertical;flight.surface(pose.y);flight.previousHeight=pose.y;tricks.reset();}
     else {flight.height=flight.previousHeight=pose.y;flight.airborne=true;flight.state='air';}
     nitro.active=pose.nitro;this.correction=pose.correction;this.changed=true;
    }
    racer.position={x:this.state.player.x,z:this.state.player.z};
   }else racer.position={x:pose.x,z:pose.z};
  }
 }
 consumeCorrection(){const changed=this.changed;this.changed=false;return changed;}
 rotation(id:string){const p=this.targets.get(id);return p?{pitch:p.pitch,yaw:p.spin}:{pitch:0,yaw:0};}
 recover(){if(this.race.phase!=='racing'||this.recoverPending)return false;this.recoverPending=true;void this.online.lobby.raceCommand('race.recover',this.online.race.id).catch(e=>{this.message=e.message;}).finally(()=>{this.recoverPending=false;});return true;}
 step(dt:number,input:PlayerCommand):SessionStep {
  const {lobby,memberId}=this.online,r=this.race,view=lobby.connection?.room.race,now=lobby.now();
  const connected=lobby.connection?.status==='connected',own=this.targets.get(memberId);
  this.message='';
  if(!connected)this.message=lobby.error||'连接中断，等待重新加入比赛';
  else if(!view||view.id!==this.online.race.id)this.message='房间已重置，请返回首页重新加入';
  else if(view.phase==='aborted')this.message=view.message;
  else if(view.phase==='loading')this.message=`等待玩家加载 · ${view.participants.filter(p=>p.loaded&&p.connected).length} / ${view.participants.length}`;
  else if(view.startAt!==null&&now<(view.countdownAt??view.startAt))this.message='全员加载完成 · 正在同步发车';
  const driving=!this.message&&view?.startAt!==null&&now>=view!.startAt!&&['countdown','racing','finished'].includes(view!.phase);
  r.phase=own?.finishTime!==null&&own?.finishTime!==undefined?'finished':driving?'racing':'countdown';
  if(own?.dnf){r.phase='countdown';this.message='你已退出本场比赛，请返回首页';}
  r.countdown=view?.startAt?Math.max(0,Math.min(5,(view.startAt-now)/1000)):5;
  r.elapsed=view?.startAt?Math.max(0,(now-view.startAt)/1000):0;
  const previous=this.previousPhase;this.previousPhase=r.phase;
  const result=this.local.step(dt,r.phase==='racing'?input:IDLE_COMMAND);
  result.started=previous==='countdown'&&r.phase==='racing';result.finished=previous!=='finished'&&r.phase==='finished';
  for(const peer of this.peers){const p=this.targets.get(peer.id);if(!p)continue;
   const m=peer.model,f=peer.flight,a=1-Math.exp(-dt*14),distance=Math.hypot(m.x-p.x,m.z-p.z);
   f.previousHeight=f.height;f.takeoff=!f.airborne&&p.airborne;f.landed=f.airborne&&!p.airborne;f.airborne=p.airborne;f.state=p.airborne?'air':'water';
   m.x=distance>35?p.x:m.x+(p.x-m.x)*a;m.z=distance>35?p.z:m.z+(p.z-m.z)*a;m.heading+=Math.atan2(Math.sin(p.heading-m.heading),Math.cos(p.heading-m.heading))*a;
   m.speed=p.speed;m.vx=p.vx;m.vz=p.vz;m.y=f.height=f.height+(p.y-f.height)*a;peer.nitro.active=p.nitro;
  }
  this.sendTime+=dt;
  if(r.phase==='racing'&&this.sendTime>=.1&&connected&&this.correction>=0){
   this.sendTime%=.1;const s=this.state,m=s.player,rotation=s.tricks.rotation;
   lobby.sendRaceState(this.online.race.id,{seq:++this.sequence,t:r.elapsed,x:m.x,z:m.z,y:s.flight.height,heading:m.heading,speed:m.speed,vx:m.vx,vz:m.vz,airborne:s.flight.airborne,nitro:s.nitro.active,pitch:rotation.pitch,spin:rotation.yaw,correction:this.correction});
  }
  if(r.phase==='finished')this.state.player.speed=0;
  return result;
 }
 summary():TrainingRun{return{laps:this.race.laps,difficulty:'hard',elapsed:this.race.player.finishTime??this.race.elapsed,completedLaps:Math.floor(this.race.player.passed/this.state.track.checkpointCount),rank:this.race.playerRank,completed:this.race.phase==='finished'};}
 dispose(){this.unsubscribe();}
}

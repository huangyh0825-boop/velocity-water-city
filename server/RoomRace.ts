import {randomBytes} from 'node:crypto';
import {CityTrack} from '../src/track/CityTrack';
import {DrivingModel,MAX_SPEED} from '../src/player/DrivingModel';
import {BoatCollisions} from '../src/physics/BoatCollisions';
import {RaceController} from '../src/race/RaceController';
import {onlineSpawn} from '../src/gameplay/OnlineSpawn';
import {NITRO_TUNING} from '../src/config/phase3';
import {LobbyFault} from '../src/lobby/protocol';
import {isOnlinePose,type OnlineFrame,type OnlinePose,type OnlineRace} from '../src/lobby/racing';
let track:CityTrack|undefined;
const course=()=>track??=new CityTrack();
type Player={model:DrivingModel;pose:OnlinePose;pending?:OnlinePose;lastSeq:number;lastT:number;appliedT:number;correction:number};
export class RoomRace {
 readonly view:OnlineRace;
 readonly players=new Map<string,Player>();
 readonly rules:RaceController;
 private collisions=new BoatCollisions();
 private createdAt:number;private lastTick:number;
 constructor(roster:{id:string;playerId:string}[],now:number,readonly laps=3){
  this.createdAt=this.lastTick=now;
  this.view={id:randomBytes(12).toString('hex'),phase:'loading',laps,participants:roster.map((p,slot)=>({id:p.id,name:p.playerId,slot,loaded:false,connected:true,dnf:false})),countdownAt:null,startAt:null,message:'等待所有玩家加载赛道'};
  for(const p of this.view.participants){const model=new DrivingModel();onlineSpawn(course(),model,p.slot);this.players.set(p.id,{model,pose:{seq:0,t:0,x:model.x,z:model.z,y:model.y,heading:model.heading,speed:0,vx:0,vz:0,airborne:false,nitro:false,pitch:0,spin:0,correction:0},lastSeq:-1,lastT:0,appliedT:0,correction:0});}
  this.rules=new RaceController(course(),this.view.participants.map(p=>({id:p.id,name:p.name,position:this.players.get(p.id)!.model,maxSpeed:MAX_SPEED*NITRO_TUNING.multiplier+5})),roster[0].id,{laps,bestKey:'online-server'});
 }
 get active(){return !['finished','aborted'].includes(this.view.phase);}
 resume(id:string,now:number){this.connected(id,true,now);const p=this.players.get(id);if(p){p.lastSeq=-1;p.correction++;p.pending=undefined;}}
 private participant(id:string){const p=this.view.participants.find(p=>p.id===id);if(!p)throw new LobbyFault(403,'你不在这场比赛中');return p;}
 loaded(id:string,now:number){const p=this.participant(id);if(!this.active||p.dnf)throw new LobbyFault(409,'这场比赛已结束');p.loaded=true;this.barrier(now);}
 connected(id:string,connected:boolean,now:number){
  const p=this.view.participants.find(p=>p.id===id);if(!p||!this.active)return;p.connected=connected;
  if(!connected){p.loaded=false;if(this.view.phase==='countdown'&&now<this.view.startAt!){this.view.phase='loading';this.view.startAt=this.view.countdownAt=null;this.view.message='玩家掉线，等待重连并加载完成';}}
  this.barrier(now);
 }
 leave(id:string){const p=this.view.participants.find(p=>p.id===id);if(!p)return;p.connected=false;p.dnf=true;
  if(['loading','countdown'].includes(this.view.phase))this.abort('有玩家离开，比赛已取消，请返回大厅重新准备');else this.finishIfDone();
 }
 abort(message:string){if(!this.active)return;this.view.phase='aborted';this.view.message=message;}
 private barrier(now:number){if(this.view.phase==='loading'&&this.view.participants.every(p=>p.loaded&&p.connected&&!p.dnf)){
  this.view.phase='countdown';this.view.countdownAt=now+2000;this.view.startAt=this.view.countdownAt+5000;this.view.message='所有玩家加载完成，正在同步发车';
 }}
 accept(id:string,value:unknown,now:number){
  this.tickPhase(now);if(this.view.phase!=='racing')throw new LobbyFault(409,'尚未发车或比赛已结束');const member=this.participant(id);if(member.dnf)throw new LobbyFault(403,'已退出比赛');
  if(!isOnlinePose(value))throw new LobbyFault(400,'比赛状态无效');
  const p=this.players.get(id)!,r=this.rules.racers.find(r=>r.id===id)!;if(r.finishTime!==null)return;
  if(value.seq<=p.lastSeq)return;
  const elapsed=(now-this.view.startAt!)/1000;
  if(value.t>elapsed+.5||value.t<p.lastT||value.t-p.lastT>Math.max(2,elapsed-p.lastT+1))throw new LobbyFault(400,'比赛时间无效');
  p.lastSeq=value.seq;
  if(value.correction!==p.correction)return;
  const dt=Math.min(1,Math.max(.001,value.t-p.appliedT));
  if(Math.hypot(value.x-p.model.x,value.z-p.model.z)>(MAX_SPEED*NITRO_TUNING.multiplier+5)*dt+2){p.correction++;return;}
  p.lastT=value.t;p.pending={...value};
 }
 recover(id:string,now:number){
  this.tickPhase(now);if(this.view.phase!=='racing')throw new LobbyFault(409,'比赛尚未开始');
  const p=this.players.get(id);if(!p||this.participant(id).dnf)throw new LobbyFault(403,'无法返回赛道');const racer=this.rules.racers.find(r=>r.id===id)!;
  course().spawn(p.model,racer.passed===0?-.014:course().checkpointAngle(racer.passed%course().checkpointCount)+10/course().radius);
  p.pending=undefined;p.correction++;p.pose={...p.pose,x:p.model.x,z:p.model.z,y:p.model.y,speed:0,vx:0,vz:0,heading:p.model.heading,airborne:false,pitch:0,spin:0};
  this.rules.syncPosition(id,p.model);
 }
 private tickPhase(now:number){
  if(this.view.phase==='loading'&&now-this.createdAt>600_000)this.abort('等待加载超时，请返回大厅重新开始');
  if(this.view.phase==='countdown'&&now>=this.view.startAt!){this.view.phase='racing';this.view.message='比赛进行中';this.rules.phase='racing';}
  if(this.view.phase==='racing'&&now-this.view.startAt!>1_800_000)this.abort('比赛时间已超过三十分钟，请返回大厅');
 }
 tick(now:number){
  this.tickPhase(now);const dt=Math.min(1,Math.max(.001,(now-this.lastTick)/1000));this.lastTick=now;
  if(this.view.phase!=='racing')return;
  this.rules.elapsed=Math.max(0,(now-this.view.startAt!)/1000);
  const bodies=this.view.participants.filter(p=>!p.dnf&&p.connected).map(p=>({id:p.id,model:this.players.get(p.id)!.model,height:this.players.get(p.id)!.pose.y,fixed:this.rules.racers.find(r=>r.id===p.id)!.finishTime!==null}));
  this.collisions.capture(bodies);
  for(const [id,p]of this.players)if(p.pending){const body=bodies.find(b=>b.id===id);if(body){Object.assign(p.model,p.pending);p.pose=p.pending;body.height=p.pose.y;}p.pending=undefined;}
  this.collisions.resolve(bodies,dt,m=>{course().constrain(m);});
  for(const member of this.view.participants){const p=this.players.get(member.id)!;
   if(this.collisions.hasContact(member.id)){p.correction++;p.pose={...p.pose,x:p.model.x,z:p.model.z,y:p.model.y,heading:p.model.heading,speed:p.model.speed,vx:p.model.vx,vz:p.model.vz};}
   const motionDt=p.pose.t-p.appliedT;if(motionDt>0&&!member.dnf){this.rules.record(member.id,p.model,Math.min(1,motionDt),this.collisions.movementAllowance(member.id));p.appliedT=p.pose.t;}
   if(this.rules.racers.find(r=>r.id===member.id)!.finishTime!==null){p.model.speed=p.model.vx=p.model.vz=0;p.pose={...p.pose,speed:0,vx:0,vz:0,nitro:false};}
  }
  this.finishIfDone();
 }
 private finishIfDone(){if(this.view.phase==='racing'&&this.view.participants.every(p=>p.dnf||this.rules.racers.find(r=>r.id===p.id)!.finishTime!==null)){this.view.phase='finished';this.view.message='比赛已结束';}}
 frame(now:number):OnlineFrame {return{raceId:this.view.id,serverNow:now,phase:this.view.phase,states:this.view.participants.map(member=>{
  const p=this.players.get(member.id)!,r=this.rules.racers.find(r=>r.id===member.id)!;
  const round=(v:number)=>Math.round(v*1000)/1000;
  return{...p.pose,x:round(p.model.x),z:round(p.model.z),y:round(p.model.y),heading:round(p.model.heading),speed:round(p.model.speed),vx:round(p.model.vx),vz:round(p.model.vz),correction:p.correction,id:member.id,passed:r.passed,progress:round(r.progress),finishTime:r.finishTime,dnf:member.dnf};
 })};}
}

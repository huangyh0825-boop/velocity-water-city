import { DrivingModel } from '../player/DrivingModel';
import { Track, signedAngle } from '../track/Track';
import { SPEED_TUNING } from '../config/speed';
import { Ramps,type RampData } from '../track/Ramps';
import { FlightController } from '../player/FlightController';
import type { BoatBody } from '../physics/BoatCollisions';
import { TrickController } from '../player/TrickController';
import { NitroController } from '../player/NitroController';
import { NITRO_TUNING } from '../config/phase3';
import { NitroDecision } from './NitroDecision';
import {CityTrack} from '../track/CityTrack';
import type {Point} from '../track/Track';
export class AIController {
  readonly model = new DrivingModel();
  readonly flight=new FlightController();
  readonly tricks = new TrickController();
  readonly nitro = new NitroController();
  private jumpCount = 0;
  readonly boostDecision: NitroDecision;
  private ramps?:Ramps;
  private before:Point={x:0,z:0};
  private plan:{ramp:RampData;use:boolean;distance:number}|null=null;
  private visits=new Map<string,number>();
  readonly personality:number;
  private clearanceTime = 0;
  private clearanceLane = 0;
  route:string|null=null;
  private chooseRoute(peers:readonly BoatBody[]){
    if(!(this.track instanceof CityTrack))return;
    const track=this.track;
    const cut=track.shortcuts.find(s=>s.id===this.route);
    if(cut){const q=track.project(this.model,cut.id),end=cut.samples.at(-1)!,along=(this.model.x-end.x)*Math.sin(end.heading)+(this.model.z-end.z)*Math.cos(end.heading);if(q.angle>cut.to-.002&&along>2)this.route=null;return;}
    const angle=track.project(this.model,null).angle;
    for(const [i,s]of track.shortcuts.entries()){
      const distance=(s.from-angle)*track.radius;
      if(distance<8||distance>110||(this.personality+i)%3===0)continue;
      const busy=peers.filter(p=>p.id!==this.id&&Math.hypot(p.model.x-s.samples[0].x,p.model.z-s.samples[0].z)<20).length;
      if(busy<2&&!this.flight.airborne){this.route=s.id;this.plan=null;break;}
    }
  }
  constructor(readonly id: string, readonly name: string, readonly targetSpeed: number, readonly lane: number, private track: Track, readonly gridAngle: number, readonly acceleration: number = SPEED_TUNING.normalAI.acceleration) { this.personality=[...id].reduce((sum,char)=>sum+char.charCodeAt(0),0);this.boostDecision=new NitroDecision((this.personality%4)*.04);this.reset(); }
  setRamps(ramps:Ramps){this.ramps=ramps;}
  get navigation(){return{mode:this.flight.state==='water'?(this.plan?.use?'approach':'route'):this.flight.state,rampId:this.plan?.ramp.id??null,selected:this.plan?.use??false};}
  reset() { this.route=null;this.clearanceTime = this.clearanceLane = 0;this.plan=null;this.visits.clear();this.flight.reset();this.jumpCount=0;this.tricks.reset(this.personality%3);this.nitro.reset();this.boostDecision.reset(); this.track.spawn(this.model, this.gridAngle, this.lane);this.flight.surface(this.track.surface(this.model).height);this.flight.previousHeight=this.flight.height;this.flight.managedSurface=this.track.vertical; }
  onContact() {
    this.boostDecision.contact(); this.nitro.active=false;
    if (this.model.speed >= this.targetSpeed * 0.8) return;
    if(this.plan?.use&&this.flight.state==='water')this.plan.use=false;
    // A small temporary recovery offset prevents a stopped boat blocking the same lane forever.
    const parity = [...this.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2;
    this.clearanceLane = parity ? 3.5 : -3.5; this.clearanceTime = 1.5;
  }
  private rampDistance(r:RampData){return ((r.angle-this.track.angle(this.model)+Math.PI*2)%(Math.PI*2))*this.track.radius;}
  private chooseRamp(peers:readonly BoatBody[]){
    if(!this.ramps||this.flight.airborne||this.route)return;
    if(this.plan&&this.rampDistance(this.plan.ramp)>this.plan.distance+100&&this.plan.distance<20)this.plan=null;
    const crowded=(r:RampData)=>peers.filter(p=>p.id!==this.id&&(p.height??0)<1.2).filter(p=>{const loc=this.ramps!.local(p.model,r);return loc.along>-40&&loc.along<50&&Math.abs(loc.radial)<3;}).length>=2;
    if(!this.plan){
      const ramp=[...this.ramps.data].sort((a,b)=>this.rampDistance(a)-this.rampDistance(b))[0],distance=this.rampDistance(ramp);
      if(distance<(this.track.isSpline?220:145)){const visit=this.visits.get(ramp.id)??0;this.visits.set(ramp.id,visit+1);
        const alignmentTime=Math.abs(this.track.offset(this.model))/3+.3;
        const timeToEntry=Math.max(0,distance-ramp.length)/Math.max(15,this.model.speed);
        const forecast=Math.min(this.targetSpeed,this.model.speed+this.acceleration*timeToEntry);
        const landingClear=peers.every(p=>p.id===this.id||Math.hypot(p.model.x-ramp.landing.x,p.model.z-ramp.landing.z)>7);
        this.plan={ramp,use:(this.personality+visit+this.ramps.data.indexOf(ramp))%4!==0&&!crowded(ramp)&&forecast>=18&&timeToEntry>=alignmentTime&&landingClear,distance};
      }
    }
    if(this.plan){this.plan.distance=this.rampDistance(this.plan.ramp);if(this.plan.use&&this.plan.distance>35&&crowded(this.plan.ramp))this.plan.use=false;}
  }
  finishStep(path?:readonly {x:number;z:number;heading?:number}[],correction=0){this.ramps?.update(this.before,this.model,this.flight,this.id,path??[this.before,this.model],correction);}
  /** Decisions request the same animation and landing settlement used by the player. */
  updateActions(dt: number, safeLanding: boolean, competing = true) {
    if (this.flight.takeoff) { this.jumpCount++; this.tricks.beginJump(); }
    const delay = .12 + (this.personality % 3) * .08;
    const willing = (this.personality + this.jumpCount) % 4 !== 0;
    if (competing && willing && this.flight.airborne && this.flight.legalLaunch &&
        this.flight.elapsed >= delay && this.flight.remainingTime >= .9) {
      this.tricks.request(this.flight);
    }
    this.tricks.update(dt);
    if (this.flight.landed) {
      const factor=this.track.vertical?this.flight.impactFactor:1;this.model.speed*=factor;this.model.vx*=factor;this.model.vz*=factor;
      const result = this.tricks.land(safeLanding);
      this.nitro.reward(result.reward);
      if (result.penalty) {
        this.model.speed *= .72; this.model.vx *= .72; this.model.vz *= .72;
      }
    }
  }
  private requestNitro(dt: number, peers: readonly BoatBody[], competing: boolean) {
    const m=this.model, laneOffset=this.track.offset(m);
    const nearby=peers.filter(p=>p.id!==this.id&&Math.abs((p.height??0)-this.flight.height)<=1.2);
    const crowded=nearby.some(p=>Math.hypot(p.model.x-m.x,p.model.z-m.z)<12);
    const loc=this.track instanceof CityTrack?this.track.project(m,this.route):null,heading=this.track instanceof CityTrack?this.track.routeHeading(loc!.angle,this.route):this.track.heading(this.track.angle(m));
    const aligned=Math.abs(signedAngle(m.heading-heading))<.3;
    const width=this.track instanceof CityTrack&&this.route?this.track.shortcuts.find(s=>s.id===this.route)!.width:this.track.widthAt(this.track.angle(m));
    const ahead=this.track instanceof CityTrack?this.track.surface(this.track.routeTarget(m,25,0,this.route)).height:this.flight.height;
    const safe=Boolean(this.ramps)&&competing&&!crowded&&aligned&&Math.abs(m.yawRate)<.55&&(!this.track.vertical||this.flight.airborne||ahead>=this.flight.height-5)&&
      Math.abs(laneOffset)<Math.max(1,width-3)&&Math.abs(this.track.surface(m).slope)<.2&&(!this.track.isSpline||Math.abs(this.track.curvature(this.track.angle(m)))<.004)&&this.flight.state!=='landing'&&
      (!this.flight.airborne||this.flight.remainingTime>.6);
    const overtake=nearby.some(p=>{
      const x=p.model.x-m.x,z=p.model.z-m.z,forward=x*Math.sin(m.heading)+z*Math.cos(m.heading);
      return forward>15&&forward<45&&Math.abs(x*Math.cos(m.heading)-z*Math.sin(m.heading))<8;
    });
    const runup=this.plan?.use&&this.plan.distance>20&&this.plan.distance<100&&Math.abs(laneOffset)<2;
    // This course has broad, constant-radius curves. Sharp heading corrections are excluded above.
    const cruise=!this.flight.airborne&&m.speed>this.targetSpeed*.94&&this.nitro.energy>=18;
    const requested=this.boostDecision.update(dt,{safe,energy:this.nitro.energy,
      opportunity:m.speed>this.targetSpeed*.8&&Boolean(overtake||runup||cruise)});
    this.nitro.update(dt,requested,competing);
  }
  update(dt: number,peers:readonly BoatBody[]=[],competing=true) {
    this.before={x:this.model.x,z:this.model.z,route:this.model.route};this.flight.beginStep(dt);this.chooseRoute(peers);this.model.routeIntent=this.route;this.chooseRamp(peers);
    this.requestNitro(dt,peers,competing);
    const cap=this.targetSpeed*(this.nitro.active?NITRO_TUNING.multiplier:1);
    const angleNow=this.track.angle(this.model);let curvature=Math.max(Math.abs(this.track.curvature(angleNow,35)),Math.abs(this.track.curvature(angleNow+45/this.track.radius,35)));
    if(this.track instanceof CityTrack&&this.route){const cut=this.track.shortcuts.find(s=>s.id===this.route)!,q=this.track.project(this.model,this.route),delta=35/cut.length*(cut.to-cut.from);if(q.angle>cut.from+.002)curvature=Math.max(Math.abs(signedAngle(this.track.routeHeading(q.angle+delta,this.route)-this.track.routeHeading(q.angle,this.route)))/35,Math.abs(signedAngle(this.track.routeHeading(q.angle+delta*2,this.route)-this.track.routeHeading(q.angle+delta,this.route)))/35);}
    let safeCap=this.track.isSpline&&!this.flight.airborne?Math.min(cap,.48/Math.max(.0001,curvature)):cap;
    if(this.track instanceof CityTrack&&this.route&&!this.flight.airborne){const cut=this.track.shortcuts.find(s=>s.id===this.route)!,distance=(cut.from-this.track.project(this.model,null).angle)*this.track.radius;if(distance>0&&distance<110){const at=(metres:number)=>this.track instanceof CityTrack?this.track.routeHeading(cut.from+metres/cut.length*(cut.to-cut.from),this.route):0,k=Math.max(Math.abs(signedAngle(at(45)-at(15)))/30,Math.abs(signedAngle(at(75)-at(45)))/30),entryCap=Math.min(this.targetSpeed,.48/Math.max(.0001,k));safeCap=Math.min(safeCap,Math.sqrt(entryCap*entryCap+34*Math.max(0,distance-7)));}}
    this.model.speed=this.model.speed>safeCap?Math.max(safeCap,this.model.speed-(this.track.isSpline?17:NITRO_TUNING.releaseDeceleration)*dt):
      Math.min(safeCap,this.model.speed+(this.acceleration+(this.nitro.active?NITRO_TUNING.acceleration:0))*dt);
    this.clearanceTime = Math.max(0, this.clearanceTime - dt);
    const angle = this.track.angle(this.model), radius = Math.max(1, Math.hypot(this.model.x, this.model.z));
    const recoveryLane = this.plan?.use?0:this.lane + (this.clearanceTime > 0 ? this.clearanceLane : 0);
    if(this.track.isSpline){
      const lane=this.route?Math.max(-2,Math.min(2,recoveryLane*.24)):Math.max(-this.track.widthAt(angleNow)+5,Math.min(this.track.widthAt(angleNow)-5,recoveryLane));
      const p=this.track instanceof CityTrack?this.track.routeTarget(this.model,Math.max(18,this.model.speed*.65),lane,this.route):this.track.target(this.model,Math.max(18,this.model.speed*.65),lane),desired=Math.atan2(p.x-this.model.x,p.z-this.model.z);
      const yaw=Math.max(-.67,Math.min(.67,signedAngle(desired-this.model.heading)*2.7));
      this.model.yawRate+=(yaw-this.model.yawRate)*(1-Math.exp(-dt*3.5));this.model.heading+=this.model.yawRate*dt;
      const grip=1-Math.exp(-dt*3.8);this.model.vx+=(Math.sin(this.model.heading)*this.model.speed-this.model.vx)*grip;this.model.vz+=(Math.cos(this.model.heading)*this.model.speed-this.model.vz)*grip;
      this.model.x+=this.model.vx*dt;this.model.z+=this.model.vz*dt;this.model.route=this.track.raceRoute(this.before,this.model,this.model.route??null);this.ramps?.prepare(this.model,this.flight);return;
    }
    if(this.flight.airborne){
      const p=this.track.point(angle+.16,recoveryLane),desired=Math.atan2(p.x-this.model.x,p.z-this.model.z);
      const yaw=Math.max(-.67,Math.min(.67,signedAngle(desired-this.model.heading)*2.5));
      this.model.yawRate+=(yaw-this.model.yawRate)*(1-Math.exp(-dt*3.5));this.model.heading+=this.model.yawRate*dt;
      const grip=1-Math.exp(-dt*3.8);this.model.vx+=(Math.sin(this.model.heading)*this.model.speed-this.model.vx)*grip;this.model.vz+=(Math.cos(this.model.heading)*this.model.speed-this.model.vz)*grip;
      this.model.x+=this.model.vx*dt;this.model.z+=this.model.vz*dt;return;
    }
    const recovery = Math.max(-3, Math.min(3, (this.track.radius + recoveryLane - radius) * 1.8));
    const radialVelocity = this.model.vx * Math.cos(angle) + this.model.vz * Math.sin(angle);
    const lateral = radialVelocity + (recovery - radialVelocity) * (1 - Math.exp(-dt * 4));
    const nextAngle = angle + this.model.speed / radius * dt;
    Object.assign(this.model, this.track.point(nextAngle, radius + lateral * dt - this.track.radius));
    this.model.heading += signedAngle(this.track.heading(nextAngle) - this.model.heading);
    this.model.yawRate = -this.model.speed / radius;
    this.model.vx = Math.sin(this.model.heading) * this.model.speed + Math.cos(nextAngle) * lateral;
    this.model.vz = Math.cos(this.model.heading) * this.model.speed + Math.sin(nextAngle) * lateral;
    this.ramps?.prepare(this.model,this.flight);
  }
}

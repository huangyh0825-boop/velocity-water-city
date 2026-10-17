import * as THREE from 'three';
import { Track } from './Track';
import type { DrivingModel } from '../player/DrivingModel';
import { FlightController } from '../player/FlightController';
import { BOAT_HULL } from '../physics/BoatCollisions';
import {SurfaceContact} from './SurfaceContact';
import {CITY_RAMPS} from './JumpLayout';
export interface RampData { id:string;angle:number;heading:number;width:number;length:number;height:number;minSpeed:number;baseHeight?:number;liftBase?:number;liftFactor?:number;entry:{x:number;z:number};lip:{x:number;z:number};landing:{x:number;z:number} }
interface Pose { x:number;z:number;heading?:number }
export interface RampDecision {boatId:string;rampId:string;reason:string;triggered:boolean;position:Pose;path:readonly Pose[];correction:number;speed:number;horizontalVelocity:{x:number;z:number};height:number;verticalSpeed:number;state:string;support:number}
export const RAMP_ANGLES = [0.38, 2, 4.36] as const;
export class Ramps {
  readonly width = 10;
  readonly length = 12;
  readonly data:RampData[];
  readonly decisions=new Map<string,RampDecision>();
  onDecision?:(decision:RampDecision)=>void;
  private locks=new WeakMap<FlightController,{generation:number;rampId:string}>();
  private contact:SurfaceContact;
  constructor(private track: Track, scene?: THREE.Scene) {
    this.contact=new SurfaceContact(track);
    const layout=track.vertical?CITY_RAMPS.map(r=>({...r,angle:r.t*Math.PI*2})):(track.isSpline?[.28,.41,.876].map(t=>t*Math.PI*2):RAMP_ANGLES).map((angle,i)=>({id:`ramp-${i+1}`,angle,width:10,length:12,height:2,minSpeed:2}));
    this.data=layout.map(r=>({...r,heading:track.heading(r.angle),baseHeight:track.surface(track.point(r.angle)).height,entry:track.point(r.angle-r.length/track.radius),lip:track.point(r.angle),landing:track.point(r.angle+110/track.radius)}));
    if (!scene) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -5,0,-12, 5,0,-12, 5,2,0, -5,0,-12, 5,2,0, -5,2,0,
      -5,0,-12, -5,2,0, -5,0,0, 5,0,-12, 5,0,0, 5,2,0,
      -5,0,0, -5,2,0, 5,2,0, -5,0,0, 5,2,0, 5,0,0,
    ], 3)); geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: '#195b7d', metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide });
    for (const ramp of this.data) {
      const {angle}=ramp,group = new THREE.Group(), p = track.point(angle); group.position.set(p.x, (ramp.baseHeight??0)+0.16, p.z); group.rotation.y = track.heading(angle);group.name=ramp.id;
      group.scale.set(ramp.width/10,ramp.height/2,ramp.length/12);
      group.add(new THREE.Mesh(geometry, material));
      const stripMaterial = new THREE.MeshBasicMaterial({ color: '#83fff0' });
      for (const x of [-4.9, 4.9]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 12.2), stripMaterial);
        strip.position.set(x, 1.05, -6); strip.rotation.x = -Math.atan2(2,12); group.add(strip);
      }
      const arrow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 6), stripMaterial); arrow.position.set(0, 1.05, -6); arrow.rotation.x = -Math.atan2(2,12); group.add(arrow);
      scene.add(group);
    }
  }
  local(p:Pose,r:RampData){const dx=p.x-r.lip.x,dz=p.z-r.lip.z;return{along:Math.sin(r.heading)*dx+Math.cos(r.heading)*dz,radial:Math.cos(r.heading)*dx-Math.sin(r.heading)*dz};}
  support(p:Pose,r:RampData,heading:number){
    const local=this.local(p,r),lateral=Math.sin(heading-r.heading);
    const center=local.radial+BOAT_HULL.forwardOffset*lateral;
    const half=BOAT_HULL.radius+BOAT_HULL.halfSegment*Math.abs(lateral);
    return Math.max(0,Math.min(center+half,r.width/2)-Math.max(center-half,-r.width/2))/(half*2);
  }
  surfaceHeight(model:DrivingModel){let height=this.track.surface(model).height;for(const r of this.data){const p=this.local(model,r);if(p.along>=-r.length&&p.along<=BOAT_HULL.halfSegment&&this.support(model,r,model.heading)>=.6)height=Math.max(height,(r.baseHeight??0)+r.height*Math.min(1,1+p.along/r.length));}return height;}
  place(model:DrivingModel,flight:FlightController){flight.reset();flight.managedSurface=this.track.vertical;flight.surface(this.track.surface(model).height);flight.previousHeight=flight.height;model.y=flight.height;}
  slope(model:DrivingModel){const floor=this.track.surface(model);for(const r of this.data){const p=this.local(model,r);if(p.along>=-r.length&&p.along<=0&&this.support(model,r,model.heading)>=.6)return r.height/r.length;}return floor.slope;}
  prepare(model:DrivingModel,flight:FlightController){this.contact.prepare(model,flight);if(!flight.airborne&&!flight.landed){const height=this.surfaceHeight(model);if(height>0&&(!this.track.vertical||height>=flight.height&&height-flight.height<1.5))flight.surface(height);}model.y=flight.height;}
  update(before:Pose,model:DrivingModel,flight:FlightController,boatId='player',path:readonly Pose[]=[before,model],correction=0){
    if(this.track.vertical)flight.landingHeight=this.surfaceHeight(model);
    let lock=this.locks.get(flight);
    if(lock&&(lock.generation!==flight.generation||Math.hypot(model.x-this.data.find(r=>r.id===lock!.rampId)!.lip.x,model.z-this.data.find(r=>r.id===lock!.rampId)!.lip.z)>this.length+12)){this.locks.delete(flight);lock=undefined;}
    if(flight.airborne){flight.contactSurface(this.surfaceHeight(model));if(flight.airborne&&flight.height<flight.landingHeight-.1)flight.landingHeight=0;if(flight.airborne&&flight.height<=0)flight.contactSurface(0);}
    if(this.track.vertical&&flight.landed){const floor=this.track.surface(model);flight.verticalSpeed=floor.slope*(model.vx*Math.sin(floor.heading)+model.vz*Math.cos(floor.heading));}
    if(flight.airborne||flight.landed){model.y=flight.height;const last=this.decisions.get(boatId);if(last){const value={...last,reason:flight.landed?'landed':flight.legalLaunch?'airborne-preserved':'falling',triggered:false,position:{x:model.x,z:model.z,heading:model.heading},height:flight.height,verticalSpeed:flight.verticalSpeed,state:flight.state,path,correction,speed:model.speed,horizontalVelocity:{x:model.vx,z:model.vz}};this.decisions.set(boatId,value);this.onDecision?.(value);}return;}
    for(const r of this.data){
      const end=this.local(model,r);let reason='no-lip-crossing',support=this.support(model,r,model.heading),triggered=false,near=Math.abs(end.along)<30&&Math.abs(end.radial)<12;
      for(let i=1;i<path.length;i++){
        const a=this.local(path[i-1],r),b=this.local(path[i],r);if(a.along>=0||b.along<0||b.along-a.along<1e-8)continue;
        const t=-a.along/(b.along-a.along),cross={x:path[i-1].x+(path[i].x-path[i-1].x)*t,z:path[i-1].z+(path[i].z-path[i-1].z)*t};
        const h=(path[i-1].heading??model.heading)+((path[i].heading??model.heading)-(path[i-1].heading??model.heading))*t;support=this.support(cross,r,h);near=true;
        const velocity=Math.hypot(model.vx,model.vz)>1e-6? Math.sin(r.heading)*model.vx+Math.cos(r.heading)*model.vz:model.speed*Math.cos(model.heading-r.heading);
        if(support<.6)reason='insufficient-hull-support';
        else if(Math.cos(h-r.heading)<.65)reason='wrong-direction';
        else if(velocity<r.minSpeed||model.speed<r.minSpeed)reason='too-slow';
        else if(lock?.rampId===r.id)reason='ramp-locked';
        else if(!flight.ready)reason='landing-cooldown';
        else if(this.support(path[i-1],r,path[i-1].heading??h)<.6 && a.along>-r.length)reason='side-entry';
        else {triggered=flight.launch(model.speed,r.liftBase===undefined?undefined:r.liftBase+Math.min(model.speed,60)*(r.liftFactor??0),(r.baseHeight??0)+r.height);reason=triggered?'launched':'rejected';if(triggered)this.locks.set(flight,{generation:flight.generation,rampId:r.id});}
        break;
      }
      if(near){const decision: RampDecision={boatId,rampId:r.id,reason,triggered,position:{x:model.x,z:model.z,heading:model.heading},path:path.map(p=>({...p})),correction,speed:model.speed,horizontalVelocity:{x:model.vx,z:model.vz},height:flight.height,verticalSpeed:flight.verticalSpeed,state:flight.state,support};this.decisions.set(boatId,decision);this.onDecision?.(decision);}
      if(triggered){model.y=flight.height;return;}
    }
    const height=this.surfaceHeight(model);
    if(this.track.vertical){
      const ground=this.track.surface(model).height,prior=this.track.surface(before).height;
      if(height>ground+.01)flight.surface(height);
      else if(flight.height>ground+.7&&Math.abs(flight.previousHeight-prior)>.7)flight.fall();
      else this.contact.update(before,model,flight);
    }else if(height>0)flight.surface(height);else if(flight.height>0)flight.fall();else flight.surface(0);
    model.y=flight.height;
    if(flight.airborne){const last=this.decisions.get(boatId);if(last){const value={...last,reason:'lost-ramp-support',state:flight.state,height:flight.height,verticalSpeed:flight.verticalSpeed};this.decisions.set(boatId,value);this.onDecision?.(value);}}
  }
}

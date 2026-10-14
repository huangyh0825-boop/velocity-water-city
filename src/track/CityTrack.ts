import {CatmullRomCurve3,Vector3} from 'three';
import {Track,TAU,type Point} from './Track';
import type {DrivingModel} from '../player/DrivingModel';
interface Sample extends Point {angle:number;heading:number;width:number;branch:string|null}
export interface Shortcut {id:string;from:number;to:number;length:number;samples:Sample[];width:number}
export const DISTRICTS=['中央发车直道','摩天楼 S 弯','高架飞跃区','地下水道','开放港湾','终点冲刺'] as const;
/** Arc-length sampled closed spline; legacy circular Track is only a regression fixture. */
export class CityTrack extends Track {
 override readonly isSpline=true;
 override readonly name='曙光都市 · 六区环线';
 override readonly checkpointCount=24;
 override readonly halfWidth=24;
 override readonly length:number;
 override readonly radius:number;
 readonly samples:Sample[];
 readonly shortcuts:Shortcut[];
 private grid=new Map<string,{a:Sample;b:Sample}[]>();
 constructor(){
  super();
  const points=[[-250,-450],[-250,-160],[-300,100],[-100,310],[-270,500],[-80,730],[240,860],[650,860],[940,660],[1190,400],[1100,110],[820,-90],[790,-310],[1100,-430],[1070,-700],[700,-910],[280,-920],[-80,-820],[-440,-750],[-560,-570]];
  const curve=new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x*.72,0,z*.72)),true,'centripetal');curve.arcLengthDivisions=4096;
  this.length=curve.getLength();this.radius=this.length/TAU;
  this.samples=Array.from({length:1025},(_,i)=>{const p=curve.getPointAt(i/1024),t=curve.getTangentAt(i/1024);return{x:p.x,z:p.z,angle:i/1024*TAU,heading:Math.atan2(t.x,t.z),width:this.widthAt(i/1024*TAU),branch:null};});
  this.shortcuts=[this.makeShortcut('tunnel-cut',.48*TAU,.60*TAU,7),this.makeShortcut('harbor-cut',.65*TAU,.86*TAU,8)];
  for(const samples of [this.samples,...this.shortcuts.map(s=>s.samples)])for(let i=1;i<samples.length;i++){
   const a=samples[i-1],b=samples[i];const minX=Math.floor(Math.min(a.x,b.x)/80),maxX=Math.floor(Math.max(a.x,b.x)/80),minZ=Math.floor(Math.min(a.z,b.z)/80),maxZ=Math.floor(Math.max(a.z,b.z)/80);
   for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=`${x}:${z}`,list=this.grid.get(key)??[];list.push({a,b});this.grid.set(key,list);}
  }
 }
 override widthAt(angle:number){const t=((angle/TAU)%1+1)%1,borders=[0,.13,.28,.45,.66,.84,1],widths=[23,16,22,15,28,24];
  const zone=Math.max(0,borders.findIndex((b,i)=>i>0&&t<b)-1);let width=widths[zone];
  for(let i=1;i<6;i++){const blend=.009;if(Math.abs(t-borders[i])<blend){const f=(t-borders[i]+blend)/(2*blend),smooth=f*f*(3-2*f);width=widths[i-1]+(widths[i]-widths[i-1])*smooth;}}
  return width;
 }
 private makeShortcut(id:string,from:number,to:number,width:number):Shortcut{
  const a=this.point(from),b=this.point(to),ha=this.heading(from),hb=this.heading(to),mid={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
  const curve=new CatmullRomCurve3([new Vector3(a.x,0,a.z),new Vector3(a.x+Math.sin(ha)*45,0,a.z+Math.cos(ha)*45),new Vector3(mid.x,0,mid.z),new Vector3(b.x-Math.sin(hb)*45,0,b.z-Math.cos(hb)*45),new Vector3(b.x,0,b.z)],false,'centripetal');curve.arcLengthDivisions=512;
  const samples=Array.from({length:129},(_,i)=>{const p=curve.getPointAt(i/128),h=curve.getTangentAt(i/128);return{x:p.x,z:p.z,angle:from+(to-from)*i/128,heading:Math.atan2(h.x,h.z),width,branch:id};});
  return{id,from,to,length:curve.getLength(),samples,width};
 }
 private at(angle:number,samples=this.samples){
  const normalized=((angle%TAU)+TAU)%TAU;let index:number,t:number;
  if(samples===this.samples){const f=normalized/TAU*(samples.length-1);index=Math.min(samples.length-2,Math.floor(f));t=f-index;}
  else{const f=Math.max(0,Math.min(1,(angle-samples[0].angle)/(samples[samples.length-1].angle-samples[0].angle)))*(samples.length-1);index=Math.min(samples.length-2,Math.floor(f));t=f-index;}
  const a=samples[index],b=samples[index+1],dx=b.x-a.x,dz=b.z-a.z;return{x:a.x+dx*t,z:a.z+dz*t,heading:Math.atan2(dx,dz),width:a.width,angle:normalized,branch:a.branch};
 }
 override point(angle:number,lane=0){const p=this.at(angle);return{x:p.x+Math.cos(p.heading)*lane,z:p.z-Math.sin(p.heading)*lane};}
 override heading(angle:number){return this.at(angle).heading;}
 project(p:Point){
  const gx=Math.floor(p.x/80),gz=Math.floor(p.z/80),candidates=new Set<{a:Sample;b:Sample}>();
  for(let x=gx-2;x<=gx+2;x++)for(let z=gz-2;z<=gz+2;z++)for(const s of this.grid.get(`${x}:${z}`)??[])candidates.add(s);
  if(!candidates.size)for(const list of this.grid.values())for(const s of list)candidates.add(s);
  let best={x:0,z:0,heading:0,width:0,angle:0,branch:null as string|null,offset:0,distance:Infinity};
  for(const {a,b} of candidates){const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l2)),x=a.x+dx*t,z=a.z+dz*t,distance=Math.hypot(p.x-x,p.z-z);
   if(distance<best.distance){const heading=Math.atan2(dx,dz);best={x,z,heading,width:a.width,angle:a.angle+(b.angle-a.angle)*t,branch:a.branch,offset:(p.x-x)*Math.cos(heading)-(p.z-z)*Math.sin(heading),distance};}
  }return best;
 }
 override angle(p:Point){let angle=this.project(p).angle;return angle>Math.PI?angle-TAU:angle;}
 override offset(p:Point){return this.project(p).offset;}
 override contains(p:Point,margin=0){const projection=this.project(p);return projection.distance<=projection.width-margin+1e-6;}
 override target(p:Point,distance:number,lane=0){const loc=this.project(p),shortcut=this.shortcuts.find(s=>s.id===loc.branch);
  if(shortcut){const angle=loc.angle+distance/shortcut.length*(shortcut.to-shortcut.from);if(angle<=shortcut.to){const q=this.at(angle,shortcut.samples);return{x:q.x+Math.cos(q.heading)*lane,z:q.z-Math.sin(q.heading)*lane};}}
  return this.point(loc.angle+distance/this.radius,lane);
 }
 override spawn(model:DrivingModel,angle=-.014,lane=0){super.spawn(model,angle,lane);model.worldLimit=3000;}
 override crossesGate(before:Point,after:Point,index:number){
  const angle=this.checkpointAngle(index),poses=[this.at(angle),...this.shortcuts.filter(s=>angle>s.from&&angle<s.to).map(s=>this.at(angle,s.samples))];
  return poses.some(g=>{const tx=Math.sin(g.heading),tz=Math.cos(g.heading),a=(before.x-g.x)*tx+(before.z-g.z)*tz,b=(after.x-g.x)*tx+(after.z-g.z)*tz;if(a>=0||b<0||b-a<1e-8)return false;const t=-a/(b-a),x=before.x+(after.x-before.x)*t,z=before.z+(after.z-before.z)*t;return Math.abs((x-g.x)*tz-(z-g.z)*tx)<=g.width&&this.contains({x,z});});
 }
 override constrain(model:DrivingModel){const p=this.project(model),margin=Math.max(1,.8+1.8*Math.abs(Math.sin(model.heading-p.heading))),limit=p.width-margin;if(p.distance<=limit)return false;
  const dx=model.x-p.x,dz=model.z-p.z,length=Math.max(.001,p.distance),nx=dx/length,nz=dz/length;
  model.x=p.x+nx*limit;model.z=p.z+nz*limit;const outward=model.vx*nx+model.vz*nz;if(outward>0){model.vx-=outward*nx;model.vz-=outward*nz;}model.speed*=.98;return true;
 }
}

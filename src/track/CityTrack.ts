import {CatmullRomCurve3,Vector3} from 'three';
import {Track,TAU,type Point} from './Track';
import type {DrivingModel} from '../player/DrivingModel';
import {elevation} from './Elevation';
interface Sample extends Point {angle:number;heading:number;width:number;branch:string|null}
export interface Shortcut {id:string;from:number;to:number;length:number;samples:Sample[];width:number;entryPortal?:number;exitPortal?:number}
export const DISTRICTS=['中央发车直道','摩天楼 S 弯','高架飞跃区','地下水道','开放港湾','终点冲刺'] as const;
/** Arc-length sampled closed spline; legacy circular Track is only a regression fixture. */
export class CityTrack extends Track {
 override readonly isSpline=true;
 override readonly name='曙光都市 · 立体六区 V2';
 override readonly vertical=true;
 override readonly checkpointCount=24;
 override readonly halfWidth=24;
 override readonly length:number;
 override readonly radius:number;
 readonly samples:Sample[];
 readonly shortcuts:Shortcut[];
 private grid=new Map<string,{a:Sample;b:Sample}[]>();
 private surfaces=new WeakMap<object,{x:number;z:number;height:number;slope:number;heading:number;branch:string|null;route?:string|null}>();
 constructor(){
  super();
  const points=[[-250,-450],[-250,-160],[-300,100],[-100,310],[-270,500],[-80,730],[240,860],[650,860],[940,660],[1190,400],[1100,110],[820,-90],[790,-310],[1100,-430],[1070,-700],[700,-910],[280,-920],[-80,-820],[-440,-750],[-560,-570]];
  const curve=new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x*.72,0,z*.72)),true,'centripetal');curve.arcLengthDivisions=4096;
  this.length=curve.getLength();this.radius=this.length/TAU;
  this.samples=Array.from({length:1025},(_,i)=>{const p=curve.getPointAt(i/1024),t=curve.getTangentAt(i/1024);return{x:p.x,z:p.z,angle:i/1024*TAU,heading:Math.atan2(t.x,t.z),width:this.widthAt(i/1024*TAU),branch:null};});
  this.shortcuts=[this.makeShortcut('tunnel-cut',.48*TAU,.60*TAU,7),this.makeShortcut('harbor-cut',.65*TAU,.86*TAU,8)];
  for(const s of this.samples)s.y=this.heightAt(s.angle);
  for(const cut of this.shortcuts)for(const s of cut.samples)s.y=this.heightAt(s.angle,cut.id);
  for(const samples of [this.samples,...this.shortcuts.map(s=>s.samples)])for(let i=1;i<samples.length;i++){
   const a=samples[i-1],b=samples[i];const minX=Math.floor(Math.min(a.x,b.x)/80),maxX=Math.floor(Math.max(a.x,b.x)/80),minZ=Math.floor(Math.min(a.z,b.z)/80),maxZ=Math.floor(Math.max(a.z,b.z)/80);
   for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=`${x}:${z}`,list=this.grid.get(key)??[];list.push({a,b});this.grid.set(key,list);}
  }
  for(const cut of this.shortcuts){const clear=cut.samples.map((p,i)=>({p,i})).filter(({p})=>{const main=this.project(p,null);return main.distance>main.width+Math.max(cut.width,7.5)+2;});cut.entryPortal=(clear[0]?.i??24)/128;cut.exitPortal=(clear.at(-1)?.i??104)/128;}
 }
 override widthAt(angle:number){const t=((angle/TAU)%1+1)%1,borders=[0,.13,.28,.45,.66,.84,1],widths=[23,16,22,15,28,24];
  const zone=Math.max(0,borders.findIndex((b,i)=>i>0&&t<b)-1);let width=widths[zone];
  for(let i=1;i<6;i++){const blend=.009;if(Math.abs(t-borders[i])<blend){const f=(t-borders[i]+blend)/(2*blend),smooth=f*f*(3-2*f);width=widths[i-1]+(widths[i]-widths[i-1])*smooth;}}
  return width;
 }
 private makeShortcut(id:string,from:number,to:number,width:number):Shortcut{
  const a=this.point(from),b=this.point(to),ha=this.heading(from),hb=this.heading(to),mid={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
  const local=(p:Point,h:number,forward:number,lateral:number)=>new Vector3(p.x+Math.sin(h)*forward+Math.cos(h)*lateral,0,p.z+Math.cos(h)*forward-Math.sin(h)*lateral);
  const points=[new Vector3(a.x,0,a.z),local(a,ha,45,0),new Vector3(mid.x+(id==='tunnel-cut'?12:0),0,mid.z),local(b,hb,-45,0),new Vector3(b.x,0,b.z)];
  const curve=new CatmullRomCurve3(points,false,'centripetal');curve.arcLengthDivisions=512;
  const samples=Array.from({length:129},(_,i)=>{const q=i/128,p=curve.getPointAt(q),h=curve.getTangentAt(q),offset=id==='tunnel-cut'?-40*Math.sin(Math.PI*q):0;return{x:p.x+h.z*offset,z:p.z-h.x*offset,angle:from+(to-from)*q,heading:Math.atan2(h.x,h.z),width:id==='harbor-cut'?6:width,branch:id};});
  let length=0;for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];length+=Math.hypot(b.x-a.x,b.z-a.z);a.heading=Math.atan2(b.x-a.x,b.z-a.z);}
  return{id,from,to,length,samples,width:id==='harbor-cut'?6:width};
 }
 heightAt(angle:number,route:string|null=null){const cut=route?this.shortcuts?.find(s=>s.id===route):undefined;return elevation(cut?(angle-cut.from)/(cut.to-cut.from):angle/TAU,cut?.length??this.length,route).height;}
 override surface(p:Point){const cached=this.surfaces.get(p);if(cached&&cached.x===p.x&&cached.z===p.z&&cached.route===p.route)return cached;const q=this.project(p),cut=this.shortcuts.find(s=>s.id===q.branch),e=elevation(cut?(q.angle-cut.from)/(cut.to-cut.from):q.angle/TAU,cut?.length??this.length,q.branch),value={x:p.x,z:p.z,route:p.route,...e,heading:q.heading,branch:q.branch};this.surfaces.set(p,value);return value;}
 private at(angle:number,samples=this.samples){
  const normalized=((angle%TAU)+TAU)%TAU;let index:number,t:number;
  if(samples===this.samples){const f=normalized/TAU*(samples.length-1);index=Math.min(samples.length-2,Math.floor(f));t=f-index;}
  else{const f=Math.max(0,Math.min(1,(angle-samples[0].angle)/(samples[samples.length-1].angle-samples[0].angle)))*(samples.length-1);index=Math.min(samples.length-2,Math.floor(f));t=f-index;}
  const a=samples[index],b=samples[index+1],dx=b.x-a.x,dz=b.z-a.z;return{x:a.x+dx*t,z:a.z+dz*t,heading:Math.atan2(dx,dz),width:a.width,angle:normalized,branch:a.branch};
 }
 override point(angle:number,lane=0){return this.routePoint(angle,lane,null);}
 routePoint(angle:number,lane=0,route:string|null=null){const cut=this.shortcuts?.find(s=>s.id===route),p=this.at(angle,cut?.samples);return{x:p.x+Math.cos(p.heading)*lane,z:p.z-Math.sin(p.heading)*lane,y:this.heightAt(angle,route),route};}
 override heading(angle:number){return this.at(angle).heading;}
 routeHeading(angle:number,route:string|null){return this.at(angle,this.shortcuts.find(s=>s.id===route)?.samples).heading;}
 project(p:Point,route?:string|null){
  if(route===undefined&&p.route!==undefined)route=p.route;
  const gx=Math.floor(p.x/80),gz=Math.floor(p.z/80),candidates=new Set<{a:Sample;b:Sample}>();
  for(let x=gx-2;x<=gx+2;x++)for(let z=gz-2;z<=gz+2;z++)for(const s of this.grid.get(`${x}:${z}`)??[])candidates.add(s);
  if(!candidates.size)for(const list of this.grid.values())for(const s of list)candidates.add(s);
  if(route!==undefined){let match=false;for(const c of candidates)if(c.a.branch===route){match=true;break;}if(!match)for(const list of this.grid.values())for(const s of list)if(s.a.branch===route)candidates.add(s);}
  let best={x:0,z:0,heading:0,width:0,angle:0,branch:null as string|null,offset:0,distance:Infinity};
  for(const {a,b} of candidates){const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l2)),x=a.x+dx*t,z=a.z+dz*t,distance=Math.hypot(p.x-x,p.z-z);
   if(route!==undefined&&a.branch!==route)continue;
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
 routeTarget(p:Point,distance:number,lane:number,route:string|null){
  const cut=this.shortcuts.find(s=>s.id===route);if(!cut)return this.point(this.project(p,null).angle+distance/this.radius,lane);
  const main=this.project(p,null),q=this.project(p,cut.id),toEntry=(cut.from-main.angle)*this.radius;
  if(toEntry>0&&toEntry<200&&q.angle<cut.from+.003){if(distance<toEntry)return this.point(main.angle+distance/this.radius,lane);return this.routePoint(cut.from+(distance-toEntry)/cut.length*(cut.to-cut.from),lane,cut.id);}
  const angle=q.angle+distance/cut.length*(cut.to-cut.from);
  return angle<cut.to?this.routePoint(angle,lane,cut.id):this.point(cut.to+(angle-cut.to)/(cut.to-cut.from)*cut.length/this.radius,lane);
 }
 override spawn(model:DrivingModel,angle=-.014,lane=0){super.spawn(model,angle,lane);model.worldLimit=3000;model.route=null;model.y=this.heightAt(angle);}
 override raceRoute(before:Point,after:Point,active:string|null){
  const current=this.shortcuts.find(s=>s.id===active);
  if(current){const q=this.project(after,current.id);if(q.distance>current.width+4)return null;const end=current.samples.at(-1)!,along=(after.x-end.x)*Math.sin(end.heading)+(after.z-end.z)*Math.cos(end.heading);return q.angle>current.to-.002&&along>=0?null:active;}
  for(const cut of this.shortcuts){if(after.routeIntent!==undefined&&after.routeIntent!==cut.id)continue;const first=cut.samples[0],q=this.project(after,cut.id);if(Math.hypot(before.x-first.x,before.z-first.z)>65||q.distance>cut.width||q.angle>cut.from+(cut.to-cut.from)*.10)continue;
   if(after.routeIntent===undefined&&q.distance+.5>=this.project(after,null).distance)continue;
   const forward=(after.x-before.x)*Math.sin(first.heading)+(after.z-before.z)*Math.cos(first.heading);if(forward>0&&q.angle>cut.from+.00001&&Math.abs((after.y??0)-this.heightAt(q.angle,cut.id))<2)return cut.id;
  }return null;
 }
 override raceAngle(p:Point,route:string|null){const a=this.project(p,route).angle;return a>Math.PI?a-TAU:a;}
 override crossesGate(before:Point,after:Point,index:number,route?:string|null){
  const angle=this.checkpointAngle(index),poses=[this.at(angle),...this.shortcuts.filter(s=>angle>s.from&&angle<s.to).map(s=>this.at(angle,s.samples))];
  return poses.some(g=>{if(route!==undefined&&g.branch!==route)return false;const tx=Math.sin(g.heading),tz=Math.cos(g.heading),a=(before.x-g.x)*tx+(before.z-g.z)*tz,b=(after.x-g.x)*tx+(after.z-g.z)*tz;if(a>=0||b<0||b-a<1e-8)return false;const t=-a/(b-a),x=before.x+(after.x-before.x)*t,z=before.z+(after.z-before.z)*t,y=before.y===undefined||after.y===undefined?undefined:before.y+(after.y-before.y)*t,floor=this.heightAt(angle,g.branch);return (y===undefined||(y>=floor-.8&&y<=floor+24))&&Math.abs((x-g.x)*tz-(z-g.z)*tx)<=g.width&&this.contains({x,z});});
 }
 override constrain(model:DrivingModel){const p=this.project(model),margin=Math.max(1,.8+1.8*Math.abs(Math.sin(model.heading-p.heading))),limit=p.width-margin;if(p.distance<=limit)return false;
  const dx=model.x-p.x,dz=model.z-p.z,length=Math.max(.001,p.distance),nx=dx/length,nz=dz/length;
  model.x=p.x+nx*limit;model.z=p.z+nz*limit;const outward=model.vx*nx+model.vz*nz;if(outward>0){model.vx-=outward*nx;model.vz-=outward*nz;}model.speed*=.98;return true;
 }
}

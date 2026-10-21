import {CatmullRomCurve3,CubicBezierCurve3,Vector3} from 'three';
import {Track,TAU,type Point} from './Track';
import type {DrivingModel} from '../player/DrivingModel';
import {elevation} from './Elevation';
interface Sample extends Point {angle:number;heading:number;width:number;branch:string|null}
type Segment={a:Sample;b:Sample};
interface Projection{x:number;z:number;heading:number;width:number;angle:number;branch:string|null;offset:number;distance:number}
export interface Shortcut {id:string;from:number;to:number;length:number;samples:Sample[];width:number;entryPortal?:number;exitPortal?:number}
export const DISTRICTS=['中央发车直道','摩天楼 S 弯','高架飞跃区','地下水道','开放港湾','终点冲刺'] as const;
/** Arc-length sampled closed spline; legacy circular Track is only a regression fixture. */
export class CityTrack extends Track {
 override readonly isSpline=true;
 override readonly name='曙光都市 · 立体六区 V3';
 override readonly vertical=true;
 override readonly checkpointCount=24;
 override readonly halfWidth=24;
 override readonly length:number;
 override readonly radius:number;
 readonly samples:Sample[];
 readonly shortcuts:Shortcut[];
 private grid=new Map<string,Segment[]>();
 private projectionCells=new Map<string,Map<string|null|undefined,Segment[]>>();
 private allSegments?:Segment[];
 private maximumWidth=0;
 private projections=new WeakMap<Point,{x:number;z:number;values:Map<string|null|undefined,Projection>}>();
 private surfaces=new WeakMap<object,{x:number;z:number;y?:number;height:number;slope:number;heading:number;branch:string|null;route?:string|null}>();
 constructor(){
  super();
  const points=[[-250,-450],[-250,-160],[-300,100],[-100,310],[-270,500],[-80,730],[240,860],[650,860],[940,660],[1190,400],[1100,110],[820,-90],[790,-310],[1100,-430],[1070,-700],[700,-640],[280,-920],[-80,-820],[-440,-750],[-560,-570]];
  const curve=new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x*.72,0,z*.72)),true,'centripetal');curve.arcLengthDivisions=4096;
  this.length=curve.getLength();this.radius=this.length/TAU;
  this.samples=Array.from({length:1025},(_,i)=>{const p=curve.getPointAt(i/1024),t=curve.getTangentAt(i/1024);return{x:p.x,z:p.z,angle:i/1024*TAU,heading:Math.atan2(t.x,t.z),width:this.widthAt(i/1024*TAU),branch:null};});
  this.shortcuts=[this.makeShortcut('tunnel-cut',.48*TAU,.61*TAU,7),this.makeShortcut('harbor-cut',.65*TAU,.86*TAU,8)];
  for(const s of this.samples)s.y=this.heightAt(s.angle);
  for(const cut of this.shortcuts)for(const s of cut.samples)s.y=this.heightAt(s.angle,cut.id);
  for(const samples of [this.samples,...this.shortcuts.map(s=>s.samples)])for(let i=1;i<samples.length;i++){
   const a=samples[i-1],b=samples[i];const minX=Math.floor(Math.min(a.x,b.x)/80),maxX=Math.floor(Math.max(a.x,b.x)/80),minZ=Math.floor(Math.min(a.z,b.z)/80),maxZ=Math.floor(Math.max(a.z,b.z)/80);
   this.maximumWidth=Math.max(this.maximumWidth,a.width,b.width);
   for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=`${x}:${z}`,list=this.grid.get(key)??[];list.push({a,b});this.grid.set(key,list);}
  }
  for(const cut of this.shortcuts){const clear=cut.samples.map((p,i)=>({p,i})).filter(({p})=>{const main=this.project(p,null);return main.distance>main.width+Math.max(cut.width,7.5)+2;});cut.entryPortal=(clear[0]?.i??24)/128;cut.exitPortal=(clear.at(-1)?.i??104)/128;}
 }
 override widthAt(angle:number){const t=((angle/TAU)%1+1)%1,borders=[0,.13,.28,.45,.66,.84,1],widths=[23,16,22,15,28,24];
  const zone=Math.max(0,borders.findIndex((b,i)=>i>0&&t<b)-1);let width=widths[zone];
  for(let i=1;i<6;i++){const blend=.009;if(Math.abs(t-borders[i])<blend){const f=(t-borders[i]+blend)/(2*blend),smooth=f*f*(3-2*f);width=widths[i-1]+(widths[i]-widths[i-1])*smooth;}}
  // Separate the elevated branch's low entrance from the lower harbor canal.
  const edge=Math.min(t-.643,.707-t),blend=Math.max(0,Math.min(1,edge/.012));
  width+=(12-width)*blend*blend*(3-2*blend);
  const merge=Math.max(0,1-Math.abs(t-.61)/.017);return width+(20-width)*merge*merge*(3-2*merge);
 }
 private makeShortcut(id:string,from:number,to:number,width:number):Shortcut{
  const a=this.point(from),b=this.point(to),ha=this.heading(from),hb=this.heading(to),mid={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
  const local=(p:Point,h:number,forward:number,lateral:number)=>new Vector3(p.x+Math.sin(h)*forward+Math.cos(h)*lateral,0,p.z+Math.cos(h)*forward-Math.sin(h)*lateral);
  const points=id==='harbor-cut'?[new Vector3(a.x,0,a.z),local(a,ha,15,0),local(a,ha,90,-20),new Vector3(mid.x,0,mid.z),local(b,hb,-45,0),new Vector3(b.x,0,b.z)]:[new Vector3(a.x,0,a.z),local(a,ha,45,0),new Vector3(mid.x+12,0,mid.z),local(b,hb,-45,0),new Vector3(b.x,0,b.z)];
  const curve=id==='tunnel-cut'?new CubicBezierCurve3(new Vector3(a.x,0,a.z),local(a,ha,80,0),local(b,hb,-240,0),new Vector3(b.x,0,b.z)):new CatmullRomCurve3(points,false,'centripetal');curve.arcLengthDivisions=2048;
  const distance=curve.getLength(),samples=Array.from({length:129},(_,i)=>{const q=i/128,p=curve.getPointAt(q),h=curve.getTangentAt(q),u=Math.max(0,(q-.82)/.18),smooth=u*u*u*(10-15*u+6*u*u);
   // Blend position and its first two derivatives onto the actual main canal.
   // No post-spline lateral sine offset: it created a cusp at the old exit.
   if(id==='tunnel-cut'&&u>0){const main=this.point(to-(1-q)*distance/this.radius);p.lerp(new Vector3(main.x,0,main.z),smooth);}
   return{x:p.x,z:p.z,angle:from+(to-from)*q,heading:Math.atan2(h.x,h.z),width:id==='harbor-cut'?6:width+5*smooth,branch:id};});
  let length=0;for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];length+=Math.hypot(b.x-a.x,b.z-a.z);a.heading=Math.atan2(b.x-a.x,b.z-a.z);}
  return{id,from,to,length,samples,width:id==='harbor-cut'?6:width};
 }
 heightAt(angle:number,route:string|null=null){const cut=route?this.shortcuts?.find(s=>s.id===route):undefined;return elevation(cut?(angle-cut.from)/(cut.to-cut.from):angle/TAU,cut?.length??this.length,route).height;}
 override surface(p:Point){const cached=this.surfaces.get(p);if(cached&&cached.x===p.x&&cached.z===p.z&&cached.y===p.y&&cached.route===p.route)return cached;const q=this.physicalProjection(p),cut=this.shortcuts.find(s=>s.id===q.branch),e=elevation(cut?(q.angle-cut.from)/(cut.to-cut.from):q.angle/TAU,cut?.length??this.length,q.branch),value={x:p.x,z:p.z,y:p.y,route:p.route,...e,heading:q.heading,branch:q.branch};this.surfaces.set(p,value);return value;}
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
 routeWidth(angle:number,route:string|null){return this.at(angle,this.shortcuts.find(s=>s.id===route)?.samples).width;}
 project(p:Point,route?:string|null){
  if(route===undefined&&p.route!==undefined)route=p.route;
  let cached=this.projections.get(p);
  if(!cached||cached.x!==p.x||cached.z!==p.z){cached={x:p.x,z:p.z,values:new Map()};this.projections.set(p,cached);}
  const previous=cached.values.get(route);if(previous)return{...previous};
  const gx=Math.floor(p.x/80),gz=Math.floor(p.z/80),key=`${gx}:${gz}`;
  let cell=this.projectionCells.get(key);if(!cell){cell=new Map();this.projectionCells.set(key,cell);}
  let candidates=cell.get(route);
  if(!candidates){
   // The course is immutable. Reuse the identical ordered broad-phase list for
   // every point in a grid cell, including the original distant-route fallback.
   const nearby=new Set<Segment>();
   for(let x=gx-2;x<=gx+2;x++)for(let z=gz-2;z<=gz+2;z++)for(const s of this.grid.get(`${x}:${z}`)??[])nearby.add(s);
   if(!this.allSegments)this.allSegments=[...new Set([...this.grid.values()].flat())];
   const rows=nearby.size?[...nearby]:this.allSegments;
   candidates=route===undefined?rows:rows.filter(s=>s.a.branch===route);
   if(route!==undefined&&!candidates.length)candidates=this.allSegments.filter(s=>s.a.branch===route);
   cell.set(route,candidates);
   // Keep free-roaming or external tooling from growing an unbounded cell cache.
   if(this.projectionCells.size>4096)this.projectionCells.delete(this.projectionCells.keys().next().value!);
  }
  let best={x:0,z:0,heading:0,width:0,angle:0,branch:null as string|null,offset:0,distance:Infinity},winner:Segment|undefined;
  for(const segment of candidates){const {a,b}=segment,dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l2)),x=a.x+dx*t,z=a.z+dz*t,px=p.x-x,pz=p.z-z;
   // Retain original hypot rounding and tie order for possible winners; reject
   // distant segments using squares before paying for a square root/hypot.
   if(px*px+pz*pz>best.distance*best.distance*(1+8*Number.EPSILON)+1e-10)continue;
   const distance=Math.hypot(px,pz);
   if(distance<best.distance){best.x=x;best.z=z;best.distance=distance;best.width=a.width;best.angle=a.angle+(b.angle-a.angle)*t;best.branch=a.branch;winner=segment;}
  }
  if(winner){const {a,b}=winner;best.heading=Math.atan2(b.x-a.x,b.z-a.z);best.offset=(p.x-best.x)*Math.cos(best.heading)-(p.z-best.z)*Math.sin(best.heading);}
  cached.values.set(route,best);return{...best};
 }
 override angle(p:Point){let angle=this.project(p).angle;return angle>Math.PI?angle-TAU:angle;}
 override offset(p:Point){return this.project(p).offset;}
 override contains(p:Point,margin=0){
  // Reject only points outside every possible expanded segment rectangle.
  // This avoids querying distant shortcuts for the thousands of dry-land cells
  // used by scenery generation. Junction and height rules below stay intact.
  const radius=this.maximumWidth-margin+1e-6;
  if(radius>=0&&radius<80){
   const gx=Math.floor(p.x/80),gz=Math.floor(p.z/80);let possible=false;
   search:for(let x=gx-1;x<=gx+1;x++)for(let z=gz-1;z<=gz+1;z++)for(const {a,b} of this.grid.get(`${x}:${z}`)??[]){
    const r=a.width-margin+1e-6;
    if(p.x>=Math.min(a.x,b.x)-r&&p.x<=Math.max(a.x,b.x)+r&&p.z>=Math.min(a.z,b.z)-r&&p.z<=Math.max(a.z,b.z)+r){possible=true;break search;}
   }
   if(!possible)return false;
  }
  const projection=this.project(p);if(projection.distance<=projection.width-margin+1e-6)return true;
  if(p.route!==undefined){const q=this.containmentProjection(p);return q.distance<=q.width-margin+1e-6;}
  // A nearby narrow branch must not mask a valid point inside the wider main canal.
  return [null,...this.shortcuts.map(s=>s.id)].some(route=>{const q=this.project(p,route);return q.distance<=q.width-margin+1e-6;});
 }
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
 override raceRoute(before:Point,after:Point,active:string|null,entered?:ReadonlySet<string>){
  const current=this.shortcuts.find(s=>s.id===active);
  if(current){const q=this.project(after,current.id);if(q.distance>q.width+4)return null;const end=current.samples.at(-1)!,along=(after.x-end.x)*Math.sin(end.heading)+(after.z-end.z)*Math.cos(end.heading);return q.angle>current.to-.002&&along>=0?null:active;}
  for(const cut of this.shortcuts){if(after.routeIntent!==undefined&&after.routeIntent!==cut.id)continue;const q=this.project(after,cut.id);
   // The two centre lines can coincide for longer than the old 10%/65m
   // acquisition window. Keep entry open until the channels really separate.
   // A real jump/drift may temporarily leave this narrow corridor. Remember a
   // legal entrance for this lap so returning downstream can reacquire it;
   // boats that never entered still have to use the original entrance window.
   if(q.distance>q.width||(!entered?.has(cut.id)&&q.angle>cut.from+(cut.to-cut.from)*Math.max(.15,cut.entryPortal??.15)))continue;
   if(after.routeIntent===undefined&&q.distance+.5>=this.project(after,null).distance)continue;
   const forward=(after.x-before.x)*Math.sin(q.heading)+(after.z-before.z)*Math.cos(q.heading);if(forward>0&&q.angle>cut.from+.00001&&Math.abs((after.y??0)-this.heightAt(q.angle,cut.id))<2)return cut.id;
  }return null;
 }
 override raceAngle(p:Point,route:string|null){const a=this.project(p,route).angle;return a>Math.PI?a-TAU:a;}
 override checkpointRequired(index:number){
  const angle=this.checkpointAngle(index);
  // The whole connected fork-to-merge area is free choice, including the
  // lower S2 crossing. Its branches reach the old sector planes at different
  // places, so requiring those planes strands boats that switch waterways.
  // The gates before each fork and after each merge remain mandatory.
  return !this.shortcuts.some(cut=>angle>cut.from&&angle<cut.to);
 }
 override crossesGate(before:Point,after:Point,index:number,route?:string|null){
  const angle=this.checkpointAngle(index),poses=[this.at(angle),...this.shortcuts.filter(s=>angle>s.from&&angle<s.to).map(s=>this.at(angle,s.samples))];
  // A shortcut tag can be acquired while its mouth still overlaps the main
  // canal. Always accept an actual forward crossing of the main-road gate;
  // otherwise a player who stays on that road can get stuck at CP12 forever.
  // Shortcut-only gates still require a legally acquired branch, so spawning
  // into an unentered shortcut cannot grant checkpoint credit.
  return poses.some(g=>{if(g.branch!==null&&route!==undefined&&g.branch!==route)return false;const tx=Math.sin(g.heading),tz=Math.cos(g.heading),a=(before.x-g.x)*tx+(before.z-g.z)*tz,b=(after.x-g.x)*tx+(after.z-g.z)*tz;if(a>=0||b<0||b-a<1e-8)return false;const t=-a/(b-a),x=before.x+(after.x-before.x)*t,z=before.z+(after.z-before.z)*t,y=before.y===undefined||after.y===undefined?undefined:before.y+(after.y-before.y)*t,floor=this.heightAt(angle,g.branch);return (y===undefined||(y>=floor-.8&&y<=floor+24))&&Math.abs((x-g.x)*tz-(z-g.z)*tx)<=g.width&&this.contains({x,z});});
 }
 private physicalProjection(model:Point,preferred=this.project(model)){
  if(model.y===undefined)return preferred;
  const onSurface=(q:Projection)=>q.distance<=q.width&&Math.abs(this.heightAt(q.angle,q.branch)-model.y!)<=1;
  if(onSurface(preferred))return preferred;
  // Route tags can lag behind a change of direction. Recover the water under
  // the boat before selecting a bank or ramp, rather than a distant tagged lane.
  let physical:Projection|undefined;
  for(const route of [null,...this.shortcuts.map(s=>s.id)]){
   const q=this.project(model,route);
   if(onSurface(q)&&(!physical||Math.abs(this.heightAt(q.angle,q.branch)-model.y)<Math.abs(this.heightAt(physical.angle,physical.branch)-model.y)))physical=q;
  }
  // In flight no surface need be at the boat's height. Keep the established
  // route in that case so an unrelated deck cannot capture the jump.
  return physical??preferred;
 }
 private containmentProjection(model:Point,heading?:number,preferred=this.project(model)){let p=preferred;const physical=this.physicalProjection(model,preferred),height=this.heightAt(physical.angle,physical.branch);
  if(Math.abs(this.heightAt(p.angle,p.branch)-height)>1)p=physical;
  const clearance=(q:Projection)=>q.width-q.distance-(heading===undefined?0:Math.max(1,.8+1.8*Math.abs(Math.sin(heading-q.heading))));
  // At a junction the physical water is the union of both corridors. RaceRoute
  // commits the chosen branch only AFTER this step: clipping to the old route
  // first could push a fast player back before that choice was ever recorded.
  // The visible banks are clipped by actual corridor overlap, not by progress
  // percentages. Use the same geometric union everywhere, even with a stale
  // route tag or when approaching a mouth sideways or in reverse.
  for(const route of [null,...this.shortcuts.map(s=>s.id)]){
   const other=this.project(model,route);
   if(Math.abs(this.heightAt(other.angle,other.branch)-height)>1)continue;
   // Keep the current side for ordinary scrapes (at most the widest hull
   // margin, 2.6m). Beyond that, a stale tag must not pull the boat across a
   // divider: recover at the nearer compatible bank even if its hull clips it.
   // Scripted AI already supplies an explicit route intent; keep its existing
   // recovery side rather than changing the tuned AI's cornering trajectory.
   const otherClearance=clearance(other);
   if(otherClearance>clearance(p)&&(heading===undefined||otherClearance>=0||model.routeIntent===undefined&&clearance(p)<-2.6))p=other;
  }
  return p;
 }
 override constrain(model:DrivingModel){
  const preferred=this.project(model),safe=preferred.distance<=preferred.width-Math.max(1,.8+1.8*Math.abs(Math.sin(model.heading-preferred.heading)));
  // Most steps stay safely inside the current waterway. The full junction union
  // cannot add a collision here, so avoid projecting onto both distant branches.
  // Height mismatch must still take the full path for stale tags/stacked decks.
  if(safe&&(model.y===undefined||Math.abs(this.heightAt(preferred.angle,preferred.branch)-model.y)<=1))return false;
  const p=this.containmentProjection(model,model.heading,preferred),margin=Math.max(1,.8+1.8*Math.abs(Math.sin(model.heading-p.heading))),limit=p.width-margin;if(p.distance<=limit)return false;
  const dx=model.x-p.x,dz=model.z-p.z,length=Math.max(.001,p.distance),nx=dx/length,nz=dz/length;
  model.x=p.x+nx*limit;model.z=p.z+nz*limit;const outward=model.vx*nx+model.vz*nz;if(outward>0){model.vx-=outward*nx;model.vz-=outward*nz;}model.speed*=.98;return true;
 }
}


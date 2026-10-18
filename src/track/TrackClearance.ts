import{CityTrack}from'./CityTrack';import{CITY_RAMPS}from'./JumpLayout';import{NATURAL_JUMPS,elevation}from'./Elevation';import{TAU}from'./Track';
export interface StructureBox{x:number;y:number;z:number;width:number;height:number;depth:number;heading?:number}
interface Volume{ax:number;az:number;bx:number;bz:number;low:number;high:number;radius:number;kind:'surface'|'flight'|'landing';id:string}
/** Startup-only 3D swept corridors. Independent of the query point's route metadata. */
export class TrackClearance{
 readonly volumes:Volume[]=[];private grid=new Map<string,Volume[]>();
 constructor(readonly track:CityTrack){
  const routes=[{id:null,samples:track.samples},...track.shortcuts.map(c=>({id:c.id,samples:c.samples}))];
  for(const r of routes)for(let i=1;i<r.samples.length;i++){const a=r.samples[i-1],b=r.samples[i];if(Math.abs((a.y??0)-(b.y??0))>2)continue;this.add({ax:a.x,az:a.z,bx:b.x,bz:b.z,low:Math.min(a.y??0,b.y??0)-.75,high:Math.max(a.y??0,b.y??0)+6,radius:Math.max(a.width,b.width)+.7,kind:'surface',id:r.id??'main'});}
  for(const r of CITY_RAMPS)for(const speed of [25,40,50,60]){
   const vy=('liftBase'in r?r.liftBase:4)+speed*('liftFactor'in r?r.liftFactor:.14);this.flight(r.id,r.t*TAU,null,r.height,vy,speed);
  }
  for(const j of NATURAL_JUMPS)for(const speed of [25,40,50,60]){const cut=track.shortcuts.find(c=>c.id===j.route),angle=cut?cut.from+(cut.to-cut.from)*j.t:j.t*TAU,length=cut?.length??track.length,grade=elevation(j.t-1e-7,length,j.route).slope;this.flight(j.id,angle,j.route,j.height,Math.max(0,grade*speed),speed);}
 }
 private add(v:Volume){this.volumes.push(v);for(let x=Math.floor((Math.min(v.ax,v.bx)-v.radius)/80);x<=Math.floor((Math.max(v.ax,v.bx)+v.radius)/80);x++)for(let z=Math.floor((Math.min(v.az,v.bz)-v.radius)/80);z<=Math.floor((Math.max(v.az,v.bz)+v.radius)/80);z++){const key=`${x}:${z}`,list=this.grid.get(key)??[];list.push(v);this.grid.set(key,list);}}
 private flight(id:string,angle:number,route:string|null,height:number,vy:number,speed:number){
  const t=this.track,cut=t.shortcuts.find(c=>c.id===route),advance=(distance:number)=>angle+distance/(cut?.length??t.length)*(cut?cut.to-cut.from:TAU),duration=(vy+Math.sqrt(vy*vy+28*height))/14;
  for(let distance=-5;distance<speed*duration+45;distance+=4){const aa=advance(distance),bb=advance(distance+4),a=t.routePoint(aa,0,route),b=t.routePoint(bb,0,route),time=Math.max(0,distance/speed),next=Math.max(0,(distance+4)/speed),y=Math.max(a.y??0,height+vy*time-7*time*time),y2=Math.max(b.y??0,height+vy*next-7*next*next),inAir=time<duration;
   this.add({ax:a.x,az:a.z,bx:b.x,bz:b.z,low:Math.min(y,y2)-1,high:Math.max(y,y2)+5.5,radius:Math.max(t.routeWidth(aa,route),t.routeWidth(bb,route))+1,kind:inAir?'flight':'landing',id});
  }
 }
 conflicts(box:StructureBox){
  const h=box.heading??0,c=Math.cos(h),s=Math.sin(h),ex=(Math.abs(c)*box.width+Math.abs(s)*box.depth)/2,ez=(Math.abs(s)*box.width+Math.abs(c)*box.depth)/2,candidates=new Set<Volume>();
  for(let x=Math.floor((box.x-ex)/80);x<=Math.floor((box.x+ex)/80);x++)for(let z=Math.floor((box.z-ez)/80);z<=Math.floor((box.z+ez)/80);z++)for(const v of this.grid.get(`${x}:${z}`)??[])candidates.add(v);
  return [...candidates].filter(v=>{if(box.y+box.height/2<=v.low||box.y-box.height/2>=v.high)return false;
   const local=(x:number,z:number)=>[(x-box.x)*c-(z-box.z)*s,(x-box.x)*s+(z-box.z)*c],a=local(v.ax,v.az),b=local(v.bx,v.bz),extent=[box.width/2+v.radius,box.depth/2+v.radius];let enter=0,exit=1;
   for(let i=0;i<2;i++){const d=b[i]-a[i];if(Math.abs(d)<1e-8){if(Math.abs(a[i])>extent[i])return false;}else{const u=(-extent[i]-a[i])/d,w=(extent[i]-a[i])/d;enter=Math.max(enter,Math.min(u,w));exit=Math.min(exit,Math.max(u,w));}}return enter<=exit;
  });
 }
 intersects(box:StructureBox){return this.conflicts(box).length>0;}
 /** Deck framing may touch its own conservative submerged-hull buffer, while
  * remaining below the actual underside. Every other route/flight stays strict. */
 underDeckClear(box:StructureBox,route:string|null,floor:number){
  return box.y+box.height/2<=floor-.5&&this.conflicts(box).every(v=>v.kind==='surface'&&v.id===(route??'main')&&v.low>=floor-1.5);
 }
 overhead(x:number,z:number,width:number,depth:number,heading:number,minimum:number){let y=minimum;for(let i=0;i<40&&this.intersects({x,y,z,width,depth,height:.8,heading});i++)y+=1;if(this.intersects({x,y,z,width,depth,height:.8,heading}))throw Error('No overhead clearance within structure adjustment limit');return y;}
}
const cache=new WeakMap<CityTrack,TrackClearance>();
export function trackClearance(track:CityTrack){let value=cache.get(track);if(!value){value=new TrackClearance(track);cache.set(track,value);}return value;}

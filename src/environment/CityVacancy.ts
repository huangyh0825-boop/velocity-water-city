import{CityTrack}from'../track/CityTrack';
import{siteWorld,districtAt}from'./WorldCityLayout';
import{cityServices}from'./CityServicesLayout';
import{type CitySite,type Footprint}from'./CityDensityLayout';
import{trackClearance}from'../track/TrackClearance';
export interface GroundCell{x:number;z:number;district:string;angle:number;side:number;heading:number}
const cache=new WeakMap<CitySite[],GroundCell[]>();
/** Audit the actual generated land union, within 115m of a legal canal. Water,
 * buildings and flight clearances are not misreported as unused civic space. */
export function publicGroundCells(track:CityTrack,sites:CitySite[]){
 const cached=cache.get(sites);if(cached)return cached;
 const candidates=new Set<string>();for(const s of[...sites.filter(s=>s.id.startsWith('world-')),...cityServices(track)]){
  const p=siteWorld(track,s),r=Math.hypot(s.rx,s.rz)+18;
  for(let i=Math.floor((p.x-r)/5);i<=Math.ceil((p.x+r)/5);i++)for(let j=Math.floor((p.z-r)/5);j<=Math.ceil((p.z+r)/5);j++)candidates.add(`${i}:${j}`);
 }
 const clear=trackClearance(track),dry=new Map<string,boolean>(),outside=(x:number,z:number)=>{const key=`${x}:${z}`;let value=dry.get(key);if(value===undefined){value=!track.contains({x,z},-1.5);dry.set(key,value)}return value;},cells:GroundCell[]=[];
 for(const key of candidates){const[i,j]=key.split(':').map(Number),x=i*5+2.5,z=j*5+2.5,q=track.project({x,z});if(q.distance>115)continue;
  if(!outside(x,z)||[-1,1].some(u=>[-1,1].some(v=>!outside(x+u*2.5,z+v*2.5))))continue;
  if(clear.intersects({x,z,y:3.5,width:5,depth:5,height:7}))continue;
  cells.push({x,z,district:districtAt(q.angle).id,angle:q.angle,side:Math.sign(q.offset)||1,heading:q.heading});
 }cache.set(sites,cells);return cells;
}
export function insideFootprint(p:{x:number;z:number},s:Footprint,margin=0){const x=p.x-s.x,z=p.z-s.z,c=Math.cos(s.heading),h=Math.sin(s.heading);return Math.abs(x*c-z*h)<=s.rx+margin&&Math.abs(x*h+z*c)<=s.rz+margin;}
/** Reproducible coverage, including connected empty plots; paths remain usable.
 * This is a geometry audit, not a claim that every visible camera is finished. */
export function vacancySurvey(track:CityTrack,sites:CitySite[],spaces:Footprint[]){
 const occupied=[...sites,...cityServices(track)].map(s=>({...s,...siteWorld(track,s)})),all=publicGroundCells(track,sites),grid=new Map<string,Footprint[]>();
 for(const s of[...occupied,...spaces]){const r=Math.hypot(s.rx,s.rz);for(let x=Math.floor((s.x-r)/32);x<=Math.floor((s.x+r)/32);x++)for(let z=Math.floor((s.z-r)/32);z<=Math.floor((s.z+r)/32);z++){const k=`${x}:${z}`,a=grid.get(k)??[];a.push(s);grid.set(k,a)}}
 const free=all.filter(p=>!(grid.get(`${Math.floor(p.x/32)}:${Math.floor(p.z/32)}`)??[]).some(s=>insideFootprint(p,s,1))),remaining=new Map(free.map(p=>[`${Math.floor(p.x/5)}:${Math.floor(p.z/5)}`,p])),plots:{area:number;x:number;z:number;district:string}[]=[];
 for(const[key,p]of remaining){if(!remaining.delete(key))continue;const queue=[p];let x=0,z=0;for(let n=0;n<queue.length;n++){const q=queue[n],i=Math.floor(q.x/5),j=Math.floor(q.z/5);x+=q.x;z+=q.z;for(const[u,v]of[[1,0],[-1,0],[0,1],[0,-1]]){const k=`${i+u}:${j+v}`,next=remaining.get(k);if(next){remaining.delete(k);queue.push(next)}}}if(queue.length>=8)plots.push({area:queue.length*25,x:x/queue.length,z:z/queue.length,district:p.district})}
 return{sampleCellMetres:5,rangeMetres:115,cells:all.length,freeCells:free.length,freeArea:free.length*25,plots:plots.sort((a,b)=>b.area-a.area),districts:[...new Set(all.map(p=>p.district))].map(d=>({district:d,landArea:all.filter(p=>p.district===d).length*25,freeArea:free.filter(p=>p.district===d).length*25})),free};
}

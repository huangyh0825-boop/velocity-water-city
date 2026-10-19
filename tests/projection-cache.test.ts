import {test} from 'node:test';import assert from 'node:assert/strict';
import {CityTrack} from '../src/track/CityTrack';import type {Point} from '../src/track/Track';

// Independent copy of the previous broad-phase query, including grid traversal
// order, ties, empty-cell fallback, requested-route fallback and route metadata.
function reference(track:CityTrack){
 type Sample=CityTrack['samples'][number];type Segment={a:Sample;b:Sample};const grid=new Map<string,Segment[]>();
 for(const samples of [track.samples,...track.shortcuts.map(c=>c.samples)])for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i];
  for(let x=Math.floor(Math.min(a.x,b.x)/80);x<=Math.floor(Math.max(a.x,b.x)/80);x++)for(let z=Math.floor(Math.min(a.z,b.z)/80);z<=Math.floor(Math.max(a.z,b.z)/80);z++){const k=`${x}:${z}`,rows=grid.get(k)??[];rows.push({a,b});grid.set(k,rows);}
 }
 return (p:Point,route?:string|null)=>{
  route=route===undefined&&p.route!==undefined?p.route:route;const gx=Math.floor(p.x/80),gz=Math.floor(p.z/80),candidates=new Set<Segment>();
  for(let x=gx-2;x<=gx+2;x++)for(let z=gz-2;z<=gz+2;z++)for(const row of grid.get(`${x}:${z}`)??[])candidates.add(row);
  if(!candidates.size)for(const rows of grid.values())for(const row of rows)candidates.add(row);
  if(route!==undefined&&![...candidates].some(s=>s.a.branch===route))for(const rows of grid.values())for(const row of rows)if(row.a.branch===route)candidates.add(row);
  let best={x:0,z:0,heading:0,width:0,angle:0,branch:null as string|null,offset:0,distance:Infinity};
  for(const {a,b} of candidates){if(route!==undefined&&a.branch!==route)continue;const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz))),x=a.x+dx*t,z=a.z+dz*t,distance=Math.hypot(p.x-x,p.z-z);
   if(distance<best.distance){const heading=Math.atan2(dx,dz);best={x,z,heading,width:a.width,angle:a.angle+(b.angle-a.angle)*t,branch:a.branch,offset:(p.x-x)*Math.cos(heading)-(p.z-z)*Math.sin(heading),distance};}
  }return best;
 };
}
test('cached projection returns every original field exactly for dry land, junctions, remote routes and moving query objects',()=>{
 const track=new CityTrack(),old=reference(track);let seed=7907;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const p:Point={x:0,z:0};for(let i=0;i<1200;i++){
  p.x=rand()*3000-1400;p.z=rand()*3000-1400;p.route=[undefined,null,'tunnel-cut','harbor-cut'][i%4];
  for(const route of [undefined,null,'tunnel-cut','harbor-cut'])assert.deepEqual(track.project(p,route),old(p,route));
 }
 for(const samples of [track.samples,...track.shortcuts.map(c=>c.samples)])for(let i=0;i<samples.length;i+=7)for(const lane of [-1,0,1]){
  const s=samples[i],p={x:s.x+Math.cos(s.heading)*s.width*lane,z:s.z-Math.sin(s.heading)*s.width*lane};assert.deepEqual(track.project(p),old(p));
  for(const margin of [-2,0,.6,10]){const expected=[undefined,null,'tunnel-cut','harbor-cut'].some(route=>{const q=old(p,route);return q.distance<=q.width-margin+1e-6;});assert.equal(track.contains(p,margin),expected);}
 }
 const fixed={x:0,z:0};track.project(fixed).width=999;assert.deepEqual(track.project(fixed),old(fixed));
});

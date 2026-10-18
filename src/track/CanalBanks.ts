import {CityTrack} from './CityTrack';

export interface CanalBank {x:number;y:number;z:number;heading:number;pitch:number;length:number;rise:number;route:string|null;side:number}
/** Clip continuous rail spans against the other channel, not just a midpoint.
 * Removed spans produce no triangles (a zero-height box still has two faces).
 * Heights keep independent upper/lower channels from opening each other's rail.
 */
export function canalBanks(track:CityTrack):CanalBank[]{
 const result:CanalBank[]=[];
 for(const points of [track.samples,...track.shortcuts.map(s=>s.samples)])for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],rise=(b.y??0)-(a.y??0),length=Math.hypot(b.x-a.x,b.z-a.z);
  if(rise < -2||length<1e-5)continue;
  const heading=Math.atan2(b.x-a.x,b.z-a.z),n=Math.ceil(length/.5),others=a.branch?[null]:track.shortcuts.map(s=>s.id);
  for(const side of [-1,1]){
   let start=-1;
   const pose=(u:number)=>({x:a.x+(b.x-a.x)*u+Math.cos(heading)*(a.width+1)*side,z:a.z+(b.z-a.z)*u-Math.sin(heading)*(a.width+1)*side,y:(a.y??0)+rise*u});
   const flush=(end:number)=>{if(start<0)return;const p=pose((start+end)/2);result.push({...p,heading,pitch:-Math.atan2(rise,length),length:(end-start)*length,rise:(end-start)*rise,route:a.branch,side});start=-1;};
   for(let j=0;j<n;j++){
    const p=pose((j+.5)/n),blocked=others.some(route=>{const q=track.project(p,route);return Math.abs(track.heightAt(q.angle,route)-p.y)<2&&q.distance<q.width+1.05;});
    if(blocked)flush(j/n);else if(start<0)start=j/n;
   }flush(1);
  }
 }
 return result;
}

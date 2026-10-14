import type {AudioState} from './AudioController';
export function audioMix(s:AudioState){
 const ratio=Math.max(0,Math.min(1.2,s.speed/50)),air=s.airborne??!s.grounded;
 return {rpm:(45+ratio*120+s.throttle*12)*(air?1.12:1),engine:(.025+ratio*.035)*(s.throttle?.95:.65),
 water:s.grounded?ratio*.065:0,breaking:s.grounded?Math.max(0,ratio-.55)*.05:0,
 wind:air?.025+ratio*.035:0,boost:s.boost?.1:0};
}
export function distanceGain(distance:number){return distance>=140?0:1/(1+(Math.max(0,distance)/24)**2);}

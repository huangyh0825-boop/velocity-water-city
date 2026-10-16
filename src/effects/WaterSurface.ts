import * as THREE from 'three';
/** Concentrate displacement vertices near the camera; retain the full far plane. */
export function waterGrid(segments:number) {
 const geometry=new THREE.PlaneGeometry(2600,2600,segments,segments);
 const positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++)for(const axis of [0,1]) {
  const u=positions.getComponent(i,axis)/1300;
  positions.setComponent(i,axis,1300*(.018*u+.982*u*u*u));
 }
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
/** Visual waves only: no changes to buoyancy, jump or collision physics. */
export const waterWaveGLSL=`
 void swell(vec2 p,vec2 direction,float k,float amplitude,float phase,inout float height,inout vec2 slope) {
  float angle=dot(p,direction)*k-phase;
  height+=sin(angle)*amplitude;slope+=direction*(cos(angle)*amplitude*k);
 }
 void waterWaves(vec2 p,float time,out float height,out vec2 slope) {
  height=0.;slope=vec2(0.);
  swell(p,vec2(.894,.447),.72,.037,time*2.658,height,slope);
  swell(p,vec2(-.34,.9404),1.31,.026,time*3.586+.7,height,slope);
  swell(p,vec2(.66,-.7513),2.13,.012,time*4.573+1.9,height,slope);
  swell(p,vec2(.981,.194),3.62,.006,time*5.961+2.8,height,slope);
 }
`;

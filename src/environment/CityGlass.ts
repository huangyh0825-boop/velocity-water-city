import * as THREE from 'three';

/** Original, deterministic room cards. No downloaded interior photographs. */
export function paintRoomAtlas(canvas:HTMLCanvasElement){
 canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d')!;
 for(let i=0;i<8;i++){
  c.save();c.translate((i%4)*256,(1-Math.floor(i/4))*256);
  const gradient=c.createLinearGradient(0,0,0,256);gradient.addColorStop(0,i%3===0?'#7a9caa':'#536a78');gradient.addColorStop(1,'#202e3b');c.fillStyle=gradient;c.fillRect(0,0,256,256);
  c.fillStyle='#182632';c.fillRect(0,193,256,63);c.fillStyle='#a3a7a0';c.fillRect(0,0,256,29);
  // Wall panels, columns, suspended ceiling strips and occupied work areas.
  for(let j=0;j<4;j++){c.fillStyle=j%2?'#607984':'#455d69';c.fillRect(j*64+3,32,59,154);c.fillStyle='#213541';c.fillRect(j*64,30,3,165);}
  c.fillStyle=i%2?'#f6d498':'#b9e7ed';for(const x of [22,124])c.fillRect(x,12,83,7);
  if(i%3===0){
   c.fillStyle='#89999d';c.fillRect(27,132,203,9);c.fillStyle='#283b49';c.fillRect(34,141,187,51);
   c.fillStyle='#132e40';c.fillRect(52,73,147,44);c.fillStyle='#79c8d3';c.fillRect(58,79,134,4);
   for(let k=0;k<5;k++){c.fillStyle=k%2?'#d4b384':'#6babb9';c.fillRect(59+k*25,92,16,17);}
  }else if(i%3===1){
   for(const x of [25,139]){c.fillStyle='#849ca4';c.fillRect(x,144,89,7);c.fillStyle='#354652';c.fillRect(x+4,151,7,45);c.fillRect(x+76,151,7,45);c.fillStyle='#132a3b';c.fillRect(x+18,100,47,31);c.fillStyle='#74b8c8';c.fillRect(x+22,104,39,22);c.fillStyle='#243946';c.fillRect(x+32,129,15,15);c.fillRect(x+28,161,30,38);}
  }else{
   c.fillStyle='#25353f';c.fillRect(22,49,68,146);for(let j=0;j<5;j++){c.fillStyle='#9caaac';c.fillRect(27,56+j*27,59,4);c.fillStyle=j%2?'#519caa':'#b39d7d';c.fillRect(32,63+j*27,18,16);c.fillStyle='#3d505c';c.fillRect(56,63+j*27,25,16);}
   c.fillStyle='#b5b9ad';c.fillRect(123,145,105,8);c.fillStyle='#3a535d';c.fillRect(133,153,85,44);c.fillStyle='#e5b76e';c.fillRect(146,86,58,39);
  }
  c.fillStyle='rgba(10,20,30,.35)';c.fillRect(0,191,256,7);c.restore();
 }
}

export const ROOM_GLSL=/* glsl */`
uniform sampler2D cityRoomAtlas;
uniform vec2 cityRoomGrid;
varying vec2 vCityRoomUV;
float roomHash(vec2 p){return fract(sin(dot(p,vec2(37.17,91.73)))*43758.5453);}
vec3 occupiedRoom(vec2 uv,vec3 eye,vec3 n){
 vec2 grid=uv*cityRoomGrid,cell=fract(grid),id=floor(grid);
 float seed=roomHash(id),style=floor(seed*8.0);vec3 hit=vec3(cell*2.0-1.0,-1.0);
 #if CITY_ROOM_DETAIL == 1
  vec3 px=dFdx(-vViewPosition),py=dFdy(-vViewPosition);vec2 ux=dFdx(uv),uy=dFdy(uv);
  float orientation=sign(ux.x*uy.y-ux.y*uy.x);
  vec3 rawT=px*uy.y-py*ux.y,rawB=py*ux.x-px*uy.x;
  vec3 t=rawT/max(length(rawT),.00001)*orientation,b=rawB/max(length(rawB),.00001)*orientation;
  vec3 ray=normalize(vec3(-dot(eye,t)*.82,-dot(eye,b)*.72,-max(.15,abs(dot(eye,n)))));
  ray=mix(vec3(.0001),ray,step(vec3(.0001),abs(ray)));vec3 start=vec3(cell*2.0-1.0,1.0),inverse=1.0/ray;
  vec3 distanceToWall=abs(inverse)-start*inverse;float nearest=min(min(distanceToWall.x,distanceToWall.y),distanceToWall.z);
  hit=start+ray*nearest;
 #endif
 vec2 tile=vec2(mod(style,4.0),floor(style/4.0));
 vec3 rear=texture2D(cityRoomAtlas,(tile+clamp(hit.xy*.5+.5,vec2(.025),vec2(.975)))/vec2(4.0,2.0)).rgb;
 vec3 wall=mix(vec3(.11,.17,.22),vec3(.34,.38,.36),seed);
 if(hit.z>-.98){
  wall*=.65+.35*(hit.z*.5+.5);if(abs(hit.x)>.98)wall*=.68;
  if(hit.y>.98)wall+=vec3(.25,.23,.17)*step(.85,fract(hit.z*3.0));
  rear=wall;
 }
 float pane=min(min(cell.x,1.0-cell.x),min(cell.y,1.0-cell.y));float mask=smoothstep(.035,.072,pane);
 float facing=clamp(abs(dot(normalize(eye),n)),0.0,1.0);float occupied=mix(.48,1.0,step(.24,seed));
 return rear*occupied*mask*(.65+.35*facing);
}
`;

/** Opaque one-pass glass with view-dependent room depth; original PBR reflection remains. */
export class CityGlass {
 readonly atlas:THREE.CanvasTexture;
 constructor(){const canvas=document.createElement('canvas');paintRoomAtlas(canvas);this.atlas=new THREE.CanvasTexture(canvas);this.atlas.colorSpace=THREE.SRGBColorSpace;this.atlas.anisotropy=2;}
 prepare(material:THREE.MeshStandardMaterial,low:boolean){
  if(!/glaz|glass/i.test(material.name)||material.userData.cityRoomGlass)return;
  material.userData.cityRoomGlass=true;material.metalness=0;material.roughness=.24;material.envMapIntensity=.32;
  if(material instanceof THREE.MeshPhysicalMaterial){material.clearcoat=low?0:.12;material.clearcoatRoughness=.2;}
  material.onBeforeCompile=shader=>{
   shader.uniforms.cityRoomAtlas={value:this.atlas};
   shader.uniforms.cityRoomGrid={value:/lobby/i.test(material.name)?new THREE.Vector2(2,1.3):new THREE.Vector2(12,12)};
   shader.fragmentShader=`#define CITY_ROOM_DETAIL ${low?0:1}\n`+shader.fragmentShader;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vCityRoomUV;').replace('#include <uv_vertex>','#include <uv_vertex>\nvCityRoomUV=vec2(uv.x,1.0-uv.y);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+ROOM_GLSL).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    float cityNear=1.0-smoothstep(${low?'95.0,175.0':'260.0,480.0'},length(vViewPosition));
    if(cityNear>0.0){
     vec3 cityWorldNormal=inverseTransformDirection(normal,viewMatrix);
     float cityVertical=1.0-smoothstep(.65,.9,abs(cityWorldNormal.y));
     vec3 cityRoom=occupiedRoom(vCityRoomUV,vViewPosition,normal)*cityVertical;
     float cityFresnel=pow(1.0-clamp(abs(dot(normalize(vViewPosition),normal)),0.0,1.0),3.0);
     float cityRoomWeight=cityNear*cityVertical*(.76-.38*cityFresnel);
     diffuseColor.rgb=mix(diffuseColor.rgb,cityRoom*.22,cityRoomWeight);
     totalEmissiveRadiance+=cityRoom*(.52-.2*cityFresnel)*cityNear;
    }
   `);
  };
  material.customProgramCacheKey=()=>`city-occupied-glass-v1-${low?0:1}`;material.needsUpdate=true;
 }
 dispose(){this.atlas.dispose();}
}

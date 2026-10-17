import * as THREE from 'three';
import {Water as ReflectiveWater} from 'three/addons/objects/Water.js';
import {waterNormalTexture} from './WaterNormals';
import {waterGrid,waterWaveGLSL} from './WaterSurface';
import type {WakePool,WakeStamp} from './WakePool';
const WAKE_SAMPLES=32;
const byAge=(a:WakeStamp,b:WakeStamp)=>a.age-b.age;
/** Displaced water, current-frame planar reflection and integrated wake normals. */
export class Water {
 readonly mesh:ReflectiveWater;
 private standard=waterGrid(320);
 private lightweight=waterGrid(64);
 private normals=waterNormalTexture();
 private material:THREE.ShaderMaterial;
 private low=false;
 private pool?:WakePool;
 private active:WakeStamp[]=[];
 private channels:{mesh:THREE.Mesh;visible:boolean}[]=[];
 private wakePositions=Array.from({length:WAKE_SAMPLES},()=>new THREE.Vector4());
 private wakeAges=Array.from({length:WAKE_SAMPLES},()=>new THREE.Vector2(10,0));
 constructor(scene:THREE.Scene) {
  // Maintained Three.js mirror camera and oblique clipping. A current reflection,
  // with no temporal history or accumulated motion frames.
  this.mesh=new ReflectiveWater(this.standard,{textureWidth:1024,textureHeight:1024,clipBias:.003,waterNormals:this.normals,eye:new THREE.Vector3()});
  this.mesh.name='racing-water-surface';this.mesh.rotation.x=-Math.PI/2;
  this.material=this.mesh.material;
  Object.assign(this.material.uniforms,{
   detail:{value:1},wakeCount:{value:0},wakePositions:{value:this.wakePositions},wakeAges:{value:this.wakeAges},reflectionEnabled:{value:1},
  });
  this.material.vertexShader=`
   uniform float time;uniform mat4 textureMatrix;
   varying vec3 world;varying vec4 mirrorCoord;
   ${waterWaveGLSL}
   void main(){vec4 w=modelMatrix*vec4(position,1.);float height;vec2 slope;
    waterWaves(w.xz,time,height,slope);w.y+=height;
    world=w.xyz;mirrorCoord=textureMatrix*vec4(w.x,0.,w.z,1.);
    gl_Position=projectionMatrix*viewMatrix*w;}`;
  this.material.fragmentShader=`
   uniform float time;uniform float detail;uniform float reflectionEnabled;
   uniform sampler2D normalSampler;uniform sampler2D mirrorSampler;
   uniform int wakeCount;uniform vec4 wakePositions[${WAKE_SAMPLES}];uniform vec2 wakeAges[${WAKE_SAMPLES}];
   varying vec3 world;varying vec4 mirrorCoord;
   ${waterWaveGLSL}
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
   void main(){
    vec2 p=world.xz;vec3 V=normalize(cameraPosition-world);
    float distanceToEye=length(cameraPosition-world),nearDetail=1.-smoothstep(35.,170.,distanceToEye);
    float height;vec2 slope;waterWaves(p,time,height,slope);
    vec3 ripple=texture2D(normalSampler,p*.043+vec2(time*.009,-time*.006)).xyz*2.-1.;
    vec3 micro=texture2D(normalSampler,p*vec2(-.137,.131)+vec2(-time*.018,time*.014)).xyz*2.-1.;
    slope+=ripple.xy*.75+micro.xy*(.30*nearDetail*detail);
    float foam=0.,aeration=0.;
    for(int i=0;i<${WAKE_SAMPLES};i++){
     if(i>=wakeCount)break;
     if(abs(world.y-wakeAges[i].y)>2.5)continue;
     vec4 source=wakePositions[i];float age=wakeAges[i].x,strength=source.w;
     vec2 delta=p-source.xy;float sh=sin(source.z),ch=cos(source.z);
     float lateral=dot(delta,vec2(ch,-sh)),forward=dot(delta,vec2(sh,ch));
     float aft=2.-forward,gate=smoothstep(0.,.6,aft)*(1.-smoothstep(5.+age*2.,8.+age*3.,aft));
     // The original contribution is exactly zero outside this longitudinal gate.
     // Keep every wave, stamp and texture sample inside it; skip only zero work.
     if(gate==0. || strength==0.)continue;
     float spread=.22+aft*.27+age*.35;
     float edge=abs(lateral)-spread,width=.10+age*.12;
     float envelope=exp(-edge*edge/(width*width))*gate;
     float life=pow(max(0.,1.-age/1.45),1.8)*smoothstep(0.,.08,age)*strength;
     vec2 right=vec2(ch,-sh)*sign(lateral);
     slope+=right*envelope*sin(edge*25.-age*7.)*life*.055;
     float cells=noise(p*12.+vec2(age*2.,-age*3.));
     foam+=envelope*life*smoothstep(.30,.78,cells)*.35;
     aeration+=exp(-lateral*lateral/(.22+age*.5))*gate*life*.12;
    }
    vec3 N=normalize(vec3(-slope.x,1.,-slope.y));
    vec3 sun=normalize(vec3(-.45,.8,.4));float NV=max(.001,dot(N,V));
    float fresnel=.0204+.9796*pow(1.-NV,5.);
    float waterVariation=noise(p*.024)+noise(p*.071)*.25;
    vec3 body=mix(vec3(.005,.045,.10),vec3(.012,.13,.21),smoothstep(.10,1.1,waterVariation));
    body*=.75+.30*max(0.,dot(N,sun));body+=vec3(.013,.043,.039)*(height+.08)*2.;
    vec3 R=reflect(-V,N);
    vec3 sky=mix(vec3(.57,.76,.82),vec3(.075,.30,.49),smoothstep(0.,.75,R.y));
    vec2 reflectedUV=mirrorCoord.xy/mirrorCoord.w;
    vec2 distortion=N.xz*(.015+1.2/max(4.,distanceToEye));
    reflectedUV=clamp(reflectedUV+distortion,vec2(.002),vec2(.998));
    vec2 blur=vec2(.0012,.0012)*(1.+distanceToEye*.001);
    vec3 reflectionSample=texture2D(mirrorSampler,reflectedUV).rgb*.40;
    reflectionSample+=(texture2D(mirrorSampler,reflectedUV+blur).rgb+texture2D(mirrorSampler,reflectedUV-blur).rgb)*.15;
    reflectionSample+=(texture2D(mirrorSampler,reflectedUV+vec2(blur.x,-blur.y)).rgb+texture2D(mirrorSampler,reflectedUV+vec2(-blur.x,blur.y)).rgb)*.15;
    vec3 reflected=mix(sky,reflectionSample,reflectionEnabled);
    vec3 col=mix(body,reflected,clamp(fresnel*.93,0.,.94));
    vec3 H=normalize(V+sun);float NH=max(0.,dot(N,H));float rough=.10+.03*(1.-nearDetail);
    float alpha=rough*rough,denom=NH*NH*(alpha*alpha-1.)+1.;
    float D=alpha*alpha/(3.14159265*denom*denom+.00001);
    col+=vec3(1.,.91,.72)*min(2.2,D*.018)*max(0.,dot(N,sun));
    col=mix(col,vec3(.29,.55,.57),clamp(aeration,0.,.34));
    col=mix(col,vec3(.72,.88,.88),clamp(foam,0.,.65));
    col=mix(col,vec3(.50,.74,.83),1.-exp(-distanceToEye*.0015));
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`;
  const reflect=this.mesh.onBeforeRender;
  this.mesh.onBeforeRender=(renderer,scene,camera,geometry,material,group)=>{
   this.mesh.position.x=camera.position.x;this.mesh.position.z=camera.position.z;this.mesh.updateMatrixWorld();
   if(!this.low){try{for(const c of this.channels){c.visible=c.mesh.visible;c.mesh.visible=false;}reflect.call(this.mesh,renderer,scene,camera,geometry,material,group);}finally{for(const c of this.channels)c.mesh.visible=c.visible;}}
  };
  scene.add(this.mesh);
 }
 bindWake(pool:WakePool){this.pool=pool;}
  /** Raised surfaces share current-frame reflection and the full water shader;
   * exclude their water skin from its own reflection target to prevent feedback. */
  channel(geometry:THREE.BufferGeometry){const mesh=new THREE.Mesh(geometry,this.material);mesh.name='elevated-water-surface';this.channels.push({mesh,visible:true});return mesh;}
 update(time:number){
  this.material.uniforms.time.value=time;
  const active=this.active;active.length=0;
  if(this.pool)for(const p of this.pool.stamps)if(p.age<this.pool.lifetime)active.push(p);
  active.sort(byAge);
  const count=Math.min(WAKE_SAMPLES,active.length);
  for(let i=0;i<count;i++){
   const p=active[Math.floor(i*active.length/count)];
   this.wakePositions[i].set(p.x,p.z,p.heading,Math.min(1,p.speed/50));this.wakeAges[i].set(p.age,p.height??0);
  }
  this.material.uniforms.wakeCount.value=count;
 }
 setLow(low:boolean){this.low=low;this.mesh.geometry=low?this.lightweight:this.standard;this.material.uniforms.detail.value=low?0:1;this.material.uniforms.reflectionEnabled.value=low?0:1;}
 dispose(){this.standard.dispose();this.lightweight.dispose();this.normals.dispose();(this.material.uniforms.mirrorSampler.value as THREE.Texture).renderTarget?.dispose();this.material.dispose();}
}

import * as THREE from 'three';
import { SprayPool } from './SprayPool';
import type { DrivingModel } from '../player/DrivingModel';
import type { WaterSource } from './Wake';
import {ImpactRipples} from './ImpactRipples';
export class Spray {
  readonly pool=new SprayPool();
  private geometry=new THREE.BufferGeometry();
  private intervals=new Map<string,number>();
  private low=false;
  private ripples:ImpactRipples;
  constructor(scene:THREE.Scene) {
    this.ripples=new ImpactRipples(scene);
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.pool.positions,3));
    this.geometry.setAttribute('alpha',new THREE.BufferAttribute(this.pool.alpha,1));
    this.geometry.setAttribute('size',new THREE.BufferAttribute(this.pool.sizes,1));
    this.geometry.setAttribute('motion',new THREE.BufferAttribute(this.pool.motion,3));
    for(const attribute of Object.values(this.geometry.attributes))if(attribute instanceof THREE.BufferAttribute)attribute.setUsage(THREE.DynamicDrawUsage);
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      vertexShader:`attribute float alpha;attribute float size;attribute vec3 motion;varying float a;varying vec2 axis;varying float stretch;void main(){a=alpha;vec4 p=modelViewMatrix*vec4(position,1.);vec3 v=mat3(modelViewMatrix)*motion;axis=normalize(v.xy+vec2(.001));stretch=clamp(length(v.xy)*.12+1.,1.,3.2);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*440./max(1.,-p.z),1.,38.);}`,
      fragmentShader:`varying float a;varying vec2 axis;varying float stretch;void main(){vec2 q=gl_PointCoord-.5;vec2 d=vec2(dot(q,vec2(-axis.y,axis.x))*stretch,dot(q,axis));float r=length(d),opacity=a*(1.-smoothstep(.12,.49,r));if(opacity<.005)discard;vec3 color=mix(vec3(.48,.73,.82),vec3(.94,.99,1.),1.-smoothstep(.05,.4,r));gl_FragColor=vec4(color,opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
    });
    const points=new THREE.Points(this.geometry,material);points.frustumCulled=false;scene.add(points);
  }
  bindSurfaceTime(time:{value:number}){this.ripples.bindTime(time);}
  setLow(low:boolean) {this.low=low;this.pool.setLow(low);this.ripples.setLow(low);this.geometry.setDrawRange(0,this.pool.limit);this.geometry.getAttribute('alpha').needsUpdate=true;this.intervals.clear();}
  burst(x:number,z:number,strength:number,kind:'landing'|'collision'|'takeoff',height=0) {
    const count=Math.round((kind==='landing'?42:kind==='takeoff'?16:Math.min(26,8+strength))*(this.low?0.35:1));
    // A ramp departure is above the water. Keep its droplets, never project a
    // water ring onto the launch deck or into the air.
    if(kind!=='takeoff')this.ripples.burst(x,z,strength,height,kind);
    for(let i=0;i<count;i++) {const crown=kind==='landing'&&i<count*.68,a=(i/count+Math.random()*.025)*Math.PI*2,speed=crown?2.8+Math.min(5,strength*.18)+Math.random():1.5+Math.random()*Math.min(7,2+strength*.15);this.pool.spawn(x,height+.2,z,Math.cos(a)*speed,crown?2+Math.random()*1.3:3+Math.random()*4,Math.sin(a)*speed,.6+Math.random()*.4,crown?.38+Math.random()*.18:.18+Math.random()*.20,height);}
  }
  update(dt:number,model:DrivingModel,grounded:boolean) {
    this.updateAll(dt,[{id:'player',model,grounded}]);
  }
  updateAll(dt:number,sources:readonly WaterSource[]) {
    this.pool.update(dt);
    this.ripples.update(dt);
    for(const {id,model,grounded,weight=1,height=0} of sources){
    let interval=this.intervals.get(id)??0;
    if(grounded && model.speed>2) {
      interval+=dt*(8+model.speed*.65+Math.abs(model.yawRate)*model.speed*.9)*(this.low?0.35:1)*weight;
      const count=Math.min(8,Math.floor(interval));interval-=count;
      const fx=Math.sin(model.heading),fz=Math.cos(model.heading),rx=Math.cos(model.heading),rz=-Math.sin(model.heading);
      for(let i=0;i<count;i++) {const turn=Math.abs(model.yawRate)>.12,side=turn?-Math.sign(model.yawRate):(Math.random()<.5?-1:1),spread=(1+Math.abs(model.yawRate)*5)*side;
        this.pool.spawn(model.x-fx*1.35+rx*side*.7,height+.25,model.z-fz*1.35+rz*side*.7,rx*spread*1.4-fx*model.speed*.16,1.15+Math.random()*2.1,rz*spread*1.4-fz*model.speed*.16,.5+Math.random()*.3,(turn?.24:.18)+model.speed*.004+Math.random()*.08,height); }
    } else interval=0;
    this.intervals.set(id,interval);
    }
    for(const name of ['position','alpha','size','motion']) this.geometry.getAttribute(name).needsUpdate=true;
  }
  reset() {this.pool.reset();this.ripples.reset();this.intervals.clear();this.geometry.getAttribute('alpha').needsUpdate=true;}
}

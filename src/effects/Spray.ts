import * as THREE from 'three';
import { SprayPool } from './SprayPool';
import type { DrivingModel } from '../player/DrivingModel';
import type { WaterSource } from './Wake';
export class Spray {
  readonly pool=new SprayPool();
  private geometry=new THREE.BufferGeometry();
  private intervals=new Map<string,number>();
  private low=false;
  constructor(scene:THREE.Scene) {
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.pool.positions,3));
    this.geometry.setAttribute('alpha',new THREE.BufferAttribute(this.pool.alpha,1));
    this.geometry.setAttribute('size',new THREE.BufferAttribute(this.pool.sizes,1));
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      vertexShader:`attribute float alpha; attribute float size; varying float a; void main(){ a=alpha; vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*320./max(1.,-p.z),1.,28.); }`,
      fragmentShader:`varying float a;void main(){float r=length(gl_PointCoord-.5);float opacity=a*(1.-smoothstep(.1,.5,r));if(opacity<.005)discard;gl_FragColor=vec4(.8,.97,1.,opacity);}`
    });
    const points=new THREE.Points(this.geometry,material);points.frustumCulled=false;scene.add(points);
  }
  setLow(low:boolean) {this.low=low;this.pool.setLow(low);this.geometry.setDrawRange(0,this.pool.limit);this.geometry.getAttribute('alpha').needsUpdate=true;this.intervals.clear();}
  burst(x:number,z:number,strength:number,kind:'landing'|'collision'|'takeoff',height=0) {
    const count=Math.round((kind==='landing'?42:kind==='takeoff'?16:Math.min(26,8+strength))*(this.low?0.35:1));
    for(let i=0;i<count;i++) {const a=Math.random()*Math.PI*2,speed=1.5+Math.random()*Math.min(7,2+strength*.15);this.pool.spawn(x,height+.2,z,Math.cos(a)*speed,2+Math.random()*5,Math.sin(a)*speed,.6+Math.random()*.4,.18+Math.random()*.24,height);}
  }
  update(dt:number,model:DrivingModel,grounded:boolean) {
    this.updateAll(dt,[{id:'player',model,grounded}]);
  }
  updateAll(dt:number,sources:readonly WaterSource[]) {
    this.pool.update(dt);
    for(const {id,model,grounded,weight=1,height=0} of sources){
    let interval=this.intervals.get(id)??0;
    if(grounded && model.speed>2) {
      interval+=dt*(8+model.speed*.65+Math.abs(model.yawRate)*model.speed*.9)*(this.low?0.35:1)*weight;
      const count=Math.min(8,Math.floor(interval));interval-=count;
      const fx=Math.sin(model.heading),fz=Math.cos(model.heading),rx=Math.cos(model.heading),rz=-Math.sin(model.heading);
      for(let i=0;i<count;i++) {const turn=Math.abs(model.yawRate)>.12,side=turn?-Math.sign(model.yawRate):(Math.random()<.5?-1:1),spread=(1+Math.abs(model.yawRate)*5)*side;
        this.pool.spawn(model.x-fx*1.5+rx*side*.7,height+.25,model.z-fz*1.5+rz*side*.7,rx*spread-fx*model.speed*.12,1.5+Math.random()*2.5,rz*spread-fz*model.speed*.12,.5+Math.random()*.3,.12+model.speed*.002+Math.random()*.1,height); }
    } else interval=0;
    this.intervals.set(id,interval);
    }
    for(const name of ['position','alpha','size']) this.geometry.getAttribute(name).needsUpdate=true;
  }
  reset() {this.pool.reset();this.intervals.clear();this.geometry.getAttribute('alpha').needsUpdate=true;}
}

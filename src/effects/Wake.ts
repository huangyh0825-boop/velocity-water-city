import * as THREE from 'three';
import { DrivingModel } from '../player/DrivingModel';
import { WakePool } from './WakePool';
export interface WaterSource {id:string;model:DrivingModel;grounded:boolean;weight?:number;height?:number}
const COUNT = 200;
const LIFETIME = 1.45;
export class Wake {
  private mesh: THREE.InstancedMesh;
  readonly pool=new WakePool();
  private intervals=new Map<string,number>();
  private low=false;
  private dummy = new THREE.Object3D();
  private opacity = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
  constructor(scene: THREE.Scene) {
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `attribute float instanceOpacity; varying float vOpacity; varying vec2 vUv; void main() { vUv=uv; vOpacity=instanceOpacity;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }`,
      fragmentShader: `varying float vOpacity; varying vec2 vUv; void main() {
        float arm=abs(abs(vUv.x-.5)-(.035+vUv.y*.42));
        float wisps=.72+.28*sin(vUv.y*94.+sin(vUv.x*75.)*2.);
        float foam=(1.-smoothstep(.012,.055,arm))*.82*wisps;
        foam+=exp(-abs(vUv.x-.5)*32.)*(1.-vUv.y)*.28;
        foam+=exp(-abs(vUv.x-.5)*12.)*(1.-vUv.y)*(.5+.5*sin(vUv.y*62.+vUv.x*43.))*.18;
        float fade=smoothstep(0.,.1,vUv.y)*(1.-smoothstep(.72,1.,vUv.y));
        float a=foam*fade*vOpacity;if(a<.005)discard;
        gl_FragColor=vec4(.77,.96,1.,a); }`,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, COUNT);
    this.mesh.geometry.setAttribute('instanceOpacity', this.opacity);
    this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  update(dt: number, model: DrivingModel, grounded = true) {
    this.updateAll(dt,[{id:'player',model,grounded}]);
  }
  setLow(low:boolean){this.low=low;this.pool.setLow(low);this.intervals.clear();this.mesh.count=this.pool.limit;this.opacity.array.fill(0);this.opacity.needsUpdate=true;}
  /** The same world-space pool can be rendered directly by the displaced water. */
  setSurfaceIntegrated(integrated:boolean){this.mesh.visible=!integrated;}
  updateAll(dt:number,sources:readonly WaterSource[]){
    this.pool.update(dt);
    for(const {id,model:m,grounded,height=0} of sources){
      let interval=(this.intervals.get(id)??0)+dt;
      const cadence=this.low?.1:.055;
      if(!grounded||m.speed<2)interval=0;
      else if(interval>=cadence){interval%=cadence;this.pool.spawn(m.x-Math.sin(m.heading)*4,m.z-Math.cos(m.heading)*4,m.heading,m.speed,height);}
      this.intervals.set(id,interval);
    }
    this.pool.stamps.forEach((p, i) => {
      const life = Math.max(0, 1 - p.age / LIFETIME),strength=Math.min(1,p.speed/50);
      this.opacity.setX(i, Math.min(1,p.age/.08)*life*life*(.08+strength*.36));
      this.dummy.position.set(p.x, (p.height??0)+0.20, p.z);
      this.dummy.rotation.set(-Math.PI / 2, 0, -p.heading);
      this.dummy.scale.set(life>0?2.3+strength*2.5+p.age*3.2:0,life>0?3.5+strength*3+p.age*2:0,1);
      this.dummy.updateMatrix(); this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.opacity.needsUpdate = true;
  }
  reset() { this.pool.reset();this.intervals.clear(); this.opacity.array.fill(0); this.opacity.needsUpdate = true; }
}

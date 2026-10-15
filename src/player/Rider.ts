import * as THREE from 'three';
import { ModelBatch } from './ModelBatch';
import { AnatomicalRider } from './AnatomicalRider';

/** Procedural seated racer. Fixed grips and articulated arms, no skeleton dependency. */
export class Rider {
  readonly root=new THREE.Group();
  torso:THREE.Object3D=new THREE.Group();
  readonly grips=[new THREE.Vector3(-.4,.14,.93),new THREE.Vector3(.4,.14,.93)];
  private arms:{upper:THREE.Mesh;lower:THREE.Mesh;side:number}[]=[];
  private previousSpeed=0;
  private previousTime=0;
  private lean=.15;
  private bank=0;
  private elapsed=false;
  private assetBound=false;
  private anatomical?:AnatomicalRider;
  constructor(color='#126bba',simple=false){
    this.root.name=simple?'ai-rider':'player-rider';this.root.position.set(0,1.02,-.45);
    const suit=new THREE.MeshStandardMaterial({color:'#11263a',roughness:.75});
    const armor=new THREE.MeshStandardMaterial({color,metalness:.3,roughness:.45});
    const silver=new THREE.MeshStandardMaterial({color:'#dce9ee',metalness:.65,roughness:.35});
    const visor=new THREE.MeshStandardMaterial({color:'#052c46',metalness:.55,roughness:.12});
    const segments=simple?8:12,batch=new ModelBatch();
    const part=(g:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>batch.add(g,mat,new THREE.Vector3(x,y,z),new THREE.Vector3(sx,sy,sz));
    part(new THREE.BoxGeometry(.46,.22,.38),suit,0,.02,0);
    for(const side of [-1,1]){
      const tube=(a:THREE.Vector3,b:THREE.Vector3,radius:number,mat:THREE.Material)=>{
        const g=new THREE.CylinderGeometry(radius,radius*.85,a.distanceTo(b),segments);
        const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
        g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),q,new THREE.Vector3(1,1,1)));
        batch.add(g,mat,new THREE.Vector3());
      };
      tube(new THREE.Vector3(side*.16,0,.04),new THREE.Vector3(side*.59,-.12,.42),.13,suit);
      tube(new THREE.Vector3(side*.59,-.12,.42),new THREE.Vector3(side*.68,-.53,.56),.105,armor);
      part(new THREE.BoxGeometry(.2,.13,.32),suit,side*.68,-.55,.59);
    }
    batch.build(this.root);
    this.torso.position.y=.1;this.root.add(this.torso);
    const chest=new THREE.Mesh(new THREE.SphereGeometry(1,segments,8),suit);chest.position.set(0,.4,.035);chest.scale.set(.31,.43,.22);this.torso.add(chest);
    const plate=new THREE.Mesh(new THREE.BoxGeometry(.42,.4,.08),armor);plate.position.set(0,.48,.23);plate.rotation.x=-.1;this.torso.add(plate);
    const helmet=new THREE.Mesh(new THREE.SphereGeometry(.29,segments,8),silver);helmet.position.set(0,.97,.04);this.torso.add(helmet);
    const screen=new THREE.Mesh(new THREE.SphereGeometry(.295,segments,6,0,Math.PI,Math.PI*.35,Math.PI*.3),visor);screen.position.copy(helmet.position);this.torso.add(screen);
    for(const side of [-1,1]){
      const upper=new THREE.Mesh(new THREE.CylinderGeometry(.085,.075,1,segments),armor);
      const lower=new THREE.Mesh(new THREE.CylinderGeometry(.075,.065,1,segments),suit);
      this.root.add(upper,lower);this.arms.push({upper,lower,side});
      const glove=new THREE.Mesh(new THREE.SphereGeometry(.09,segments,6),suit);glove.position.copy(this.grips[side===-1?0:1]);this.root.add(glove);
    }
    this.update(0,0,0);
  }
  bindAsset(asset:THREE.Object3D){
    if(!this.assetBound)this.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});
    this.releaseSkin();this.assetBound=true;
    this.root.clear();this.root.add(asset);this.torso=asset.getObjectByName('RiderTorso')!;
    if(asset.getObjectByName('RaceRig')){this.anatomical=new AnatomicalRider(this.root,this.torso,this.grips);this.arms=[];return;}
    this.anatomical=undefined;
    this.arms=[-1,1].map(side=>({side,upper:asset.getObjectByName(`UpperArm_${side}`) as THREE.Mesh,lower:asset.getObjectByName(`Forearm_${side}`) as THREE.Mesh}));
  }
  update(time:number,speed:number,yawRate:number,landing=0){
    const dt=this.elapsed?Math.max(0,Math.min(.1,time-this.previousTime)):0;
    const acceleration=dt>0?(speed-this.previousSpeed)/dt:0;
    const target=.15+Math.min(1.2,speed/50)*.14+Math.max(-.03,Math.min(.045,acceleration*.003))+landing;
    const smooth=this.elapsed?1-Math.exp(-dt*7):1;
    this.lean+=(target-this.lean)*smooth;this.bank+=(-yawRate*.16-this.bank)*smooth;
    if(this.anatomical)this.anatomical.update(this.lean,this.bank);
    else this.torso.rotation.set(this.lean,0,this.bank);
    for(const {upper,lower,side} of this.arms){
      const shoulder=new THREE.Vector3(side*.28,.63,.035).applyEuler(this.torso.rotation).add(this.torso.position);
      const grip=this.grips[side===-1?0:1];
      const elbow=shoulder.clone().lerp(grip,.52);elbow.x+=side*.09;elbow.y+=.035;
      this.limb(upper,shoulder,elbow);this.limb(lower,elbow,grip);
    }
    this.previousSpeed=speed;this.previousTime=time;this.elapsed=true;
  }
  private limb(mesh:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3){
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=a.distanceTo(b);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
  }
  private releaseSkin(){const skeletons=new Set<THREE.Skeleton>();this.root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skeletons.add(o.skeleton);});skeletons.forEach(s=>s.dispose());}
  dispose(){this.releaseSkin();}
}

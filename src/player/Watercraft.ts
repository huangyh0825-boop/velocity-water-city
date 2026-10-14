import * as THREE from 'three';
import { DrivingModel, MAX_SPEED } from './DrivingModel';
import { ModelBatch } from './ModelBatch';
import { Rider } from './Rider';
export class Watercraft {
  readonly model: DrivingModel;
  readonly object = new THREE.Group();
  readonly visual = new THREE.Group();
  readonly rider:Rider;
  constructor(scene: THREE.Scene, color = '#126bba', model = new DrivingModel(),simple=false) {
    this.model = model;
    this.object.add(this.visual);
    const silver = new THREE.MeshStandardMaterial({ color: '#c4d9e6', metalness: 0.72, roughness: 0.3 });
    const blue = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.28 });
    const dark = new THREE.MeshStandardMaterial({ color: '#112536', roughness: 0.6 });
    const glow = new THREE.MeshBasicMaterial({ color: '#6dfbff' });
    const batch=new ModelBatch();
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number,sx=1,sy=1,sz=1,rotation=new THREE.Euler()) => {
      batch.add(geometry,material,new THREE.Vector3(x,y,z),new THREE.Vector3(sx,sy,sz),rotation);
    };
    const outline=[[0,-2.15],[.55,-1.75],[.76,-.6],[.72,.7],[.48,1.75],[0,2.55]].map(([x,y])=>new THREE.Vector2(x,y));
    part(new THREE.LatheGeometry(outline,16),silver,0,.27,0,1,.48,1,new THREE.Euler(Math.PI/2,0,0));
    const deckOutline=[[0,-1.7],[.4,-1.3],[.62,-.25],[.55,.8],[.3,1.9],[0,2.45]].map(([x,y])=>new THREE.Vector2(x,y));
    part(new THREE.LatheGeometry(deckOutline,16),blue,0,.52,0,1,.42,1,new THREE.Euler(Math.PI/2,0,0));
    part(new THREE.BoxGeometry(.58,.21,1.15),dark,0,.84,-.52,1,1,1,new THREE.Euler(-.05,0,0));
    part(new THREE.BoxGeometry(.15,.5,.14),silver,0,.93,.55,1,1,1,new THREE.Euler(-.35,0,0));
    part(new THREE.BoxGeometry(1, 0.1, 0.14), dark, 0, 1.13, 0.45);
    for (const side of [-1, 1]) {
      part(new THREE.BoxGeometry(0.08, 0.06, 2.5), glow, side * 0.58, 0.53, 0);
      part(new THREE.BoxGeometry(.26,.06,1.05),dark,side*.65,.4,-.12);
      part(new THREE.BoxGeometry(.12,.28,.8),blue,side*.70,.18,-1.35,1,1,1,new THREE.Euler(0,0,side*.2));
      part(new THREE.CylinderGeometry(.20,.23,.42,12),dark,side*.35,.28,-1.90,1,1,1,new THREE.Euler(Math.PI/2,0,0));
      part(new THREE.TorusGeometry(.205,.04,5,12),silver,side*.35,.28,-2.12);
      part(new THREE.TorusGeometry(.14,.018,4,12),glow,side*.35,.28,-2.14);
      for(let i=0;i<3;i++)part(new THREE.BoxGeometry(.035,.09,.35),dark,side*.58,.60,.5+i*.2);
    }
    const glass=new THREE.MeshStandardMaterial({color:'#8fd5e7',metalness:.4,roughness:.16});
    part(new THREE.BoxGeometry(.7,.27,.07),glass,0,1.02,.76,1,1,1,new THREE.Euler(-.3,0,0));
    batch.build(this.visual);this.rider=new Rider(color,simple);this.visual.add(this.rider.root);
    scene.add(this.object);
  }
  sync(time: number, m: DrivingModel = this.model, height = 0, trick = {pitch:0,yaw:0}) {
    this.object.position.set(m.x, height + 0.16 + Math.sin(time * 3.2) * 0.07, m.z);
    this.object.rotation.set(-Math.min(1, m.speed / MAX_SPEED) * 0.035, m.heading, -m.yawRate * 0.22);
    this.visual.rotation.set(trick.pitch, trick.yaw, 0);
    this.rider.update(time,m.speed,m.yawRate);
  }
}

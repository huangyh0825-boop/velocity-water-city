import * as THREE from 'three';
export class BoosterJet {
  readonly object = new THREE.Group();
  constructor(private parent: THREE.Object3D) {
    for(const [radius,length,color] of [[0.24,2.5,'#2498ff'],[0.12,1.8,'#b2ffff']] as const) {
      const mesh=new THREE.Mesh(new THREE.ConeGeometry(radius,length,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.75,depthWrite:false}));
      mesh.rotation.x=-Math.PI/2; mesh.position.set(0,0,-length/2); this.object.add(mesh);
    }
    parent.add(this.object); this.object.visible=false;
  }
  update(time:number,active:boolean) {
    this.object.visible=active;
    const socket=this.parent.getObjectByName('JetOutlet');
    if(socket)this.object.position.copy(this.parent.worldToLocal(socket.getWorldPosition(new THREE.Vector3())));
    else this.object.position.set(0,.25,-2.3);
    this.object.scale.set(1,1,0.9+Math.sin(time*42)*0.08);
  }
}

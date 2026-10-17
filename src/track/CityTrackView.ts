import * as THREE from 'three';
import {CityTrack} from './CityTrack';


export class CityTrackView {
 private gates:THREE.MeshBasicMaterial[]=[];
 constructor(scene:THREE.Scene,track:CityTrack){

  const dark=new THREE.MeshStandardMaterial({color:'#224459',metalness:.4,roughness:.4}),light=new THREE.MeshBasicMaterial({color:'#6edfea'}),dummy=new THREE.Object3D();
  const routes=[track.samples,...track.shortcuts.map(s=>s.samples)],count=routes.reduce((n,s)=>n+(s.length-1)*2,0);
  const banks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),dark,count),rims=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),light,count);let cursor=0;
  for(const points of routes)for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],heading=Math.atan2(b.x-a.x,b.z-a.z),length=Math.hypot(b.x-a.x,b.z-a.z);
    // Leave the merge mouths clear on shortcut branches; physical containment is union of corridors.
    for(const side of [-1,1]){
      const x=(a.x+b.x)/2+Math.cos(heading)*(a.width+1)*side,z=(a.z+b.z)/2-Math.sin(heading)*(a.width+1)*side;
      const otherRoutes=a.branch?[track.samples]:track.shortcuts.map(s=>s.samples);
      const mouth=otherRoutes.some(route=>route.some(s=>Math.hypot(s.x-x,s.z-z)<s.width+1));
      const drop=(a.y??0)-(b.y??0)>2,base=((a.y??0)+(b.y??0))/2,pitch=-Math.atan2((b.y??0)-(a.y??0),length);
      dummy.position.set(x,base+.75,z);dummy.rotation.set(pitch,heading,0,'YXZ');dummy.scale.set(1.2,mouth||drop?0:1.8,length+.4);dummy.updateMatrix();banks.setMatrixAt(cursor,dummy.matrix);dummy.position.y=base+1.69;dummy.scale.y=mouth||drop?0:.07;dummy.updateMatrix();rims.setMatrixAt(cursor++,dummy.matrix);
    }
  }scene.add(banks,rims);
  for(let i=0;i<track.checkpointCount;i++){
   // Invisible race gates stay in RaceController. Only water-level branch strips remain.
   const angle=track.checkpointAngle(i),glow=new THREE.MeshBasicMaterial({color:i===0?'#ffe4a0':'#527c91'});this.gates.push(glow);
   for(const shortcut of track.shortcuts)if(angle>shortcut.from&&angle<shortcut.to){const p=track.routePoint(angle,0,shortcut.id),marker=new THREE.Mesh(new THREE.BoxGeometry(shortcut.width*2,.1,1),glow);marker.position.set(p.x,(p.y??0)+.3,p.z);marker.rotation.y=track.routeHeading(angle,shortcut.id);scene.add(marker);}
  }
  const start=track.point(0),stripe=new THREE.Mesh(new THREE.PlaneGeometry(track.widthAt(0)*2,1.2),new THREE.MeshBasicMaterial({color:'#eef9fc',side:THREE.DoubleSide}));stripe.name='start-waterline';stripe.rotation.set(-Math.PI/2,0,-track.heading(0));stripe.position.set(start.x,(start.y??0)+.24,start.z);scene.add(stripe);
  const arrowGeometry=new THREE.BufferGeometry();arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-1.3,0,-1,0,0,2,1.3,0,-1,0,0,0,-1.3,0,-1,1.3,0,-1],3));
  const arrows=new THREE.InstancedMesh(arrowGeometry,new THREE.MeshBasicMaterial({color:'#d2f8fc',side:THREE.DoubleSide,transparent:true,opacity:.65}),180);
  for(let i=0;i<180;i++){const angle=i/180*Math.PI*2,p=track.point(angle);dummy.position.set(p.x,(p.y??0)+.23,p.z);dummy.rotation.set(0,track.heading(angle),0);dummy.scale.setScalar(1.7);dummy.updateMatrix();arrows.setMatrixAt(i,dummy.matrix);}scene.add(arrows);
 }
 highlight(index:number){this.gates.forEach((m,i)=>m.color.set(i===index?'#a1fff3':i===0?'#ffe4a0':'#527c91'));}
}

import * as THREE from 'three';
import {CityTrack} from './CityTrack';
import {canalBanks} from './CanalBanks';


export class CityTrackView {
 private gates:THREE.MeshBasicMaterial[]=[];
 constructor(scene:THREE.Scene,track:CityTrack){

  const dark=new THREE.MeshStandardMaterial({color:'#224459',metalness:.4,roughness:.4}),light=new THREE.MeshBasicMaterial({color:'#6edfea'}),dummy=new THREE.Object3D();
  const spans=canalBanks(track),banks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),dark,spans.length),rims=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),light,spans.length);
  banks.name='canal-bank-spans';rims.name='canal-rim-spans';
  spans.forEach((p,i)=>{
   (scene.userData.cameraSolids??=[]).push({x:p.x,y:p.y+.75,z:p.z,width:1.2,height:1.8+Math.abs(p.rise),depth:p.length,heading:p.heading});
   dummy.position.set(p.x,p.y+.75,p.z);dummy.rotation.set(p.pitch,p.heading,0,'YXZ');dummy.scale.set(1.2,1.8,p.length);dummy.updateMatrix();banks.setMatrixAt(i,dummy.matrix);
   dummy.position.y=p.y+1.69;dummy.scale.y=.07;dummy.updateMatrix();rims.setMatrixAt(i,dummy.matrix);
  });scene.add(banks,rims);
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

import * as THREE from 'three';
import {CityTrack} from './CityTrack';
import {canalBanks,CANAL_BANK} from './CanalBanks';


export class CityTrackView {
 constructor(scene:THREE.Scene,track:CityTrack){

  const dark=new THREE.MeshStandardMaterial({color:'#224459',metalness:.4,roughness:.4}),light=new THREE.MeshBasicMaterial({color:'#6edfea'}),dummy=new THREE.Object3D();
  const spans=canalBanks(track),banks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),dark,spans.length),rims=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),light,spans.length);
  banks.name='canal-bank-spans';rims.name='canal-rim-spans';
  const height=CANAL_BANK.top-CANAL_BANK.bottom,center=(CANAL_BANK.top+CANAL_BANK.bottom)/2;
  spans.forEach((p,i)=>{
   (scene.userData.cameraSolids??=[]).push({x:p.x,y:p.y+center,z:p.z,width:CANAL_BANK.thickness,height:height+Math.abs(p.rise),depth:p.length,heading:p.heading});
   // A submerged skirt seals troughs and small spline/linear-height differences.
   // The bank top and rim stay at their original height; no new geometry needed.
   dummy.position.set(p.x,p.y+center,p.z);dummy.rotation.set(p.pitch,p.heading,0,'YXZ');dummy.scale.set(CANAL_BANK.thickness,height,p.length);dummy.updateMatrix();banks.setMatrixAt(i,dummy.matrix);
   dummy.position.y=p.y+CANAL_BANK.rim;dummy.scale.y=.07;dummy.updateMatrix();rims.setMatrixAt(i,dummy.matrix);
  });scene.add(banks,rims);
  // Race gates remain logical planes. Surface arrows provide visual guidance
  // without solid start/checkpoint strips floating across the water.
  const arrowGeometry=new THREE.BufferGeometry();arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-1.3,0,-1,0,0,2,1.3,0,-1,0,0,0,-1.3,0,-1,1.3,0,-1],3));
  const arrows=new THREE.InstancedMesh(arrowGeometry,new THREE.MeshBasicMaterial({color:'#d2f8fc',side:THREE.DoubleSide,transparent:true,opacity:.65}),180);
  for(let i=0;i<180;i++){const angle=i/180*Math.PI*2,p=track.point(angle);dummy.position.set(p.x,(p.y??0)+.23,p.z);dummy.rotation.set(0,track.heading(angle),0);dummy.scale.setScalar(1.7);dummy.updateMatrix();arrows.setMatrixAt(i,dummy.matrix);}scene.add(arrows);
 }
 highlight(_index:number){}
}

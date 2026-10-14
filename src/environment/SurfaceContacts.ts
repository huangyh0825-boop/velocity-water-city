import * as THREE from 'three';
import {CityTrack} from '../track/CityTrack';
/** Static analytic contact occlusion on land/platforms; no screen-space history or physical body. */
export class SurfaceContacts {
 readonly mesh:THREE.Mesh;
 constructor(track:CityTrack){
  const center=track.point(.06*Math.PI*2),heading=track.heading(.06*Math.PI*2),canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(128,128,20,128,128,128);gradient.addColorStop(0,'rgba(0,0,0,.30)');gradient.addColorStop(.66,'rgba(0,0,0,.22)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  const map=new THREE.CanvasTexture(canvas),positions:number[]=[],uvs:number[]=[];
  const footprints=[{x:62,z:-84,rx:23,rz:20,y:.315},{x:-68,z:58,rx:30,rz:22,y:.315},{x:70,z:68,rx:34,rz:25,y:.315},{x:-30.5,z:20,rx:4.5,rz:6.7,y:.315},{x:30.5,z:20,rx:4.5,rz:6.7,y:.315}];
  for(const [side,index] of [[-1,5],[1,12],[-1,22],[1,37],[-1,47],[1,52]]){
   const angle=(.06*track.length-140+index*5)/track.radius,p=track.point(angle,(track.widthAt(angle)+8)*side),dx=p.x-center.x,dz=p.z-center.z;footprints.push({x:dx*Math.cos(heading)-dz*Math.sin(heading),z:dx*Math.sin(heading)+dz*Math.cos(heading),rx:2.25,rz:3,y:1.012});
  }
  for(const f of footprints)for(let j=0;j<8;j++)for(let i=0;i<8;i++){
   const points=[[i,j],[i+1,j],[i,j+1],[i+1,j+1]].map(([u,v])=>({x:f.x+(u/8*2-1)*f.rx,z:f.z+(v/8*2-1)*f.rz,u:u/8,v:v/8}));
   for(const ids of [[0,2,1],[1,2,3]]){
    const x=ids.reduce((s,k)=>s+points[k].x,0)/3,z=ids.reduce((s,k)=>s+points[k].z,0)/3,world={x:center.x+Math.cos(heading)*x+Math.sin(heading)*z,z:center.z-Math.sin(heading)*x+Math.cos(heading)*z};if(track.contains(world,1))continue;
    for(const k of ids){const p=points[k];positions.push(p.x,f.y,p.z);uvs.push(p.u,p.v);}
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();this.mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));this.mesh.name='static-contact-occlusion';
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();const material=this.mesh.material as THREE.MeshBasicMaterial;material.map?.dispose();material.dispose();}
}

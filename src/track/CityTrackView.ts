import * as THREE from 'three';
import {CityTrack,DISTRICTS} from './CityTrack';
import {readableSign} from '../environment/ReadableSign';
export class CityTrackView {
 private gates:THREE.MeshBasicMaterial[]=[];
 constructor(scene:THREE.Scene,track:CityTrack){
  const white=new THREE.MeshStandardMaterial({color:'#c2d9e3',roughness:.6}),dark=new THREE.MeshStandardMaterial({color:'#224459',metalness:.4,roughness:.4}),light=new THREE.MeshBasicMaterial({color:'#6edfea'}),dummy=new THREE.Object3D();
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
   const angle=track.checkpointAngle(i),point=track.point(angle),group=new THREE.Group(),glow=new THREE.MeshBasicMaterial({color:i===0?'#ffe4a0':'#527c91'});this.gates.push(glow);group.position.set(point.x,point.y??0,point.z);group.rotation.y=track.heading(angle);const width=track.widthAt(angle);
   // CP18 sits beside the S2 aerial crossover: keep its sign above the flight corridor.
   const gateHeight=i===18?24:13;
   for(const side of [-1,1]){const pillar=new THREE.Mesh(new THREE.BoxGeometry(.8,gateHeight,.8),white);pillar.position.set(side*width,gateHeight/2-.1,0);group.add(pillar);}
   const beam=new THREE.Mesh(new THREE.BoxGeometry(width*2+.8,.3,.8),glow);beam.position.y=gateHeight-.2;group.add(beam);
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#143e53';ctx.fillRect(0,0,512,128);ctx.fillStyle='#ecfcff';ctx.textAlign='center';ctx.font='bold 30px sans-serif';ctx.fillText(i===0?'START / FINISH':`CP ${String(i).padStart(2,'0')} · ${DISTRICTS[Math.min(5,Math.floor(i/4))]}`,256,78);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sign=readableSign(texture,14,3.5,`checkpoint-sign-${i}`);sign.position.set(0,gateHeight-2.2,0);group.add(sign);scene.add(group);
   for(const shortcut of track.shortcuts)if(angle>shortcut.from&&angle<shortcut.to){const p=track.routePoint(angle,0,shortcut.id),marker=new THREE.Mesh(new THREE.BoxGeometry(shortcut.width*2,.1,1),glow);marker.position.set(p.x,(p.y??0)+.3,p.z);marker.rotation.y=track.routeHeading(angle,shortcut.id);scene.add(marker);}
  }
  const arrowGeometry=new THREE.BufferGeometry();arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-1.3,0,-1,0,0,2,1.3,0,-1,0,0,0,-1.3,0,-1,1.3,0,-1],3));
  const arrows=new THREE.InstancedMesh(arrowGeometry,new THREE.MeshBasicMaterial({color:'#d2f8fc',side:THREE.DoubleSide,transparent:true,opacity:.65}),180);
  for(let i=0;i<180;i++){const angle=i/180*Math.PI*2,p=track.point(angle);dummy.position.set(p.x,(p.y??0)+.23,p.z);dummy.rotation.set(0,track.heading(angle),0);dummy.scale.setScalar(1.7);dummy.updateMatrix();arrows.setMatrixAt(i,dummy.matrix);}scene.add(arrows);
 }
 highlight(index:number){this.gates.forEach((m,i)=>m.color.set(i===index?'#a1fff3':i===0?'#ffe4a0':'#527c91'));}
}

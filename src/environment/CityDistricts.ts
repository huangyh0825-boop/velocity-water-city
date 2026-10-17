import * as THREE from 'three';import {CityTrack,DISTRICTS} from '../track/CityTrack';import {ModelBatch} from '../player/ModelBatch';import {glassFacade} from './CityEnvironment';import {inCitySample} from './CitySample';
import {readableSign} from './ReadableSign';
export class CityDistricts {
 readonly root=new THREE.Group();readonly details=new THREE.Group();private legacySample=new THREE.Group();
 constructor(scene:THREE.Scene,readonly track:CityTrack){
  this.root.add(this.details,this.legacySample);scene.add(this.root);
  const glass=new THREE.MeshStandardMaterial({color:'#b5dbe8',map:glassFacade(),metalness:.35,roughness:.23}),silver=new THREE.MeshStandardMaterial({color:'#c7d9e2',metalness:.45,roughness:.38}),stone=new THREE.MeshStandardMaterial({color:'#91adbd',roughness:.9}),dark=new THREE.MeshStandardMaterial({color:'#18364b',metalness:.4,roughness:.5}),glow=new THREE.MeshBasicMaterial({color:'#96faff'});
  const base=new ModelBatch(),detail=new ModelBatch();
  const terrainVertices:number[]=[];
  for(let i=1;i<track.samples.length;i++)for(const side of [-1,1]){
    const a=track.samples[i-1],b=track.samples[i],point=(s:typeof a,offset:number)=>({x:s.x+Math.cos(s.heading)*(s.width+offset)*side,z:s.z-Math.sin(s.heading)*(s.width+offset)*side});
    const corners=[point(a,1.8),point(a,13),point(b,1.8),point(b,13)];
    for(const ids of [[0,1,2],[1,3,2]]){const points=ids.map(id=>corners[id]),center={x:points.reduce((s,p)=>s+p.x,0)/3,z:points.reduce((s,p)=>s+p.z,0)/3};
      if(points.some(p=>track.contains(p,-.8))||track.contains(center,-.8))continue;
      for(const p of points)terrainVertices.push(p.x,.18,p.z);
    }
  }
  const terrainGeometry=new THREE.BufferGeometry();terrainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(terrainVertices,3));terrainGeometry.computeVertexNormals();
  const shore=new THREE.Mesh(terrainGeometry,new THREE.MeshStandardMaterial({color:'#b7cbd4',roughness:.95,side:THREE.DoubleSide}));this.root.add(shore);
  const part=(batch:ModelBatch,g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,rotation=0)=>batch.add(g,m,new THREE.Vector3(x,y,z),undefined,new THREE.Euler(0,rotation,0));
  const mainBase=base,mainDetail=detail;
  for(let zone=0;zone<6;zone++)for(let j=0;j<10;j++){
   const angle=(zone+(j+.25)/10)/6*Math.PI*2,side=j%2?1:-1,lane=side*(track.widthAt(angle)+25+(j%3)*20),p=track.point(angle,lane),heading=track.heading(angle),height=35+(j*13%65);
   // Building podiums are deliberately outside all legal water corridors, including cuts.
   if(track.contains(p, -15))continue;
   const sample=inCitySample(track,angle),base=sample?new ModelBatch():mainBase,detail=sample?new ModelBatch():mainDetail;
   part(base,new THREE.CylinderGeometry(17,19,1.8,8),stone,p.x,.7,p.z,heading);
   if(zone===0){
    for(let tier=0;tier<3;tier++)part(base,new THREE.BoxGeometry(24-tier*5,height/3,24-tier*5),tier===0?stone:glass,p.x,(tier+.5)*height/3,p.z,heading);
   }else if(zone===1){
    const g=new THREE.CylinderGeometry(8,15,height,4,1);g.translate(5,height/2,0);part(base,g,glass,p.x,0,p.z,heading+.3);
    part(detail,new THREE.TorusGeometry(10,.35,5,4),silver,p.x,height+1,p.z,heading+.3);
   }else if(zone===2||zone===5){
    const outline=[new THREE.Vector2(14,0),new THREE.Vector2(14,8),new THREE.Vector2(10,height*.6),new THREE.Vector2(6,height),new THREE.Vector2(2,height+12)];
    part(base,new THREE.LatheGeometry(outline,12),glass,p.x,0,p.z,heading);
    for(let band=0;band<5;band++)part(detail,new THREE.CylinderGeometry(14-band*1.5,14-band*1.5,.4,12),silver,p.x,8+band*height/5,p.z,heading);
   }else if(zone===3){
    part(base,new THREE.BoxGeometry(30,24,24),stone,p.x,12,p.z,heading);part(base,new THREE.CylinderGeometry(7,8,38,8),glass,p.x,43,p.z,heading);
   }else{
    part(base,new THREE.BoxGeometry(35,15,24),silver,p.x,7.5,p.z,heading);part(base,new THREE.CylinderGeometry(17,17,8,3),dark,p.x,18,p.z,heading+Math.PI/2);
    part(detail,new THREE.BoxGeometry(1,33,1),silver,p.x+12,16,p.z);part(detail,new THREE.BoxGeometry(25,.7,.7),silver,p.x+3,32,p.z);
   }
   for(let rib=0;rib<3;rib++){const off=(rib-1)*5;part(detail,new THREE.BoxGeometry(.22,height,1),silver,p.x+Math.cos(heading)*off,height/2,p.z-Math.sin(heading)*off,heading);}
   if(sample){base.build(this.legacySample);detail.build(this.legacySample);}
  }
  for(const fraction of [.29,.40,.91]){
   const a=fraction*Math.PI*2,p=track.point(a),heading=track.heading(a),width=track.widthAt(a),group=new THREE.Group(),batch=new ModelBatch();group.position.set(p.x,0,p.z);group.rotation.y=heading;
   if(fraction<.35)part(batch,new THREE.TorusGeometry(width+5,.65,8,48,Math.PI),silver,0,19,0);
   else if(fraction<.5){
     for(const side of [-1,1]){part(batch,new THREE.BoxGeometry(.8,32,.8),silver,side*(width+4),23,0);
       const cable=new THREE.LineCurve3(new THREE.Vector3(side*(width+4),39,0),new THREE.Vector3(-side*width,19,0));part(batch,new THREE.TubeGeometry(cable,1,.08,5,false),silver,0,0,0);}
   }else{part(batch,new THREE.BoxGeometry(width*2+12,.8,1),silver,0,23,-2.6);part(batch,new THREE.BoxGeometry(width*2+12,.8,1),silver,0,23,2.6);}
   part(batch,new THREE.BoxGeometry(width*2+12,.8,7),silver,0,19,0);
   for(const side of [-1,1]){part(batch,new THREE.BoxGeometry(2,19,4),stone,side*(width+5),9.5,0);part(batch,new THREE.BoxGeometry(width*2+12,.15,.2),glow,0,20,side*3.2);}
   batch.build(group);this.root.add(group);
  }
  for(let i=Math.floor(track.samples.length*.48);i<track.samples.length*.56;i+=4){const a=track.samples[i],b=track.samples[i+4],heading=Math.atan2(b.x-a.x,b.z-a.z),length=Math.hypot(b.x-a.x,b.z-a.z);
    part(base,new THREE.BoxGeometry(a.width*2+3,.8,length+.6),dark,(a.x+b.x)/2,14.5,(a.z+b.z)/2,heading);
    for(const side of [-1,1]){const original=a.width+1.5;let extent=original;
      // The redesigned underpass must not pass through a legacy roof support.
      for(let attempt=0;attempt<16;attempt++){const p={x:a.x+Math.cos(heading)*extent*side,z:a.z-Math.sin(heading)*extent*side};if(track.shortcuts.every(c=>track.project(p,c.id).distance>c.width+1.4))break;extent+=2;}
      part(base,new THREE.BoxGeometry(.6,13,.6),silver,a.x+Math.cos(heading)*extent*side,7,a.z-Math.sin(heading)*extent*side,heading);
      if(extent>original)part(base,new THREE.BoxGeometry(extent-original+.6,.8,1.2),silver,a.x+Math.cos(heading)*(extent+original)*.5*side,13.8,a.z-Math.sin(heading)*(extent+original)*.5*side,heading);
      part(detail,new THREE.BoxGeometry(.12,.08,length),glow,(a.x+b.x)/2+Math.cos(heading)*(a.width-1)*side,13.9,(a.z+b.z)/2-Math.sin(heading)*(a.width-1)*side,heading);}
  }
  const cut=track.shortcuts[0];
  for(let i=8;i<cut.samples.length-8;i+=4){const a=cut.samples[i],b=cut.samples[i+4],length=Math.hypot(b.x-a.x,b.z-a.z),heading=Math.atan2(b.x-a.x,b.z-a.z);
   part(base,new THREE.BoxGeometry(cut.width*2+2,.8,length+.4),dark,(a.x+b.x)/2,11,(a.z+b.z)/2,heading);
   for(const side of [-1,1])part(detail,new THREE.BoxGeometry(.15,.12,length),glow,(a.x+b.x)/2+Math.cos(heading)*side*(cut.width-.5),10.55,(a.z+b.z)/2-Math.sin(heading)*side*(cut.width-.5),heading);
  }
  const railA=track.point(.18*Math.PI*2,100),railB=track.point(.28*Math.PI*2,100),railHeading=Math.atan2(railB.x-railA.x,railB.z-railA.z),railLength=Math.hypot(railB.x-railA.x,railB.z-railA.z);
  part(detail,new THREE.BoxGeometry(4,.65,railLength),silver,(railA.x+railB.x)/2,29,(railA.z+railB.z)/2,railHeading);
  for(let i=0;i<=6;i++){const f=i/6,x=railA.x+(railB.x-railA.x)*f,z=railA.z+(railB.z-railA.z)*f;if(!track.contains({x,z},-4))part(detail,new THREE.BoxGeometry(.9,29,.9),stone,x,14.5,z);}
  base.build(this.root);detail.build(this.details);
  for(let zone=0;zone<6;zone++){
   const a=(zone+.05)/6*Math.PI*2,p=track.point(a,track.widthAt(a)+7),canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const ctx=canvas.getContext('2d')!;
   ctx.fillStyle='#ecf8ff';ctx.fillRect(0,0,512,160);ctx.fillStyle='#195776';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillText(DISTRICTS[zone],256,75);ctx.font='20px sans-serif';ctx.fillText('AURORA CITY  /  RACING DISTRICT',256,125);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sign=readableSign(texture,10,3.2,`district-sign-${zone}`);sign.position.set(p.x,4,p.z);sign.rotation.y=track.heading(a);this.details.add(sign);
  }
 }
 setLow(low:boolean){this.details.visible=!low;}
 setSampleLoaded(loaded:boolean){this.legacySample.visible=!loaded;}
}

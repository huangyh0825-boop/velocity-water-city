import * as THREE from 'three';import {CityTrack} from '../track/CityTrack';import {ModelBatch} from '../player/ModelBatch';

import {trackClearance} from '../track/TrackClearance';
export class CityDistricts {
 readonly root=new THREE.Group();readonly details=new THREE.Group();private legacySample=new THREE.Group();
 constructor(scene:THREE.Scene,readonly track:CityTrack){
  const clearance=trackClearance(track);this.root.userData.buildings=[];
  this.root.name='city-engineering-shell';
  this.root.add(this.details,this.legacySample);scene.add(this.root);
  const silver=new THREE.MeshStandardMaterial({color:'#c7d9e2',metalness:.45,roughness:.38}),stone=new THREE.MeshStandardMaterial({color:'#91adbd',roughness:.9}),dark=new THREE.MeshStandardMaterial({color:'#18364b',metalness:.4,roughness:.5}),glow=new THREE.MeshBasicMaterial({color:'#96faff'});
  silver.name='world-infrastructure-alloy';stone.name='world-quay-concrete';dark.name='world-infrastructure-dark';
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
  shore.name='continuous-quay-ground';(shore.material as THREE.Material).name='world-quay-concrete';const uv:number[]=[];for(let i=0;i<terrainVertices.length;i+=3)uv.push(terrainVertices[i]/4,terrainVertices[i+2]/4);terrainGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));shore.receiveShadow=true;
  const part=(batch:ModelBatch,g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,rotation=0)=>{g.computeBoundingBox();const size=g.boundingBox!.getSize(new THREE.Vector3());(this.root.userData.cameraSolids??=[]).push({x,y,z,width:size.x,height:size.y,depth:size.z,heading:rotation});batch.add(g,m,new THREE.Vector3(x,y,z),undefined,new THREE.Euler(0,rotation,0));};
  // Authored GLB buildings now cover all six districts through CityDensity.
  // Crossing bridges use the original sample GLB engineering, not placeholders.
  for(let i=Math.floor(track.samples.length*.48);i<track.samples.length*.56;i+=4){const a=track.samples[i],b=track.samples[i+4],heading=Math.atan2(b.x-a.x,b.z-a.z),length=Math.hypot(b.x-a.x,b.z-a.z);
    part(base,new THREE.BoxGeometry(a.width*2+3,.8,length+.6),dark,(a.x+b.x)/2,14.5,(a.z+b.z)/2,heading);
    for(const side of [-1,1]){const original=a.width+1.5;let extent=original;
      // The redesigned underpass must not pass through a legacy roof support.
      for(let attempt=0;attempt<100;attempt++){const p={x:a.x+Math.cos(heading)*extent*side,z:a.z-Math.sin(heading)*extent*side};if(!clearance.intersects({...p,y:7,width:.6,depth:.6,height:13,heading}))break;extent+=2;}
      part(base,new THREE.BoxGeometry(.6,13,.6),silver,a.x+Math.cos(heading)*extent*side,7,a.z-Math.sin(heading)*extent*side,heading);
      if(extent>original)part(base,new THREE.BoxGeometry(extent-original+.6,.8,1.2),silver,a.x+Math.cos(heading)*(extent+original)*.5*side,13.8,a.z-Math.sin(heading)*(extent+original)*.5*side,heading);
      part(detail,new THREE.BoxGeometry(.12,.08,length),glow,(a.x+b.x)/2+Math.cos(heading)*(a.width-1)*side,13.9,(a.z+b.z)/2-Math.sin(heading)*(a.width-1)*side,heading);}
  }
  const cut=track.shortcuts[0];
  for(let i=8;i<cut.samples.length-8;i+=4){const a=cut.samples[i],b=cut.samples[i+4],length=Math.hypot(b.x-a.x,b.z-a.z),heading=Math.atan2(b.x-a.x,b.z-a.z);
   const roof=clearance.overhead((a.x+b.x)/2,(a.z+b.z)/2,a.width*2+2,length+.4,heading,11);
   part(base,new THREE.BoxGeometry(a.width*2+2,.8,length+.4),dark,(a.x+b.x)/2,roof,(a.z+b.z)/2,heading);
   for(const side of [-1,1])part(detail,new THREE.BoxGeometry(.15,.12,length),glow,(a.x+b.x)/2+Math.cos(heading)*side*(a.width-.5),roof-.45,(a.z+b.z)/2-Math.sin(heading)*side*(a.width-.5),heading);
  }
  const railA=track.point(.18*Math.PI*2,100),railB=track.point(.28*Math.PI*2,100),railHeading=Math.atan2(railB.x-railA.x,railB.z-railA.z),railLength=Math.hypot(railB.x-railA.x,railB.z-railA.z);
  part(detail,new THREE.BoxGeometry(4,.65,railLength),silver,(railA.x+railB.x)/2,29,(railA.z+railB.z)/2,railHeading);
  for(let i=0;i<=6;i++){const f=i/6,x=railA.x+(railB.x-railA.x)*f,z=railA.z+(railB.z-railA.z)*f;if(!clearance.intersects({x,y:14.5,z,width:.9,depth:.9,height:29}))part(detail,new THREE.BoxGeometry(.9,29,.9),stone,x,14.5,z);}
  base.build(this.root);detail.build(this.details);

 }
 setLow(low:boolean){this.details.visible=!low;}
 setSampleLoaded(loaded:boolean){this.legacySample.visible=!loaded;}
}

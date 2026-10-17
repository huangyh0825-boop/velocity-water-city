import * as THREE from 'three';
import {CityTrack} from './CityTrack';
import {NATURAL_JUMPS} from './Elevation';
import {Water} from '../effects/Water';
import {ModelBatch} from '../player/ModelBatch';
import {readableSign} from '../environment/ReadableSign';
import {trackClearance} from './TrackClearance';
/** Original, visual-only infrastructure. Collision and race paths come from CityTrack. */
export class VerticalTrackView {
 readonly root=new THREE.Group();
 constructor(scene:THREE.Scene,track:CityTrack,water:Water){
  const clearance=trackClearance(track);
  this.root.name='vertical-track-infrastructure';scene.add(this.root);
  const batch=new ModelBatch(),alloy=new THREE.MeshStandardMaterial({color:'#9db7c3',metalness:.62,roughness:.4}),dark=new THREE.MeshStandardMaterial({color:'#263f50',metalness:.45,roughness:.56}),cyan=new THREE.MeshBasicMaterial({color:'#91fff2'}),purple=new THREE.MeshBasicMaterial({color:'#d0b1ff'});
  const part=(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Vector3,h=0)=>{g.rotateY(h);batch.add(g,m,p);};
  const routes=[{id:null as string|null,samples:track.samples},...track.shortcuts.map(s=>({id:s.id,samples:s.samples}))];
  for(const route of routes){
   // Include the exact supported side of discontinuous spillway lips, instead
   // of ending the visual deck one coarse route sample before the physics lip.
   const points=[...route.samples];
   for(const jump of NATURAL_JUMPS)if(jump.route===route.id&&jump.id!=='crest-8'){const cut=track.shortcuts.find(s=>s.id===route.id),angle=(cut?cut.from+(cut.to-cut.from)*jump.t:jump.t*Math.PI*2)-1e-7,p=track.routePoint(angle,0,route.id);points.push({...p,angle,heading:track.routeHeading(angle,route.id),width:cut?.width??track.widthAt(angle),branch:route.id});}
   points.sort((a,b)=>a.angle-b.angle);
   const vertices:number[]=[],underside:number[]=[];
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];if(Math.max(a.y??0,b.y??0)<.05||(a.y??0)-(b.y??0)>2)continue;
    const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z))),width=a.width-.15;
    for(let j=0;j<count;j++){
     const aa=a.angle+(b.angle-a.angle)*j/count,bb=a.angle+(b.angle-a.angle)*(j+1)/count;
     for(let k=0;k<12;k++){
      const l=-width+2*width*k/12,r=-width+2*width*(k+1)/12,p=track.routePoint(aa,l,route.id),q=track.routePoint(aa,r,route.id),s=track.routePoint(bb,l,route.id),t=track.routePoint(bb,r,route.id);
      if(Math.min(p.y??0,s.y??0)<.025)continue;
      // Upward winding, matching the displaced global-water shader exactly.
      for(const v of [p,s,q,q,s,t])vertices.push(v.x,v.y??0,v.z);
      for(const v of [p,q,s,q,t,s])underside.push(v.x,(v.y??0)-.55,v.z);
     }
    }
    if(i%5===0&&(a.y??0)>2)for(const side of [-1,1]){const p=track.routePoint(a.angle,(a.width+2)*side,route.id),height=(a.y??0)-.8;
      if(clearance.intersects({x:p.x,y:height/2,z:p.z,width:2.2,depth:2.2,height}))continue;
      part(new THREE.CylinderGeometry(.75,1.1,height,8),alloy,new THREE.Vector3(p.x,height/2,p.z));
      part(new THREE.BoxGeometry(a.width*2+5,.65,1.6),dark,new THREE.Vector3(a.x,(a.y??0)-.85,a.z),a.heading);
    }
   }
   if(vertices.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeBoundingSphere();this.root.add(water.channel(geometry));
    const floor=new THREE.BufferGeometry();floor.setAttribute('position',new THREE.Float32BufferAttribute(underside,3));floor.computeVertexNormals();this.root.add(new THREE.Mesh(floor,dark));
   }
  }
  const sign=(text:string,angle:number,route:string|null,offset=0,color='#96fff2')=>{
   const p=track.routePoint(angle,offset,route),group=new THREE.Group();group.position.set(p.x,(p.y??0),p.z);group.rotation.y=track.routeHeading(angle,route);group.name=`vertical-sign-${text}`;
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d')!;c.fillStyle='#102d3f';c.fillRect(0,0,1024,256);c.fillStyle=color;c.fillRect(10,10,1004,8);c.font='bold 49px sans-serif';c.textAlign='center';c.fillText(text,512,109);c.fillStyle='#e6f7ff';c.font='29px sans-serif';c.fillText(route==='tunnel-cut'?'UNDERPASS / KEEP RIGHT AT MERGE':route?'AERIAL CUT / SAFE LANDING AHEAD':'AURORA RACEWAY / KEEP FORWARD',512,185);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const panel=readableSign(texture,12,3,`route-panel-${text}`);let panelHeight=9.4;
   while(clearance.intersects({x:p.x,y:(p.y??0)+panelHeight,z:p.z,width:12,depth:.5,height:3,heading:group.rotation.y}))panelHeight++;
   panel.position.y=panelHeight;group.add(panel);
   const heading=group.rotation.y,span=offset===0?track.routeWidth(angle,route)+2:7.2;
   (this.root.userData.signs??=[]).push({text,angle,route,offset,span,x:p.x,z:p.z,heading});
   for(const side of [-1,1]){part(new THREE.CylinderGeometry(.18,.3,panelHeight+.6,8),alloy,new THREE.Vector3(p.x+Math.cos(heading)*side*span,(p.y??0)+(panelHeight+.6)/2,p.z-Math.sin(heading)*side*span),heading);part(new THREE.BoxGeometry(.12,panelHeight-1,.14),route==='harbor-cut'?purple:cyan,new THREE.Vector3(p.x+Math.cos(heading)*side*(span-.1)-Math.sin(heading)*.3,(p.y??0)+panelHeight/2,p.z-Math.sin(heading)*side*(span-.1)-Math.cos(heading)*.3),heading);}
   this.root.add(group);
  };
  for(const [index,cut]of track.shortcuts.entries()){
   sign(index?'S2 高架飞跃 / IN':'S1 城市隧道 / IN',cut.from+(cut.to-cut.from)*(cut.entryPortal??.15),cut.id,0,index?'#d0b1ff':'#91fff2');
   sign(index?'S2 合流 / OUT':'S1 合流 / OUT',cut.from+(cut.to-cut.from)*(cut.exitPortal??.85),cut.id,0,index?'#d0b1ff':'#91fff2');
   const side=Math.sign(track.project(track.routePoint(cut.from+(cut.to-cut.from)*.20,0,cut.id),null).offset)||1;
   // +Z is boat-forward, so +local X projects to the driver's screen-left.
   sign(`S${index+1} ${side>0?'↖':'↗'} / MAIN ↑`,cut.from-80/track.radius,null,side*(track.widthAt(cut.from-80/track.radius)+10),index?'#d0b1ff':'#91fff2');
   // Portal ribs and interior side panels follow the actual curved branch.
   if(!index)for(let i=Math.ceil((cut.entryPortal??.15)*128);i<Math.floor((cut.exitPortal??.85)*128);i+=5){const p=cut.samples[i],h=p.heading,points=Array.from({length:17},(_,j)=>{const a=j/16*Math.PI;return new THREE.Vector3(Math.cos(a)*(p.width+.5),.8+Math.sin(a)*8.6,0);});
     part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.23,6,false),alloy,new THREE.Vector3(p.x,0,p.z),h);
     for(const side of [-1,1]){const q=track.routePoint(p.angle,side*(p.width+.5),cut.id);part(new THREE.BoxGeometry(.35,4.6,Math.max(4,cut.length/128*5)),dark,new THREE.Vector3(q.x,3,q.z),h);part(new THREE.BoxGeometry(.1,.12,8),cyan,new THREE.Vector3(q.x,4.8,q.z),h);}
   }
   const arrow=new THREE.BufferGeometry();arrow.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,-1,0,0,2,1,0,-1],3));const markers=new THREE.InstancedMesh(arrow,index?purple:cyan,60),dummy=new THREE.Object3D();
   for(let i=0;i<60;i++){const angle=cut.from+(cut.to-cut.from)*(i+.5)/60,p=track.routePoint(angle,0,cut.id);dummy.position.set(p.x,(p.y??0)+.22,p.z);dummy.rotation.set(0,track.routeHeading(angle,cut.id),0);dummy.updateMatrix();markers.setMatrixAt(i,dummy.matrix);}this.root.add(markers);
  }
  for(const jump of NATURAL_JUMPS){const cut=track.shortcuts.find(s=>s.id===jump.route),angle=cut?cut.from+(cut.to-cut.from)*jump.t:jump.t*Math.PI*2;
   sign(jump.id==='crest-8'?'8m 凸坡 / CREST':`${jump.height}m 落差 / DROP`,angle-45/(cut?.length??track.length)*(cut?cut.to-cut.from:Math.PI*2),jump.route,0,jump.route?'#d0b1ff':'#ffc45f');
   if(jump.id==='crest-8')continue;
   const p=track.routePoint(angle,0,jump.route),sheet=new THREE.Mesh(new THREE.PlaneGeometry((cut?.width??track.widthAt(angle))*1.9,jump.height),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:water.mesh.material.uniforms.time},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float time;varying vec2 uv0;void main(){float strands=.45+.55*sin(uv0.x*140.+sin(uv0.y*25.+time*5.));gl_FragColor=vec4(.34,.75,.87,.14+strands*.15);}' }));sheet.position.set(p.x,jump.height/2,p.z);sheet.rotation.y=track.routeHeading(angle,jump.route);sheet.name=`spill-curtain-${jump.id}`;this.root.add(sheet);
  }
  batch.build(this.root);
 }
}

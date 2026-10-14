import * as THREE from 'three';
import { Track, TAU } from '../track/Track';
import { ModelBatch } from '../player/ModelBatch';
import {readableSign} from './ReadableSign';
export const BRIDGE_ANGLES=[.95,3.05,5.55] as const;
export const BRIDGE_CLEARANCE=18;
export function cityLayout(track:Track){
  return Array.from({length:36},(_,i)=>{
    const angle=i/36*TAU,radius=track.radius+100+(i%3)*38;
    return {x:Math.cos(angle)*radius,z:Math.sin(angle)*radius,angle,width:12+(i%4)*3,height:28+(i*17%79)};
  });
}
/** Original generated facade texture: bright glass panels and silver mullions. */
export function glassFacade(){
  const width=64,height=128,pixels=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const k=(y*width+x)*4,frame=x%16<2||y%16<2,stripe=(Math.floor(x/16)+Math.floor(y/16))%3;
    const c=frame?[177,212,223]:stripe===0?[85,150,180]:stripe===1?[120,184,204]:[105,169,195];
    pixels.set([...c,255],k);
  }
  const texture=new THREE.DataTexture(pixels,width,height);texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  return texture;
}
export class CityEnvironment {
  readonly root=new THREE.Group();
  readonly details=new THREE.Group();
  constructor(scene:THREE.Scene,track:Track){
    this.root.name='daylight-city';this.details.name='city-detail';this.root.add(this.details);scene.add(this.root);
    const glass=new THREE.MeshStandardMaterial({color:'#d9eef7',map:glassFacade(),metalness:.18,roughness:.3});
    const white=new THREE.MeshStandardMaterial({color:'#e3edf0',metalness:.25,roughness:.6});
    const metal=new THREE.MeshStandardMaterial({color:'#6b8b9e',metalness:.55,roughness:.38});
    const glow=new THREE.MeshBasicMaterial({color:'#6edce9'}),layout=cityLayout(track),dummy=new THREE.Object3D();
    const towers=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),glass,layout.length);
    const crowns=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),white,layout.length);
    const fins=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),metal,layout.length);
    layout.forEach((b,i)=>{
      dummy.position.set(b.x,b.height/2+.5,b.z);dummy.rotation.y=-b.angle;dummy.scale.set(b.width,b.height,b.width*1.2);dummy.updateMatrix();towers.setMatrixAt(i,dummy.matrix);
      towers.setColorAt(i,new THREE.Color(i%3===0?'#d7eff8':'#b7daeb'));
      dummy.position.y=b.height+1;dummy.scale.set(b.width+1.2,1.3,b.width*1.2+1.2);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);
      dummy.position.y=b.height+5;dummy.scale.set(.7,8,b.width*.8);dummy.updateMatrix();fins.setMatrixAt(i,dummy.matrix);
    });
    this.root.add(towers,crowns);this.details.add(fins);
    const boulevard=new THREE.Mesh(new THREE.RingGeometry(track.radius+30,360,128),new THREE.MeshStandardMaterial({color:'#d0dce1',roughness:.95}));
    boulevard.rotation.x=-Math.PI/2;boulevard.position.y=.32;this.root.add(boulevard);
    for(const angle of BRIDGE_ANGLES){
      const group=new THREE.Group(),p=track.point(angle);group.position.set(p.x,0,p.z);group.rotation.y=track.heading(angle);
      const batch=new ModelBatch(),part=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>batch.add(g,m,new THREE.Vector3(x,y,z));
      part(new THREE.BoxGeometry(58,.7,6),white,0,BRIDGE_CLEARANCE+.35,0);
      for(const side of [-1,1]){
        part(new THREE.BoxGeometry(2.2,18,4),white,side*27,9,0);
        part(new THREE.BoxGeometry(58,.25,.22),metal,0,20,side*2.8);
        part(new THREE.BoxGeometry(58,.1,.15),glow,0,19,side*2.8);
        for(let x=-26;x<=26;x+=6)part(new THREE.BoxGeometry(.14,1.7,.14),metal,x,19.15,side*2.8);
      }
      batch.build(group);this.root.add(group);
    }
    const batch=new ModelBatch();
    for(let i=0;i<48;i++){
      const angle=i/48*TAU,p=track.point(angle,track.halfWidth+6);
      batch.add(new THREE.BoxGeometry(.25,5,.25),metal,new THREE.Vector3(p.x,2.5,p.z));
      batch.add(new THREE.BoxGeometry(.42,.16,1.3),white,new THREE.Vector3(p.x,5,p.z),undefined,new THREE.Euler(0,-angle,0));
    }
    batch.build(this.details);
    const labels=['AQUA / CITY','VELOCITY LAB','SKYLINE RACING','FLOW ENERGY'];
    for(let i=0;i<8;i++){
      const angle=(i+.25)/8*TAU,p=track.point(angle,track.halfWidth+8),sign=new THREE.Group();
      sign.position.set(p.x,4.8,p.z);sign.rotation.y=track.heading(angle);
      const frame=new THREE.Mesh(new THREE.BoxGeometry(8.4,3.2,.35),white);sign.add(frame);
      const material=new THREE.MeshBasicMaterial({color:'#ffffff'});
      if(typeof document!=='undefined'){
        const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;
        const ctx=canvas.getContext('2d')!;ctx.fillStyle='#d7f2fb';ctx.fillRect(0,0,512,192);
        ctx.fillStyle='#126488';ctx.fillRect(0,150,512,42);ctx.fillStyle='#104b69';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillText(labels[i%4],256,87);
        ctx.fillStyle='#fff';ctx.font='20px sans-serif';ctx.fillText('→  FUTURE WATERSPORT  →',256,179);
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;
      }
      const face=readableSign(material.map!,8,2.8,`legacy-advert-${i}`,.4);sign.add(face);material.dispose();
      const post=new THREE.Mesh(new THREE.BoxGeometry(.35,4,.35),metal);post.position.y=-3;sign.add(post);this.details.add(sign);
    }
  }
  setLow(low:boolean){this.details.visible=!low;}
}

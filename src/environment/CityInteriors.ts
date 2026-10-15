import * as THREE from 'three';
import {type CityModule,type CitySite,sampleLocal} from './CityDensityLayout';
import {CityTrack} from '../track/CityTrack';

export const INTERIOR_BAYS:Partial<Record<CityModule,{x:number;back:number;width:number;depth:number;floor:number;height:number}>>={
 harbor_control:{x:-3.8,back:-5,width:1.5,depth:2.1,floor:1,height:3.5},
 service_arcade:{x:-6.5,back:-5.2,width:3,depth:1.8,floor:1,height:4.4},
 ferry_terminal:{x:-5.7,back:-8.15,width:3,depth:2.2,floor:1.1,height:4.6},
 market_galleria:{x:-7.6,back:-8.55,width:2.8,depth:2.4,floor:1.4,height:5.4},
 service_depot:{x:-1.8,back:-4.45,width:2.6,depth:1.8,floor:1,height:3.8},
};
/** Only two occupied bays per selected type; no physics, point lights or full interiors. */
export function interiorSites(sites:CitySite[]){return Object.keys(INTERIOR_BAYS).flatMap(kind=>[-1,1].flatMap(side=>sites.filter(s=>s.kind===kind&&s.side===side&&s.layer!=='skyline').slice(0,1)));}
interface Piece {matrix:THREE.Matrix4;site:CitySite}
interface Pool {mesh:THREE.InstancedMesh;pieces:Piece[]}

export class CityInteriors {
 readonly root=new THREE.Group();readonly selected:CitySite[];
 private pools:Pool[]=[];private materials:THREE.Material[]=[];private texture:THREE.CanvasTexture;private wallTexture:THREE.CanvasTexture;
 private lastCamera=new THREE.Vector3(Infinity,Infinity,Infinity);private low=false;
 constructor(private track:CityTrack,sites:CitySite[]){
  this.root.name='occupied-waterfront-bays';this.selected=interiorSites(sites);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d')!;
  c.fillStyle='#173a4c';c.fillRect(0,0,512,256);c.strokeStyle='#69d1dd';c.lineWidth=4;c.strokeRect(12,12,488,232);c.fillStyle='#b4e1e4';c.font='bold 37px sans-serif';c.fillText('RACE / SERVICE',30,65);c.font='22px sans-serif';c.fillText('QUAY  07     /     ARRIVALS',30,107);
  for(let i=0;i<5;i++){c.fillStyle=i%2?'#8abbc1':'#d1ac71';c.fillRect(30,138+i*16,130+i*53,5);}
  this.texture=new THREE.CanvasTexture(canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
  const wallCanvas=document.createElement('canvas');wallCanvas.width=wallCanvas.height=256;const wc=wallCanvas.getContext('2d')!,wash=wc.createRadialGradient(128,125,45,128,128,180);wash.addColorStop(0,'#b8c3b9');wash.addColorStop(.7,'#9aaba8');wash.addColorStop(1,'#475d65');wc.fillStyle=wash;wc.fillRect(0,0,256,256);wc.fillStyle='#354e5a';wc.fillRect(0,193,256,63);wc.fillStyle='#6a858e';wc.fillRect(0,191,256,3);wc.fillRect(17,16,2,174);wc.fillRect(237,16,2,174);
  this.wallTexture=new THREE.CanvasTexture(wallCanvas);this.wallTexture.colorSpace=THREE.SRGBColorSpace;
  const wall=new THREE.MeshStandardMaterial({map:this.wallTexture,roughness:.82,envMapIntensity:.4}),frame=new THREE.MeshStandardMaterial({color:'#526574',metalness:.65,roughness:.35}),floor=new THREE.MeshStandardMaterial({color:'#354b56',roughness:.77,envMapIntensity:.4}),furniture=new THREE.MeshStandardMaterial({color:'#647f89',roughness:.55,metalness:.12,envMapIntensity:.4}),warm=new THREE.MeshBasicMaterial({color:'#ffe0a5'}),screen=new THREE.MeshBasicMaterial({map:this.texture}),pane=new THREE.MeshPhysicalMaterial({color:'#b1d5df',metalness:0,roughness:.12,transparent:true,opacity:.14,depthWrite:false,clearcoat:.4,envMapIntensity:.8});
  this.materials=[wall,frame,floor,furniture,warm,screen,pane];
  const rows:Piece[][]=this.materials.map(()=>[]),unit=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
  for(const s of this.selected){
   const bay=INTERIOR_BAYS[s.kind]!,{x,back,width:w,depth:d,floor:y,height:h}=bay,front=back-d,mid=(front+back)/2;
   const parent=new THREE.Matrix4().compose(new THREE.Vector3(s.x,.265-.25*s.scaleY,s.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),s.heading),new THREE.Vector3(s.scaleXZ,s.scaleY,s.scaleXZ));
   const box=(mat:number,px:number,py:number,pz:number,sx:number,sy:number,sz:number,ry=0)=>{dummy.position.set(px,py,pz);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,ry,0);dummy.updateMatrix();rows[mat].push({site:s,matrix:parent.clone().multiply(dummy.matrix)});};
   // A real shallow cavity with side reveals and ceiling, ahead of the opaque facade.
   box(0,x,y+h/2,back,w,h,.10);box(2,x,y,mid,w,.10,d);box(0,x,y+h,mid,w,.12,d);
   box(2,x,(y+.25)/2,mid,w+.1,y-.25,d+.1);
   for(const side of [-1,1]){box(0,x+side*w/2,y+h/2,mid,.11,h,d);box(1,x+side*w/2,y+h/2,front-.02,.08,h,.1);}
   box(1,x,y+h,front,w+.13,.11,.13);box(1,x,y,front,w+.13,.11,.13);
   // Service counter, recessed wall display, equipment cabinet and short partition.
   box(3,x,y+.65,front+d*.55,w*.66,1.2,.5);box(1,x,y+1.29,front+d*.55,w*.74,.08,.6);
   box(3,x+w*.27,y+1.45,back-.23,w*.2,2.6,.3);box(0,x-w*.24,y+1.2,back-.4,.09,2.3,.75);
   for(let i=0;i<3;i++){box(1,x+w*.27,y+.65+i*.62,back-.4,w*.18,.035,.02);box(3,x-w*.25,y+.65+i*.64,back-.18,w*.28,.06,.3);}
   box(4,x,y+.84,front+d*.55-.26,w*.46,.035,.012);
   // Screens face the approaching viewer (-Z); preserve readable text orientation.
   box(5,x-w*.08,y+h*.66,back-.09,w*.55,h*.24,.012,Math.PI);
   box(5,x,y+1.53,front+d*.59,.52,.35,.025,Math.PI);
   for(const side of [-1,1])box(4,x+side*w*.29,y+h-.08,mid,.09,.025,d*.7);
   box(4,x,y+.1,front+.14,w*.78,.025,.035);
   box(6,x,y+h*.5,front-.045,w-.13,h-.12,.02);
  }
  rows.forEach((pieces,i)=>{
   const mesh=new THREE.InstancedMesh(unit,this.materials[i],pieces.length);mesh.name=`interior-${['walls','frames','floors','furniture','light-strips','screens','panes'][i]}`;mesh.count=0;mesh.castShadow=i<4;mesh.receiveShadow=i<4;
   if(i===6)mesh.renderOrder=2;this.pools.push({mesh,pieces});this.root.add(mesh);
  });
 }
 setLow(low:boolean){this.low=low;this.lastCamera.set(Infinity,Infinity,Infinity);this.root.visible=!low;}
 update(camera:THREE.Vector3){
  if(this.low||this.lastCamera.distanceToSquared(camera)<16)return;this.lastCamera.copy(camera);const p=sampleLocal(this.track,camera);
  for(const pool of this.pools){let count=0;for(const piece of pool.pieces)if(Math.hypot(piece.site.x-p.x,piece.site.z-p.z)<115)pool.mesh.setMatrixAt(count++,piece.matrix);pool.mesh.count=count;pool.mesh.instanceMatrix.needsUpdate=true;pool.mesh.computeBoundingSphere();}
 }
 dispose(){this.root.removeFromParent();for(const p of this.pools)p.mesh.dispose();this.pools[0]?.mesh.geometry.dispose();this.materials.forEach(m=>m.dispose());this.texture.dispose();this.wallTexture.dispose();}
}

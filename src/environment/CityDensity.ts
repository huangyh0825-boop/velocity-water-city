import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CityTrack} from '../track/CityTrack';
import {citySites,cityLOD,sampleLocal,type CitySite,type CityModule} from './CityDensityLayout';
import {readableSign} from './ReadableSign';

interface Part {geometry:THREE.BufferGeometry;material:THREE.Material}
interface Library {scene:THREE.Group;parts:Map<string,Part[]>}
interface Batch {meshes:THREE.InstancedMesh[];used:number}
/** District art only: reusable authored GLBs, instancing, distance LOD and shared sign atlas. */
export class CityDensity {
 readonly root=new THREE.Group();readonly sites:CitySite[];
 loaded=false;error='';low=false;
 private cache=new Map<boolean,Promise<Library>>();private batches=new Map<string,Batch>();
 private generation=0;private disposed=false;private previous:number[];private poses:THREE.Matrix4[];
 private lastCamera=new THREE.Vector3(Infinity,Infinity,Infinity);private lastTime=-Infinity;
 private signs=new THREE.Group();private atlas:THREE.CanvasTexture;
 private terrain:THREE.Mesh;private links=new THREE.Group();
 constructor(private track:CityTrack){
  this.root.name='layered-city-district';this.sites=citySites(track);this.previous=this.sites.map(()=>-1);
  this.poses=this.sites.map(s=>new THREE.Matrix4().compose(new THREE.Vector3(s.x,.265-.25*s.scaleY,s.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),s.heading),new THREE.Vector3(s.scaleXZ,s.scaleY,s.scaleXZ)));
  this.terrain=this.makeTerrain();this.atlas=this.makeSigns();this.makeConnections();this.root.add(this.terrain,this.signs,this.links);
 }
 async setLow(low:boolean){
  const request=++this.generation;this.low=low;
  try{
   let promise=this.cache.get(low);
   if(!promise){promise=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/city-sample/city-modules${low?'-low':''}.glb`).then(g=>{
    const parts=new Map<string,Part[]>();g.scene.updateMatrixWorld(true);
    for(const kind of new Set(this.sites.map(s=>s.kind)))for(const tier of ['near','mid','far']){
     const root=g.scene.getObjectByName(`${kind}__${tier}`);if(!root)throw new Error(`Missing city module ${kind}__${tier}`);
     const list:Part[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh){
      const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);const material=o.material as THREE.MeshStandardMaterial;
      if(material instanceof THREE.MeshStandardMaterial){material.envMapIntensity=.55;material.aoMapIntensity=.7;
       if(/glazing/.test(material.name)){material.metalness=0;material.envMapIntensity=.7;if(/Blue/.test(material.name))material.color.set('#d4e0e6');else if(/Silver/.test(material.name))material.color.set('#8ca2ad');}
       if(/Graphite joint/.test(material.name)){material.color.set('#14212a');material.metalness=.05;}
       if(low){material.normalMap=null;if(material instanceof THREE.MeshPhysicalMaterial)material.clearcoat=0;}
      }
      list.push({geometry,material});
     }});parts.set(`${kind}:${tier}`,list);
    }
    return {scene:g.scene,parts};
   });this.cache.set(low,promise);}
   const library=await promise;if(this.disposed||request!==this.generation)return;
   let concrete:THREE.MeshStandardMaterial|undefined;library.scene.traverse(o=>{if(o instanceof THREE.Mesh&&/Concrete034/.test((o.material as THREE.Material).name))concrete=o.material as THREE.MeshStandardMaterial;});
   if(concrete){(this.terrain.material as THREE.Material).dispose();const material=concrete.clone();material.color.set('#88989f');material.side=THREE.DoubleSide;this.terrain.material=material;}
   this.clearInstances();
   for(const kind of new Set(this.sites.map(s=>s.kind)))for(const tier of ['near','mid','far']){
    const meshes=library.parts.get(`${kind}:${tier}`)!.map(part=>{
     const mesh=new THREE.InstancedMesh(part.geometry,part.material,this.sites.filter(s=>s.kind===kind).length);mesh.name=`city-${kind}-${tier}`;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=!low&&tier==='near';mesh.receiveShadow=!low;this.root.add(mesh);return mesh;
    });this.batches.set(`${kind}:${tier}`,{meshes,used:0});
   }
   this.signs.visible=!low;this.links.visible=!low;this.loaded=true;this.error='';this.previous.fill(-1);this.lastTime=-Infinity;
   const center=this.track.point(.06*Math.PI*2);this.update(new THREE.Vector3(center.x,5,center.z),0,true);
  }catch(e){if(request===this.generation&&!this.disposed){this.error=String(e);this.cache.delete(low);throw e;}}
 }
 update(camera:THREE.Vector3,time:number,force=false){
  if(!this.loaded)return;
  if(!force&&time-this.lastTime<.15&&this.lastCamera.distanceToSquared(camera)<64)return;
  this.lastTime=time;this.lastCamera.copy(camera);for(const b of this.batches.values())b.used=0;
  const local=sampleLocal(this.track,camera),color=new THREE.Color(),tints=['#ffffff','#cbdbe1','#e7dcc6','#c9dcd4'];
  for(let i=0;i<this.sites.length;i++){
   const s=this.sites[i],distance=Math.hypot(s.x-local.x,s.z-local.z),tier=cityLOD(s.layer,distance,this.previous[i],this.low);this.previous[i]=tier;
   const b=this.batches.get(`${s.kind}:${['near','mid','far'][tier]}`)!;color.set(tints[s.tint]);
   for(const mesh of b.meshes){mesh.setMatrixAt(b.used,this.poses[i]);mesh.setColorAt(b.used,color);}b.used++;
  }
  for(const b of this.batches.values())for(const mesh of b.meshes){mesh.count=b.used;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();}
 }
 reflect(texture:THREE.Texture){
  for(const b of this.batches.values())for(const mesh of b.meshes){const m=mesh.material as THREE.MeshStandardMaterial;if(m instanceof THREE.MeshStandardMaterial){m.envMap=texture;m.envMapIntensity=/glazing/.test(m.name)?.7:.55;m.needsUpdate=true;}}
 }
 stats(){return {sites:this.sites.length,waterfront:this.sites.filter(s=>s.layer==='waterfront').length,blocks:this.sites.filter(s=>s.layer==='blocks').length,skyline:this.sites.filter(s=>s.layer==='skyline').length,lods:[0,1,2].map(t=>this.previous.filter(p=>p===t).length),activeMeshes:[...this.batches.values()].filter(b=>b.used).reduce((n,b)=>n+b.meshes.length,0)};}
 private makeTerrain(){
  const vertices:number[]=[],uv:number[]=[];
  for(const side of [-1,1])for(let i=0;i<56;i++){
   const p=[i,i+1].flatMap(j=>{const a=(.06*this.track.length-140+j*5)/this.track.radius;return [143,279].map(offset=>this.track.point(a,side*(this.track.widthAt(a)+offset)));});
   for(const ids of [[0,2,1],[1,2,3]]){
    if(ids.some(k=>this.track.contains(p[k],-1)))continue;
    for(const k of ids){const q=sampleLocal(this.track,p[k]);vertices.push(q.x,.285,q.z);uv.push(q.x/4,q.z/4);}
   }
  }
  // Only the ground under the two distant skyline clusters; no extension of racing water.
  for(const side of [-1,1])for(const end of [-1,1])for(let i=0;i<35;i++){
   const p=[i,i+1].flatMap(j=>{const a=(.06*this.track.length+end*(145+j*5))/this.track.radius;return [22,229].map(offset=>this.track.point(a,side*(this.track.widthAt(a)+offset)));});
   for(const ids of [[0,2,1],[1,2,3]]){
    const center={x:ids.reduce((n,k)=>n+p[k].x,0)/3,z:ids.reduce((n,k)=>n+p[k].z,0)/3};if(ids.some(k=>this.track.contains(p[k],-1))||this.track.contains(center,-1))continue;
    for(const k of ids){const q=sampleLocal(this.track,p[k]);vertices.push(q.x,.285,q.z);uv.push(q.x/4,q.z/4);}
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#879397',roughness:.94,side:THREE.DoubleSide}));mesh.name='background-city-ground';mesh.receiveShadow=true;return mesh;
 }
 private makeSigns(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;const ctx=canvas.getContext('2d')!;
  const selected=this.sites.filter(s=>s.layer!=='skyline').filter((_,i)=>i%2===0).slice(0,8);
  const labels:Record<CityModule,string>={spindle_office:'AURORA / OFFICE',split_office:'LUMEN / OFFICE',terrace_residence:'VIEW / RESIDENCE',research_campus:'NOVA / RESEARCH',data_centre:'FLUX / DATA',retail_hub:'ARCADE / CITY',transit_station:'AURORA / TRANSIT',drydock_service:'DOCK / SERVICE'};
  const titles=selected.map(s=>labels[s.kind]);
  for(let i=0;i<8;i++){const x=(i%2)*512,y=Math.floor(i/2)*256;ctx.fillStyle=i%3===0?'#213942':'#0a273d';ctx.fillRect(x,y,512,256);ctx.strokeStyle=i%3===0?'#e9b56f':'#58dce3';ctx.lineWidth=5;ctx.strokeRect(x+8,y+8,496,240);ctx.fillStyle='#e3f3f4';ctx.font='bold 34px sans-serif';ctx.fillText(titles[i],x+25,y+94);ctx.fillStyle='#81d9d6';ctx.font='22px sans-serif';ctx.fillText('WATERFRONT  /  FUTURE IN MOTION',x+25,y+146);ctx.font='bold 30px sans-serif';ctx.fillText('→  CITY CIRCUIT  →',x+25,y+205);}
  const atlas=new THREE.CanvasTexture(canvas);atlas.colorSpace=THREE.SRGBColorSpace;
  selected.forEach((s,i)=>{
   const m=(s.kind as CityModule),z=-CITY_FACADE_DEPTH[m]*s.scaleXZ-1,dx=Math.sin(s.heading)*z,dz=Math.cos(s.heading)*z;
   const sign=readableSign(atlas,9,3.2,`density-sign-${i}`,.08,true);sign.position.set(s.x+dx,s.layer==='waterfront'?5:8,s.z+dz);sign.rotation.y=s.heading;
   const geometry=(sign.children[0] as THREE.Mesh).geometry,uv=geometry.attributes.uv;for(let j=0;j<uv.count;j++)uv.setXY(j,((i%2)+uv.getX(j))*.5,(3-Math.floor(i/2)+uv.getY(j))*.25);uv.needsUpdate=true;this.signs.add(sign);
  });
  return atlas;
 }
 private makeConnections(){
  const material=new THREE.MeshStandardMaterial({color:'#68818d',metalness:.7,roughness:.42});
  for(const s of this.sites.filter(s=>s.kind==='transit_station')){
   const a=sampleLocal(this.track,this.track.point(s.angle,s.side*(this.track.widthAt(s.angle)+17))),b={x:s.x-Math.cos(s.heading)*s.side*10*s.scaleXZ,z:s.z+Math.sin(s.heading)*s.side*10*s.scaleXZ};
   // Raised bank-only connectors meet the existing maglev; do not span racing water.
   const h=21.7*s.scaleY+.265-.25*s.scaleY;
   for(const offset of [-1.8,1.8]){
    const points=[new THREE.Vector3(a.x+Math.sin(s.heading)*offset,22,a.z+Math.cos(s.heading)*offset),new THREE.Vector3(b.x+Math.sin(s.heading)*offset,h,b.z+Math.cos(s.heading)*offset)];
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),1,.13,5,false),material);mesh.name='station-link-beam';this.links.add(mesh);
   }
   const corners=[a,b].flatMap((p,i)=>[-1.8,1.8].map(offset=>new THREE.Vector3(p.x+Math.sin(s.heading)*offset,(i?h:22)-.15,p.z+Math.cos(s.heading)*offset)));
   const ids=s.side>0?[0,1,2,1,3,2]:[0,2,1,1,2,3],geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(ids.flatMap(i=>corners[i].toArray()),3));geometry.computeVertexNormals();
   const deck=new THREE.Mesh(geometry,material);deck.name='station-link-deck';this.links.add(deck);
  }
 }
 private clearInstances(){for(const b of this.batches.values())for(const mesh of b.meshes){mesh.removeFromParent();mesh.dispose();}this.batches.clear();}
 dispose(){
  this.disposed=true;this.generation++;this.clearInstances();this.root.removeFromParent();this.terrain.geometry.dispose();(this.terrain.material as THREE.Material).dispose();this.atlas.dispose();
  for(const sign of this.signs.children){const face=sign.children[0] as THREE.Mesh;face.geometry.dispose();(face.material as THREE.Material).dispose();}
  const linkMaterials=new Set<THREE.Material>();for(const o of this.links.children){const m=o as THREE.Mesh;m.geometry.dispose();linkMaterials.add(m.material as THREE.Material);}linkMaterials.forEach(m=>m.dispose());
  for(const p of this.cache.values())void p.then(lib=>{
   const materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();for(const parts of lib.parts.values())for(const part of parts)part.geometry.dispose();
   lib.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();materials.add(o.material as THREE.Material);}});
   for(const m of materials){for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap']){const t=(m as any)[key];if(t instanceof THREE.Texture)textures.add(t);}m.dispose();}textures.forEach(t=>t.dispose());
  }).catch(()=>{});this.cache.clear();
 }
}
const CITY_FACADE_DEPTH:Record<CityModule,number>={spindle_office:15,terrace_residence:13,split_office:15,research_campus:15,data_centre:15,retail_hub:11,transit_station:15,drydock_service:12};

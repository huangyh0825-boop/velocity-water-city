import * as THREE from 'three';
import {loadAssetGLTF} from '../player/AssetGLTF';
import {CityTrack} from '../track/CityTrack';
import {CITY_MODULES,cityLOD,sampleLocal,type CitySite,type CityModule} from './CityDensityLayout';
import {worldCitySites,districtAt} from './WorldCityLayout';
import {CityServices} from './CityServices';
import {cityServices} from './CityServicesLayout';
import {CityContactShadows} from './CityContactShadows';
import {CityGlass} from './CityGlass';
import {CityInteriors} from './CityInteriors';
import {CityMaterialBatch} from './CityMaterialBatch';
import {CityFurnishings} from './CityFurnishings';
import {readableSign,atlasCellUV} from './ReadableSign';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

interface Part {geometry:THREE.BufferGeometry;material:THREE.Material}
interface Library {scene:THREE.Group;parts:Map<string,Part[]>}
interface Batch {meshes:THREE.InstancedMesh[];used:number}
/** District art only: reusable authored GLBs, instancing, distance LOD and shared sign atlas. */
export class CityDensity {
 readonly root=new THREE.Group();readonly sites:CitySite[];
 private foundation:CityContactShadows;readonly glass=new CityGlass();readonly interiors:CityInteriors;
 loaded=false;error='';low=false;revision=0;
 balanced=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
 private cache=new Map<boolean,Promise<Library>>();private batches=new Map<string,Batch>();
 private combined?:CityMaterialBatch;private multiDraw=false;private library?:Library;
 private generation=0;private disposed=false;private previous:number[];private poses:THREE.Matrix4[];
 private lastCamera=new THREE.Vector3(Infinity,Infinity,Infinity);private lastTime=-Infinity;
 private signs=new THREE.Group();private atlas:THREE.CanvasTexture;
 private adverts?:CityMaterialBatch;private advertGeometry:THREE.BufferGeometry[]=[];
 private terrain:THREE.Mesh;private links=new THREE.Group();
 readonly services:CityServices;
 furnishings?:CityFurnishings;
 constructor(private track:CityTrack){
  this.root.name='authored-world-city';this.sites=worldCitySites(track);this.previous=this.sites.map(()=>-1);
  this.poses=this.sites.map(s=>new THREE.Matrix4().compose(new THREE.Vector3(s.x,.265-.25*s.scaleY,s.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),s.heading),new THREE.Vector3(s.scaleXZ,s.scaleY,s.scaleXZ)));
  this.foundation=new CityContactShadows(this.sites);this.root.add(this.foundation.mesh);
  this.interiors=new CityInteriors(track,this.sites);this.root.add(this.interiors.root);
  this.services=new CityServices(track);this.root.add(this.services.root);
  this.terrain=this.makeTerrain();this.atlas=this.makeSigns();this.makeConnections();this.root.add(this.terrain,this.signs,this.links);
 }
 async setLow(low:boolean){
  const request=++this.generation;this.low=low;
  try{
   let promise=this.cache.get(low);
   if(!promise){promise=loadAssetGLTF(`${import.meta.env.BASE_URL}models/city-sample/city-modules${low?'-low':''}.glb`).then(g=>{
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
      this.glass.prepare(material,low);list.push({geometry,material});
     }});parts.set(`${kind}:${tier}`,list);
    }
    return {scene:g.scene,parts};
   });this.cache.set(low,promise);}
   const library=await promise;if(this.disposed||request!==this.generation)return;
   let concrete:THREE.MeshStandardMaterial|undefined;library.scene.traverse(o=>{if(o instanceof THREE.Mesh&&/Concrete034/.test((o.material as THREE.Material).name))concrete=o.material as THREE.MeshStandardMaterial;});
   if(concrete){(this.terrain.material as THREE.Material).dispose();const material=concrete.clone();material.color.set('#88989f');material.side=THREE.DoubleSide;this.terrain.material=material;}
   this.library=library;this.createInstances(library);
   this.foundation.mesh.visible=!low;this.interiors.setLow(low);this.signs.visible=!low;this.links.visible=!low;this.loaded=true;this.error='';this.previous.fill(-1);this.lastTime=-Infinity;
   const center=this.track.point(.06*Math.PI*2);this.update(new THREE.Vector3(center.x,5,center.z),0,true);
  }catch(e){if(request===this.generation&&!this.disposed){this.error=String(e);this.cache.delete(low);throw e;}}
 }
 enableBatches(renderer:THREE.WebGLRenderer){
  this.services.enableBatches(renderer);
  const available=!!renderer.getContext().getExtension('WEBGL_multi_draw');if(this.multiDraw===available)return;
  this.multiDraw=available;if(this.library){this.createInstances(this.library);this.previous.fill(-1);this.update(this.lastCamera,0,true);}
 }
 private createInstances(library:Library){
  this.clearInstances();
  if(this.multiDraw&&!this.low){this.combined=new CityMaterialBatch(library.parts,this.sites,this.poses);this.root.add(...this.combined.meshes);return;}
  for(const kind of new Set(this.sites.map(s=>s.kind)))for(const tier of ['near','mid','far']){
   const meshes=library.parts.get(`${kind}:${tier}`)!.map(part=>{
    const mesh=new THREE.InstancedMesh(part.geometry,part.material,this.sites.filter(s=>s.kind===kind).length);mesh.name=`city-${kind}-${tier}`;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=!this.low&&tier==='near';mesh.receiveShadow=!this.low;this.root.add(mesh);return mesh;
   });this.batches.set(`${kind}:${tier}`,{meshes,used:0});
  }
 }
 update(camera:THREE.Vector3,time:number,force=false){
  if(!this.loaded)return;
  this.interiors.update(camera);
  if(!force&&time-this.lastTime<.15&&this.lastCamera.distanceToSquared(camera)<64)return;
  this.lastTime=time;this.lastCamera.copy(camera);for(const b of this.batches.values())b.used=0;
  const local=sampleLocal(this.track,camera);
  let lodChanged=false;for(let i=0;i<this.sites.length;i++){
   const s=this.sites[i],distance=Math.hypot(s.x-local.x,s.z-local.z),layer=s.id.startsWith('world-')&&s.layer==='skyline'?'blocks':s.layer,tier=cityLOD(layer,distance,this.previous[i],this.low,this.balanced);const changed=this.previous[i]!==tier;this.previous[i]=tier;
   if(changed)lodChanged=true;if(this.combined){if(changed)this.combined.setLOD(i,tier);continue;}
  }
  if(lodChanged)this.revision++;
  // Poses/tints are immutable. An unchanged LOD assignment needs no matrix
  // writes, GPU uploads or bounding-sphere rebuilds, even while the camera moves.
  if(!lodChanged&&!force)return;
  const color=new THREE.Color(),tints=['#ffffff','#cbdbe1','#e7dcc6','#c9dcd4'];
  if(!this.combined)for(let i=0;i<this.sites.length;i++){
   const s=this.sites[i],b=this.batches.get(`${s.kind}:${['near','mid','far'][this.previous[i]]}`)!;color.set(tints[s.tint]);
   for(const mesh of b.meshes){mesh.setMatrixAt(b.used,this.poses[i]);mesh.setColorAt(b.used,color);}b.used++;
  }
  for(const b of this.batches.values())for(const mesh of b.meshes){mesh.count=b.used;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();}
 }
 reflect(texture:THREE.Texture){
  for(const mesh of [...(this.combined?.meshes??[]),...[...this.batches.values()].flatMap(b=>b.meshes)]){const m=mesh.material as THREE.MeshStandardMaterial;if(m instanceof THREE.MeshStandardMaterial){m.envMap=texture;m.envMapIntensity=/glaz|glass/i.test(m.name)?.32:.55;m.needsUpdate=true;}}
 }
 sharedMaterial(name:string){for(const parts of this.library?.parts.values()??[])for(const p of parts)if(p.material.name===name)return p.material;}
 async loadServices(sample:THREE.Group){
  const materials=new Map([...this.library!.parts.values()].flatMap(list=>list.map(p=>[p.material.name,p.material] as const)));
  sample.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(!materials.has(m.name))materials.set(m.name,m);});
  await this.services.load(materials);
  if(!this.furnishings){const citizens=await loadAssetGLTF(`${import.meta.env.BASE_URL}models/city-sample/public-citizens.glb`);if(this.disposed)return;
   this.furnishings=new CityFurnishings(this.track,this.sites,name=>materials.get(name),sample,citizens.scene);this.root.add(this.furnishings.root);}
 }
 stats(){return {sites:this.sites.length,waterfront:this.sites.filter(s=>s.layer==='waterfront').length,blocks:this.sites.filter(s=>s.layer==='blocks').length,skyline:this.sites.filter(s=>s.layer==='skyline').length,lods:[0,1,2].map(t=>this.previous.filter(p=>p===t).length),mode:this.combined?'material-batch':'instanced',activeMeshes:this.combined?.meshes.length??[...this.batches.values()].filter(b=>b.used).reduce((n,b)=>n+b.meshes.length,0)};}
 private makeTerrain(){
  const vertices:number[]=[],uv:number[]=[];
  // Union nearby plots into continuous land. A world-space grid is clipped to
  // every legal canal, including the branches; unlike overlapping ribbon meshes
  // it has no coplanar intersections or water-filling triangles on tight bends.
  const cells=new Set<string>(),center=this.track.point(.06*Math.PI*2),heading=this.track.heading(.06*Math.PI*2);
  for(const s of [...this.sites.filter(s=>s.id.startsWith('world-')),...cityServices(this.track)]){
   const x=center.x+Math.cos(heading)*s.x+Math.sin(heading)*s.z,z=center.z-Math.sin(heading)*s.x+Math.cos(heading)*s.z,r=Math.hypot(s.rx,s.rz)+18;
   for(let i=Math.floor((x-r)/5);i<=Math.ceil((x+r)/5);i++)for(let j=Math.floor((z-r)/5);j<=Math.ceil((z+r)/5);j++)cells.add(`${i}:${j}`);
  }
  const dry=new Map<string,boolean>();const outside=(x:number,z:number)=>{const key=`${x}:${z}`;if(!dry.has(key))dry.set(key,!this.track.contains({x,z},-1.5));return dry.get(key)!;};
  for(const cell of cells){const [i,j]=cell.split(':').map(Number),points=[[i*5,j*5],[(i+1)*5,j*5],[i*5,(j+1)*5],[(i+1)*5,(j+1)*5]];
   if(!outside(i*5+2.5,j*5+2.5)||points.some(([x,z])=>!outside(x,z)))continue;
   // Do not cover the approved sample's own authored land surfaces.
   const p=sampleLocal(this.track,{x:i*5+2.5,z:j*5+2.5});if(Math.abs(p.z)<145&&Math.abs(p.x)<310)continue;
   for(const k of [0,2,1,1,2,3]){const [x,z]=points[k],q=sampleLocal(this.track,{x,z});vertices.push(q.x,.175,q.z);uv.push(x/4,z/4);}
  }
  for(const side of [-1,1])for(let i=0;i<56;i++){
   const p=[i,i+1].flatMap(j=>{const a=(.06*this.track.length-140+j*5)/this.track.radius;return [143,306].map(offset=>this.track.point(a,side*(this.track.widthAt(a)+offset)));});
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
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const ctx=canvas.getContext('2d')!;
  const recent=new Set<CityModule>(['service_depot','ferry_terminal','market_galleria','bio_lab','cooling_exchange','commuter_hub']);
  const original=(['waterfront','blocks'] as const).flatMap(layer=>[-1,1].flatMap(side=>{const list=this.sites.filter(s=>!s.id.startsWith('world-')&&s.layer===layer&&s.side===side);return [...list.filter(s=>!recent.has(s.kind)).slice(0,2),...list.filter(s=>recent.has(s.kind)).slice(0,2)];}));
  // Reuse the original sixteen full-resolution atlas cells on commercial buildings
  // throughout each district. Repetition of brands does not repeat building shapes.
  const selected=[...original,...Array.from({length:6},(_,zone)=>[-1,1].flatMap(side=>this.sites.filter(s=>s.id.startsWith('world-')&&s.layer==='waterfront'&&s.side===side&&districtAt(s.angle).id===['central','science','transit','industrial','harbor','leisure'][zone]).filter((_,i)=>i%5===0))).flat()];
  const labels:Record<CityModule,string>={spindle_office:'AURORA / OFFICE',split_office:'LUMEN / OFFICE',terrace_residence:'VIEW / RESIDENCE',research_campus:'NOVA / RESEARCH',data_centre:'FLUX / DATA',retail_hub:'ARCADE / CITY',transit_station:'AURORA / TRANSIT',drydock_service:'DOCK / SERVICE',harbor_control:'PORT / CONTROL',service_arcade:'QUAY / ARCADE',energy_node:'ION / ENERGY',view_pavilion:'BAY / LOUNGE',expo_hall:'ORBIT / EXPO',control_centre:'CITY / CONTROL',terraced_hotel:'SKY / HOTEL',ring_spire:'HALO / SPIRE',blade_tower:'VECTOR / TOWER',sky_gallery:'SKY / TRANSIT',service_depot:'PIT / SERVICE',ferry_terminal:'BAY / TERMINAL',market_galleria:'CITY / GALLERIA',bio_lab:'BIO / RESEARCH',cooling_exchange:'FLUX / COOLING',sail_office:'SAIL / OFFICE',lattice_tower:'AXIS / TOWER',commuter_hub:'LINK / TRANSIT'};
  const titles=original.map(s=>labels[s.kind]);
  for(let i=0;i<original.length;i++){const x=(i%4)*512,y=Math.floor(i/4)*256;ctx.fillStyle=i%3===0?'#213942':'#0a273d';ctx.fillRect(x,y,512,256);ctx.strokeStyle=i%3===0?'#e9b56f':'#58dce3';ctx.lineWidth=4;ctx.strokeRect(x+8,y+8,496,240);ctx.fillStyle='#e3f3f4';ctx.font='bold 32px sans-serif';ctx.fillText(titles[i],x+20,y+94,472);ctx.fillStyle='#81d9d6';ctx.font='21px sans-serif';ctx.fillText('WATERFRONT / FUTURE IN MOTION',x+20,y+146,472);ctx.font='bold 29px sans-serif';ctx.fillText('→  CITY CIRCUIT  →',x+20,y+205,472);}
  const atlas=new THREE.CanvasTexture(canvas);atlas.colorSpace=THREE.SRGBColorSpace;
  const advertParts=new Map<string,Part[]>(),advertSites:{kind:string;tint:number}[]=[],advertPoses:THREE.Matrix4[]=[];let advertMaterial:THREE.Material|undefined;
  selected.forEach((s,i)=>{
   const m=(s.kind as CityModule),z=-CITY_MODULES[m].rz*s.scaleXZ-1,dx=Math.sin(s.heading)*z,dz=Math.cos(s.heading)*z;
   const width=s.layer==='waterfront'?5.8:8;
   const sign=readableSign(atlas,width,width/3,`density-sign-${i}`,.08,true);sign.position.set(s.x+dx,s.layer==='waterfront'?5:8,s.z+dz);sign.rotation.y=s.heading;
   const geometry=(sign.children[0] as THREE.Mesh).geometry,uv=geometry.attributes.uv;for(let j=0;j<uv.count;j++)uv.setXY(j,...atlasCellUV(i%16,4,4,uv.getX(j),uv.getY(j)));uv.needsUpdate=true;
   if(i<original.length){this.signs.add(sign);advertMaterial??=(sign.children[0] as THREE.Mesh).material as THREE.Material;return;}
   const key=`brand-${i%16}`,listKey=key+':near';
   if(!advertParts.has(listKey)){
    const parts=sign.children.map(o=>{o.updateMatrix();return geometry.clone().applyMatrix4(o.matrix);}),merged=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());this.advertGeometry.push(merged);advertParts.set(listKey,[{geometry:merged,material:advertMaterial!}]);
   }
   sign.updateMatrix();advertSites.push({kind:key,tint:0});advertPoses.push(sign.matrix.clone());geometry.dispose();((sign.children[0] as THREE.Mesh).material as THREE.Material).dispose();
  });
  if(advertSites.length){this.adverts=new CityMaterialBatch(advertParts,advertSites,advertPoses);advertSites.forEach((_,i)=>this.adverts!.setLOD(i,0));this.signs.add(...this.adverts.meshes);}
  return atlas;
 }
 private makeConnections(){
  const material=new THREE.MeshStandardMaterial({color:'#68818d',metalness:.7,roughness:.42});
  for(const s of this.sites.filter(s=>s.kind==='transit_station'&&!s.id.startsWith('world-'))){
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
 private clearInstances(){this.combined?.dispose();this.combined=undefined;for(const b of this.batches.values())for(const mesh of b.meshes){mesh.removeFromParent();mesh.dispose();}this.batches.clear();}
 dispose(){
  this.disposed=true;this.furnishings?.dispose();this.foundation.dispose();this.interiors.dispose();this.services.dispose();this.glass.dispose();this.generation++;this.clearInstances();this.root.removeFromParent();this.terrain.geometry.dispose();(this.terrain.material as THREE.Material).dispose();this.atlas.dispose();
  this.adverts?.dispose();this.advertGeometry.forEach(g=>g.dispose());
  for(const sign of this.signs.children)if(sign.userData.readableSign){const face=sign.children[0] as THREE.Mesh;face.geometry.dispose();(face.material as THREE.Material).dispose();}
  const linkMaterials=new Set<THREE.Material>();for(const o of this.links.children){const m=o as THREE.Mesh;m.geometry.dispose();linkMaterials.add(m.material as THREE.Material);}linkMaterials.forEach(m=>m.dispose());
  for(const p of this.cache.values())void p.then(lib=>{
   const materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();for(const parts of lib.parts.values())for(const part of parts)part.geometry.dispose();
   lib.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();materials.add(o.material as THREE.Material);}});
   for(const m of materials){for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap']){const t=(m as any)[key];if(t instanceof THREE.Texture)textures.add(t);}m.dispose();}textures.forEach(t=>t.dispose());
  }).catch(()=>{});this.cache.clear();
 }
}

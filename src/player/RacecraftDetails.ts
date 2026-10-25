import * as THREE from 'three';import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
type Detail={geometry:THREE.BufferGeometry;bone?:number};
const cache=new WeakMap<THREE.BufferGeometry,THREE.BufferGeometry>();
const meshWith=(root:THREE.Object3D,name:RegExp)=>{let result:THREE.Mesh|undefined;root.traverse(o=>{if(!result&&o instanceof THREE.Mesh&&!Array.isArray(o.material)&&name.test(o.material.name))result=o;});return result;};
const rootBox=(root:THREE.Object3D,mesh:THREE.Mesh)=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(root.matrixWorld.clone().invert(),mesh.matrixWorld));};
function rearPoint(root:THREE.Object3D,mesh:THREE.Mesh,x:number,y:number){
 const matrix=new THREE.Matrix4().multiplyMatrices(root.matrixWorld.clone().invert(),mesh.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,point=new THREE.Vector3(),normal=new THREE.Vector3(),best=new THREE.Vector3();let distance=Infinity;
 for(let i=0;i<p.count;i++){normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix);if(normal.z>-.4)continue;point.fromBufferAttribute(p,i).applyMatrix4(matrix);const d=(point.x-x)**2+(point.y-y)**2;if(d<distance){distance=d;best.copy(point).addScaledVector(normal.normalize(),.0015);}}
 return best;
}
function part(g:THREE.BufferGeometry,p:THREE.Vector3,rotation=new THREE.Euler()){return g.applyMatrix4(new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromEuler(rotation),new THREE.Vector3(1,1,1)));}
const plate=(w:number,h:number,d:number)=>new RoundedBoxGeometry(w,h,d,1,Math.min(.0025,w/5,h/5,d/5));
/** Append to existing material groups and share the result between all racers.
 * No new draw calls, texture, skeleton, animation loop or collision geometry. */
function append(root:THREE.Object3D,target:THREE.Mesh,details:Detail[]){
 if(target.geometry.userData.finishTriangles!==undefined){details.forEach(d=>d.geometry.dispose());return;}
 const base=target.geometry,previous=cache.get(base);if(previous){details.forEach(d=>d.geometry.dispose());target.geometry=previous;return;}
 const inverse=new THREE.Matrix4().multiplyMatrices(target.matrixWorld.clone().invert(),root.matrixWorld);
 for(const {geometry:g,bone=0}of details){g.applyMatrix4(inverse);
  if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
  for(const [name,source]of Object.entries(base.attributes)){
   let a=g.getAttribute(name);if(!a){const ArrayType=source.array.constructor as {new(length:number):THREE.TypedArray},values=new ArrayType(g.attributes.position.count*source.itemSize);a=new THREE.BufferAttribute(values,source.itemSize,source.normalized);g.setAttribute(name,a);
    for(let i=0;i<a.count;i++){if(name==='skinIndex')a.setComponent(i,0,bone);else if(name==='skinWeight')a.setComponent(i,0,1);else if(name==='tangent'){a.setComponent(i,0,1);a.setComponent(i,3,1);}else if(name==='color')for(let k=0;k<a.itemSize;k++)a.setComponent(i,k,1);}
   }
  }
  for(const name of Object.keys(g.attributes))if(!base.getAttribute(name))g.deleteAttribute(name);
 }
 const combined=mergeGeometries([base,...details.map(d=>d.geometry)],false);if(!combined)throw Error('Finish detail attribute mismatch');
 combined.computeBoundingBox();combined.computeBoundingSphere();combined.userData.finishTriangles=details.reduce((n,d)=>n+(d.geometry.index?.count??d.geometry.attributes.position.count)/3,0);cache.set(base,combined);details.forEach(d=>d.geometry.dispose());target.geometry=combined;
}
export function refineRacecraft(boat:THREE.Object3D,rider:THREE.Object3D){
 if(boat.userData.visualAsset!=='watercraft')return;
 let reused=0;for(const root of [boat,rider])root.traverse(o=>{if(o instanceof THREE.Mesh){const g=cache.get(o.geometry);if(g){o.geometry=g;reused++;}}});if(reused===5)return;
 boat.updateWorldMatrix(true,true);rider.updateWorldMatrix(true,true);
 const metal=meshWith(boat,/^Brushed titanium$/),dark=meshWith(boat,/^Recess cavity$/),lens=meshWith(boat,/^Ice navigation lens$/);
 const hardware:Detail[]=[],recesses:Detail[]=[],lights:Detail[]=[];
 for(const name of ['R7_FootMat_L','R7_FootMat_R']){const mesh=boat.getObjectByName(name) as THREE.Mesh|undefined;if(!mesh)continue;const b=rootBox(boat,mesh);
  for(const x of [b.min.x+.045,b.max.x-.045])for(const z of [b.min.z+.07,b.max.z-.07]){
   const p=new THREE.Vector3(x,b.max.y+.004,z);hardware.push({geometry:part(new THREE.CylinderGeometry(.010,.010,.004,12),p)});recesses.push({geometry:part(new THREE.BoxGeometry(.010,.0015,.002),p.clone().add(new THREE.Vector3(0,.0025,0)))});
  }
 }
 const outlet=boat.getObjectByName('JetOutlet');if(outlet){const p=boat.worldToLocal(outlet.getWorldPosition(new THREE.Vector3()));
  for(const [radius,offset]of [[.174,-.007],[.189,.013]])hardware.push({geometry:part(new THREE.TorusGeometry(radius,.006,6,32),p.clone().add(new THREE.Vector3(0,0,offset)))});
  lights.push({geometry:part(new THREE.TorusGeometry(.166,.003,5,32),p.clone().add(new THREE.Vector3(0,0,-.012)))});
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;hardware.push({geometry:part(new THREE.CylinderGeometry(.006,.006,.006,8),p.clone().add(new THREE.Vector3(Math.cos(a)*.198,Math.sin(a)*.198,.009)),new THREE.Euler(Math.PI/2,0,0))});}
 }
 const screen=meshWith(boat,/Original LCD display/);if(screen){const b=rootBox(boat,screen),size=b.getSize(new THREE.Vector3());for(const x of [b.min.x-.006,b.max.x+.006])hardware.push({geometry:part(plate(.006,.006,size.z*.82),new THREE.Vector3(x,b.min.y+size.y*.5+.006,b.min.z+size.z*.5),new THREE.Euler(-Math.atan2(size.y,size.z),0,0))});}
 if(metal)append(boat,metal,hardware);if(dark)append(boat,dark,recesses);if(lens)append(boat,lens,lights);
 const riderMetal=meshWith(rider,/Hero satin hardware/),riderDark=meshWith(rider,/Hero cavity and visor gasket/),visor=meshWith(rider,/smoke optical visor/),helmet=meshWith(rider,/Hero pearl helmet/);
 if(riderMetal instanceof THREE.SkinnedMesh&&riderDark instanceof THREE.SkinnedMesh&&visor&&helmet){
  const bone=riderMetal.skeleton.bones.findIndex(b=>b.name==='Neck');if(bone<0)return;const v=rootBox(rider,visor),h=rootBox(rider,helmet),silver:Detail[]=[],black:Detail[]=[];
  for(const side of [-1,1]){
   const p=new THREE.Vector3(side*(Math.max(Math.abs(v.min.x),Math.abs(v.max.x))+.004),(v.min.y+v.max.y)/2,v.min.z+.023);
   silver.push({geometry:part(new THREE.CylinderGeometry(.011,.013,.004,20),p,new THREE.Euler(0,0,Math.PI/2)),bone});
   black.push({geometry:part(plate(.0018,.010,.002),p.clone().add(new THREE.Vector3(side*.0025,0,0))),bone});
   const x=side*.060,y=h.max.y-.135;
   for(let i=0;i<3;i++){const points=[-.025,0,.025].map(dx=>rearPoint(rider,helmet,x+dx,y-.012+i*.012)),curve=new THREE.CatmullRomCurve3(points);black.push({geometry:new THREE.TubeGeometry(curve,6,.0028,5,false),bone});silver.push({geometry:new THREE.TubeGeometry(curve,6,.0012,5,false).translate(0,0,-.0018),bone});}
  }
  append(rider,riderMetal,silver);append(rider,riderDark,black);
 }
}

import*as THREE from'three';import{type CityPart}from'./CityMaterialBatch';
interface View{mesh:THREE.InstancedMesh;ids:number[]}
interface Pool{main:THREE.InstancedMesh;shadow:THREE.InstancedMesh;matrices:THREE.Matrix4[];bounds:THREE.Sphere[];shadowIds:number[];shadowCount:number;views:Map<THREE.Camera,View>;kind:string;tier:number;levels:number;scales:number[]}
/** Shared hardware instances, exact per-part culling, independent reflection
 * buffers and off-screen shadow casters. Only NEW background citizens/leaves
 * use subpixel LOD; hero/AI/buildings/water and all environment objects remain.
 */
export class StaticPropInstances{
 readonly meshes:THREE.InstancedMesh[]=[];lodEnabled=true;private pools:Pool[]=[];private frustum=new THREE.Frustum();private matrix=new THREE.Matrix4();private views=new Map<THREE.Camera,{matrix:THREE.Matrix4;scale:number;lod:boolean}>();private shadowReady=false;private eye=new THREE.Vector3();private inverse=new THREE.Matrix4();private size=new THREE.Vector2();private pixelScale=1;private ortho=false;
 constructor(parts:Map<string,CityPart[]>,objects:{kind:string}[],poses:THREE.Matrix4[]){
  const groups=new Map<string,number[]>();objects.forEach((o,i)=>{const a=groups.get(o.kind)??[];a.push(i);groups.set(o.kind,a)});
  for(const[kind,ids]of groups){const levels=parts.has(kind+':far')?3:parts.has(kind+':mid')?2:1;
   for(let tier=0;tier<levels;tier++)for(const part of parts.get(kind+':'+['near','mid','far'][tier])??[]){
    part.geometry.computeBoundingSphere();const main=new THREE.InstancedMesh(part.geometry,part.material,ids.length),shadow=new THREE.InstancedMesh(part.geometry,part.material,ids.length);
    main.name='public-instanced-'+kind;shadow.name='public-shadow-'+kind;main.receiveShadow=shadow.receiveShadow=true;shadow.castShadow=true;main.frustumCulled=shadow.frustumCulled=false;main.count=shadow.count=0;main.instanceMatrix.setUsage(THREE.DynamicDrawUsage);shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const matrices=ids.map(i=>poses[i]),pool:Pool={main,shadow,matrices,bounds:matrices.map(m=>part.geometry.boundingSphere!.clone().applyMatrix4(m)),scales:matrices.map(m=>m.getMaxScaleOnAxis()),shadowIds:[],shadowCount:0,views:new Map(),kind,tier,levels};
    shadow.onBeforeRender=()=>{shadow.count=0};shadow.onAfterRender=()=>{shadow.count=pool.shadowCount};this.pools.push(pool);this.meshes.push(main,shadow);
   }
  }
 }
 private level(p:Pool,i:number){
  if(!this.lodEnabled||p.levels===1)return 0;const factor=this.pixelScale*p.scales[i]/(this.ortho?1:Math.max(1,p.bounds[i].center.distanceTo(this.eye)));
  // Measured bidirectional vertex/surface deviations (lod-error.json), padded
  // upward. Select only when even the worst measured displacement is <1 pixel.
  if(p.kind.startsWith('spectator-')){const error=[.009,.031,.014,.035][Number(p.kind.at(-1))];return .045*factor<=.9?2:error*factor<=.9?1:0;}
  return .035*factor<=.6?1:0;
 }
 private compact(pool:Pool,shadow:boolean,view?:View){
  const previous=shadow?pool.shadowIds:view!.ids,mesh=shadow?pool.shadow:view!.mesh;let count=0,changed=false;
  // LOD is irrelevant for an instance already outside this exact camera frustum.
  for(let i=0;i<pool.bounds.length;i++)if(this.frustum.intersectsSphere(pool.bounds[i])&&this.level(pool,i)===pool.tier){if(previous[count]!==i)changed=true;previous[count++]=i;}
  if(previous.length!==count)changed=true;previous.length=count;if(changed){for(let n=0;n<count;n++)mesh.setMatrixAt(n,pool.matrices[previous[n]]);mesh.instanceMatrix.needsUpdate=true;mesh.count=count;}
  mesh.count=count;if(shadow)pool.shadowCount=count;
 }
 prepare(root:THREE.Object3D,camera:THREE.Camera,sun:THREE.DirectionalLight|undefined,renderer:THREE.WebGLRenderer){
  renderer.getDrawingBufferSize?.(this.size);this.pixelScale=Math.max(1,this.size.y)*Math.abs(camera.projectionMatrix.elements[5])*.5;this.ortho=(camera as THREE.OrthographicCamera).isOrthographicCamera===true;
  this.inverse.copy(root.matrixWorld).invert();this.eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(this.inverse);this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(root.matrixWorld);
  const previous=this.views.get(camera),changed=!previous||!this.matrix.equals(previous.matrix)||previous.scale!==this.pixelScale||previous.lod!==this.lodEnabled;
  if(previous){previous.matrix.copy(this.matrix);previous.scale=this.pixelScale;previous.lod=this.lodEnabled}else this.views.set(camera,{matrix:this.matrix.clone(),scale:this.pixelScale,lod:this.lodEnabled});this.frustum.setFromProjectionMatrix(this.matrix);
  for(const p of this.pools){let view=p.views.get(camera);if(!view){let mesh=p.main;if(p.views.size){mesh=new THREE.InstancedMesh(p.main.geometry,p.main.material,p.matrices.length);mesh.name=p.main.name+'-view';mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(mesh);mesh.updateWorldMatrix(true,false);this.meshes.push(mesh)}view={mesh,ids:[]};p.views.set(camera,view)}
   // Mirror and cube views keep separate GPU buffers. A nested water render
   // cannot overwrite the suspended main pass's transforms or instance count.
   for(const[c,v]of p.views)v.mesh.visible=c===camera;if(changed)this.compact(p,false,view);
  }
  if(sun&&renderer.shadowMap.enabled&&(sun.shadow.needsUpdate||!this.shadowReady)){
   sun.shadow.updateMatrices(sun);const c=sun.shadow.camera;this.pixelScale=sun.shadow.mapSize.y*Math.abs(c.projectionMatrix.elements[5])*.5;this.ortho=true;this.matrix.multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse).multiply(root.matrixWorld);this.frustum.setFromProjectionMatrix(this.matrix);for(const p of this.pools)this.compact(p,true);this.shadowReady=true;
  }
 }
 dispose(){this.meshes.forEach(m=>{m.removeFromParent();m.dispose()});this.pools.length=0;this.views.clear();}
}

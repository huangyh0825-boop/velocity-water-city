import*as THREE from'three';
interface Variant{material:THREE.Material;version:number;numbers:string[];objects:string[]}
interface Entry{variants:Map<string,Variant>;release:()=>void}
/** Keep the engine's screen/reflection program state independent. Geometry,
 * shader hooks, textures, live uniforms and material values are unchanged. */
export class RenderPassMaterials{
 private original:THREE.WebGLRenderer['renderBufferDirect'];
 private draw:THREE.WebGLRenderer['renderBufferDirect'];
 private entries=new Map<THREE.Material,Entry>();
 constructor(private renderer:THREE.WebGLRenderer){
  this.original=renderer.renderBufferDirect;
  this.draw=(camera,scene,geometry,material,object,group)=>{
   // Water, particles and depth passes retain their own live shader materials.
   if(renderer.getRenderTarget()&&material instanceof THREE.MeshStandardMaterial){
    const kind=object as THREE.Object3D&{isSkinnedMesh?:boolean;isInstancedMesh?:boolean;isBatchedMesh?:boolean};
    material=this.variant(material,`${Number(!!kind.isSkinnedMesh)}${Number(!!kind.isInstancedMesh)}${Number(!!kind.isBatchedMesh)}`);
   }
   this.original.call(renderer,camera,scene,geometry,material,object,group);
  };
  renderer.renderBufferDirect=this.draw;
 }
 private variant(source:THREE.Material,key:string){
  let entry=this.entries.get(source);if(!entry){const variants=new Map<string,Variant>(),release=()=>{source.removeEventListener('dispose',release);this.entries.delete(source);variants.forEach(v=>v.material.dispose());};entry={variants,release};this.entries.set(source,entry);source.addEventListener('dispose',release);}
  let variant=entry.variants.get(key);if(!variant){variant={material:source.clone(),version:-1,numbers:[],objects:[]};entry.variants.set(key,variant);}
  const original=source as unknown as Record<string,unknown>,copy=variant.material as unknown as Record<string,unknown>;
  if(variant.version!==source.version){
   variant.material.copy(source);variant.material.onBeforeCompile=source.onBeforeCompile;variant.material.customProgramCacheKey=source.customProgramCacheKey;
   variant.numbers=Object.keys(source).filter(k=>k!=='id'&&k!=='version'&&typeof original[k]==='number');
   variant.objects=Object.keys(source).filter(k=>k!=='_listeners'&&original[k]!==null&&typeof original[k]==='object');
   variant.version=source.version;variant.material.needsUpdate=true;
  }
  // Numeric uniforms can change without needsUpdate (opacity/roughness, etc.).
  // Share live colour/vector/texture/define references; never clone GPU assets.
  for(const key of variant.numbers)copy[key]=original[key];
  for(const key of variant.objects)copy[key]=original[key];
  return variant.material;
 }
 dispose(){if(this.renderer.renderBufferDirect===this.draw)this.renderer.renderBufferDirect=this.original;for(const entry of [...this.entries.values()])entry.release();}
}

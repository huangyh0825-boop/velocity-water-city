import * as THREE from 'three';
import {sparseSkinning} from './SparseSkinning';

/** A local, visual-only self-shadow for the hero's curved surfaces and moving skin.
 * The district's 320m static map remains intact for buildings. Its texels are much
 * too large for a 3.6m hull and cannot follow a deforming rider.
 */
export class HeroLighting {
 private camera=new THREE.OrthographicCamera(-2.8,2.8,2.8,-2.8,.1,20);
 private depth=new THREE.MeshDepthMaterial({depthPacking:THREE.BasicDepthPacking});
 private target=new THREE.WebGLRenderTarget(2048,2048,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthTexture:new THREE.DepthTexture(2048,2048,THREE.UnsignedIntType)});
 private matrix=new THREE.Matrix4();
 private originals=new Map<THREE.MeshStandardMaterial,{compile:THREE.Material['onBeforeCompile'];key:THREE.Material['customProgramCacheKey'];environment:THREE.Texture|null;intensity:number}>();
 private environment?:THREE.Texture;
 private direction=new THREE.Vector3(-155,165,90).normalize();
 private biasMatrix=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
 private viewFrustum=new THREE.Frustum();private viewMatrix=new THREE.Matrix4();private bounds=new THREE.Sphere(new THREE.Vector3(),3.8);
 private root?:THREE.Object3D;private revision?:number;
 private casters:{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[]}[]=[];
 private surfaces=new Set<THREE.MeshStandardMaterial>();private center=new THREE.Vector3();
 constructor(private layer=2){
  sparseSkinning(this.depth);
  // Only depthTexture is sampled; the colour attachment is never consumed.
  this.depth.colorWrite=false;
  this.camera.layers.set(layer);this.target.texture.name='Racer local depth pass '+layer;

 }
 updateVisible(renderer:THREE.WebGLRenderer,scene:THREE.Scene,racer:THREE.Object3D,view:THREE.Camera){
  // Skip only invisible self-shadow passes, never substitute lower-quality assets.
  view.updateMatrixWorld();this.viewFrustum.setFromProjectionMatrix(this.viewMatrix.multiplyMatrices(view.projectionMatrix,view.matrixWorldInverse));
  racer.getWorldPosition(this.bounds.center);this.bounds.center.y+=.8;
  if(!racer.visible||!racer.parent?.visible||!this.viewFrustum.intersectsSphere(this.bounds))return false;
  this.update(renderer,scene,racer);return true;
 }
 private configure(material:THREE.MeshStandardMaterial) {
  if(this.originals.has(material))return;
  this.originals.set(material,{compile:material.onBeforeCompile,key:material.customProgramCacheKey,environment:material.envMap,intensity:material.envMapIntensity});
  const original=material.onBeforeCompile,programKey=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
   original.call(material,shader,renderer);
   Object.assign(shader.uniforms,{heroDepth:{value:this.target.depthTexture},heroShadowMatrix:{value:this.matrix}});
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
    uniform mat4 heroShadowMatrix;varying vec4 heroShadowCoord;`)
    .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
     #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined( USE_SHADOWMAP ) || defined( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
      heroShadowCoord=heroShadowMatrix*worldPosition;
     #else
      heroShadowCoord=heroShadowMatrix*(modelMatrix*vec4(transformed,1.));
     #endif`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    uniform sampler2D heroDepth;varying vec4 heroShadowCoord;
    float heroVisibility(vec3 surfaceNormal){
     vec3 p=heroShadowCoord.xyz/heroShadowCoord.w;
     if(any(lessThan(p,vec3(0.)))||any(greaterThan(p,vec3(1.))))return 1.;
     vec3 lightDirection=normalize((viewMatrix*vec4(-.636,.677,.369,0.)).xyz);
     float bias=.00035+.001*(1.-abs(dot(surfaceNormal,lightDirection))),sum=0.;
     for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
      float d=texture2D(heroDepth,p.xy+vec2(float(x),float(y))/2048.).x;
      sum+=step(p.z-bias,d);
     }
     return .12+.88*sum/9.;
    }`).replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
     float heroShadow=heroVisibility(normal);
     reflectedLight.directDiffuse*=heroShadow;reflectedLight.directSpecular*=heroShadow;`);
  };
  material.customProgramCacheKey=()=> programKey+'|racer-local-shadow-v1';material.needsUpdate=true;
 }
 prepare(scene:THREE.Scene,hero:THREE.Object3D){
  // Reuse the district's existing HDR reflection probe for outdoor paint/metal;
  // no building, lighting or environment layout is changed and no extra probe is rendered.
  if(!this.environment)scene.getObjectByName('blender-waterfront-sample')?.traverse(o=>{
   if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial&&m.envMap)this.environment=m.envMap;
  });
  const revision=hero.userData.visualRevision;
  if(this.root!==hero||revision===undefined||this.revision!==revision){
   this.root=hero;this.revision=revision;this.casters.length=0;this.surfaces.clear();
   hero.traverse(o=>{if(o instanceof THREE.Mesh){
   const materials=Array.isArray(o.material)?o.material:[o.material];
   if(materials.every(m=>m instanceof THREE.MeshStandardMaterial)){
    // Receiving moves to the local map; this is not a shadow-free fallback.
    o.receiveShadow=false;
    // The depth override cannot transmit tinted glass. An opaque visor shadow
    // would hide the real face/eyes and make a transparent helmet look empty.
    if(materials.every(m=>m.transparent&&m.opacity<.98))o.layers.disable(this.layer);
    else {o.layers.enable(this.layer);this.casters.push({mesh:o,material:o.material});}
    for(const m of materials){const surface=m as THREE.MeshStandardMaterial;this.surfaces.add(surface);this.configure(surface);}
   }
   }});
  // Quality reloads replace owned material clones. Do not retain obsolete assets.
   for(const [material,original] of this.originals)if(!this.surfaces.has(material)){
   material.onBeforeCompile=original.compile;material.customProgramCacheKey=original.key;material.envMap=original.environment;material.envMapIntensity=original.intensity;this.originals.delete(material);
   }
  }
  for(const surface of this.surfaces)if(this.environment&&surface.envMap!==this.environment){surface.envMap=this.environment;surface.envMapIntensity=/fabric|textile|nylon/i.test(surface.name)?.22:.72;surface.needsUpdate=true;}
 }
 update(renderer:THREE.WebGLRenderer,scene:THREE.Scene,hero:THREE.Object3D){
  this.prepare(scene,hero);
  const center=hero.getWorldPosition(this.center);center.y+=.85;
  this.camera.position.copy(center).addScaledVector(this.direction,8);this.camera.lookAt(center);this.camera.updateMatrixWorld();
  this.matrix.copy(this.biasMatrix).multiply(this.camera.projectionMatrix).multiply(this.camera.matrixWorldInverse);
  const target=renderer.getRenderTarget(),override=scene.overrideMaterial,background=scene.background,xr=renderer.xr.enabled,auto=renderer.shadowMap.autoUpdate,clear=renderer.autoClear;
  try {
   // Keep the original meshes, shader, pose and depth resolution. Clear depth
   // once; neither writing/clearing unused colour nor a second automatic clear
   // can contribute to the sampled self-shadow.
   for(const caster of this.casters)caster.mesh.material=this.depth;
   renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.autoClear=false;
   renderer.setRenderTarget(this.target);renderer.clear(false,true,false);renderer.render(hero,this.camera);
  }finally{for(const caster of this.casters)caster.mesh.material=caster.material;renderer.setRenderTarget(target);scene.overrideMaterial=override;scene.background=background;renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=auto;renderer.autoClear=clear;}
 }
 dispose(){
  for(const [material,original] of this.originals){material.onBeforeCompile=original.compile;material.customProgramCacheKey=original.key;material.envMap=original.environment;material.envMapIntensity=original.intensity;material.needsUpdate=true;}
  this.originals.clear();this.surfaces.clear();this.casters.length=0;this.root=undefined;this.target.dispose();this.depth.dispose();
 }
}

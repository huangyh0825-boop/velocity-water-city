import * as THREE from 'three';

/** Small, deterministic baked surfaces; no per-frame noise or extra draw pass. */
export function marineSurface(kind:'quay'|'ramp',size=kind==='ramp'?512:256){
 const color=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,i=(y*size+x)*4,grain=((x*73+y*151+(x*y)%37)%101)/100-.5;
  let rgb:number[],r:number;
  if(kind==='quay'){
   const joint=x<2||y<2,lip=y>size*.88,water=v<.32,drip=(x*17%67)<3&&v<.57;
   const shade=(joint?.59:1)+grain*.045-(water?.13:0)-(drip?.045:0);
   rgb=(lip?[172,189,191]:[116,133,139]).map(n=>n*shade);r=water?142:lip?172:219;
   // Recessed service joint, two fixing heads and a small marine marker.
   if(Math.hypot(u-.12,v-.77)<.014||Math.hypot(u-.88,v-.77)<.014){rgb=[72,88,92];r=147;}
   if(u>.70&&u<.79&&v>.67&&v<.72){rgb=[137,210,212];r=174;}
  }else{
   const px=u*256,py=v*256,panel=px%64<1.5||py%64<1.5,tread=(px+py)%16<1.8&&px%16<8;
   rgb=(panel?[32,48,57]:tread?[92,112,118]:[53,74,85]).map(n=>n+grain*5);r=panel?226:tread?151:196;
   const edge=u<.065||u>.935;
   if(edge){const hazard=(Math.floor(v*18+u*3)%2)===0;rgb=hazard?[225,169,74]:[49,61,65];r=175;}
   // Three broad painted chevrons point toward the physical launch lip (+V).
   const a=Math.abs(u-.5),phase=(v*3)%1;
   if(a<.27&&Math.abs(phase-(.68-a*1.2))<.06){const coverage=Math.min(1,(.06-Math.abs(phase-(.68-a*1.2)))*size/1.5);rgb=rgb.map((n,i)=>n+([190,230,229][i]-n)*coverage);r=181;}
   if((u>.08&&u<.095)||(u>.905&&u<.92)){rgb=[107,206,207];r=166;}
  }
  // Opaque surface: unused albedo alpha stores linear roughness. Reuse the
  // existing albedo sample instead of adding another texture fetch / texture.
  color.set([...rgb.map(n=>Math.round(Math.max(0,Math.min(255,n)))),r],i);
 }
 const texture=(data:Uint8Array,srgb=false)=>{const t=new THREE.DataTexture(data,size,size);t.name=`marine-${kind}-${srgb?'color':'roughness'}`;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=4;t.needsUpdate=true;return t;};
 return {map:texture(color,true)};
}

export function marineMaterial(kind:'quay'|'ramp',parameters:THREE.MeshStandardMaterialParameters){
 const material=new THREE.MeshStandardMaterial({...parameters,...marineSurface(kind)});
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor = roughness;
  #ifdef USE_MAP
   roughnessFactor *= sampledDiffuseColor.a;
  #endif`);};
 material.customProgramCacheKey=()=>`marine-packed-roughness-v1`;return material;
}

/** Six-sided extruded profile with small real upper chamfers. Kept inside the
 * original unit box, including the submerged skirt and original top height. */
export function quayProfile(){
 const shape=new THREE.Shape();shape.moveTo(-.5,-.5);shape.lineTo(.5,-.5);shape.lineTo(.5,.43);shape.lineTo(.43,.5);shape.lineTo(-.43,.5);shape.lineTo(-.5,.43);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,steps:1});g.translate(0,0,-.5);
 const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){
  // Top/end caps use their own planar coordinates. Long side walls carry the
  // precast seams and baked waterline without world-position shader work.
  if(Math.abs(n.getZ(i))>.9)uv.setXY(i,p.getX(i)+.5,p.getY(i)+.5);
  else if(Math.abs(n.getY(i))>.9)uv.setXY(i,p.getX(i)+.5,p.getZ(i)+.5);
  else uv.setXY(i,p.getZ(i)+.5,p.getY(i)+.5);
 }
 g.clearGroups();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

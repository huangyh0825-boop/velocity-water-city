import * as THREE from 'three';

/** Share genuinely identical ORM samplers/UVs. Distinct textures keep stock code. */
export function sharePackedMaterialSampling(material:THREE.MeshStandardMaterial){
 const packed=material.roughnessMap;if(!packed)return;
 const metal=material.metalnessMap===packed,ao=material.aoMap===packed;if(!metal&&!ao)return;
 const original=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  original.call(material,shader,renderer);
  const alias=(text:string)=>{
   for(const name of [metal?'Metalness':null,ao?'Ao':null])if(name)text=text.replace(`varying vec2 v${name}MapUv;`,`#define v${name}MapUv vRoughnessMapUv`);
   return text;
  };
  let vertex=THREE.ShaderChunk.uv_vertex;
  if(metal)vertex=vertex.replace('vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;','');
  if(ao)vertex=vertex.replace('vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;','');
  shader.vertexShader=shader.vertexShader.replace('#include <uv_pars_vertex>',alias(THREE.ShaderChunk.uv_pars_vertex)).replace('#include <uv_vertex>',vertex);
  shader.fragmentShader=shader.fragmentShader.replace('#include <uv_pars_fragment>',alias(THREE.ShaderChunk.uv_pars_fragment));
  if(metal)shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',THREE.ShaderChunk.metalnessmap_fragment.replace('texture2D( metalnessMap, vMetalnessMapUv )','texelRoughness'));
  if(ao)shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',THREE.ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vAoMapUv )','texelRoughness'));
 };
 material.customProgramCacheKey=()=>key+`|packed-orm-m${Number(metal)}a${Number(ao)}`;
}

import * as THREE from 'three';

/** Zero weights cannot contribute to skinning. Preserve all nonzero weights,
 * bone transforms, bind matrices and the stock position/normal arithmetic. */
export function sparseSkinning(material:THREE.Material){
 const original=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  original.call(material,shader,renderer);
  shader.vertexShader=shader.vertexShader.replace('#include <skinbase_vertex>',`
   #ifdef USE_SKINNING
    mat4 boneMatX=mat4(0.0),boneMatY=mat4(0.0),boneMatZ=mat4(0.0),boneMatW=mat4(0.0);
    if(skinWeight.x!=0.0)boneMatX=getBoneMatrix(skinIndex.x);
    if(skinWeight.y!=0.0)boneMatY=getBoneMatrix(skinIndex.y);
    if(skinWeight.z!=0.0)boneMatZ=getBoneMatrix(skinIndex.z);
    if(skinWeight.w!=0.0)boneMatW=getBoneMatrix(skinIndex.w);
   #endif`);
 };
 material.customProgramCacheKey=()=>key+'|sparse-skinning-v1';
}

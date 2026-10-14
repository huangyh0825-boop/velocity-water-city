import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {readableSign} from '../src/environment/ReadableSign';
test('both sign faces expose readable UVs and the approach normal opposes route heading',()=>{
 for(const h of [0,.3,1.8,-2.4]){
  const sign=readableSign(new THREE.Texture(),14,3.5,'test');sign.rotation.y=h;sign.updateMatrixWorld(true);const forward=new THREE.Vector3(Math.sin(h),0,Math.cos(h));
  for(const [i,face] of sign.children.entries()){
   const mesh=face as THREE.Mesh,normal=new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld),center=new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld),camera=new THREE.PerspectiveCamera(50,1.5,.1,100);camera.position.copy(center).addScaledVector(normal,20);camera.lookAt(center);camera.updateMatrixWorld(true);
   assert.equal((mesh.material as THREE.Material).side,THREE.FrontSide);assert.ok(normal.dot(forward)*(i===0?-1:1)>.999);
   const uv=mesh.geometry.attributes.uv,p=mesh.geometry.attributes.position,byUV=(u:number,v:number)=>{const index=Array.from({length:uv.count},(_,j)=>j).find(j=>Math.abs(uv.getX(j)-u)<.001&&Math.abs(uv.getY(j)-v)<.001)!;return new THREE.Vector3().fromBufferAttribute(p,index).applyMatrix4(mesh.matrixWorld).project(camera);};
   assert.ok(byUV(0,0).x<byUV(1,0).x);assert.ok(byUV(0,0).y<byUV(0,1).y);
  }
 }
});

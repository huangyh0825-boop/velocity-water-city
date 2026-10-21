import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {cacheStaticTransforms} from '../src/core/StaticTransforms';
test('static scenery retains exact world transforms while visibility and moving instances remain live',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),group=new THREE.Group(),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),1);
 root.position.set(40,0,22);root.rotation.y=.7;group.position.set(2,4,-3);mesh.position.y=3;scene.add(root);root.add(group);group.add(mesh);scene.updateMatrixWorld(true);const expected=mesh.matrixWorld.clone();
 cacheStaticTransforms(root);let updates=0;mesh.updateMatrix=()=>{updates++;};
 for(let i=0;i<5;i++)scene.updateMatrixWorld(true);
 assert.equal(updates,0);assert.deepEqual(mesh.matrixWorld.elements,expected.elements);
 const moved=new THREE.Matrix4().makeTranslation(6,7,8);mesh.setMatrixAt(0,moved);mesh.visible=false;scene.updateMatrixWorld(true);const actual=new THREE.Matrix4();mesh.getMatrixAt(0,actual);assert.deepEqual(actual.elements,moved.elements);assert.equal(mesh.visible,false);
 // Asset / quality reloads and fresh reflection-view meshes can be cached again.
 const child=new THREE.Object3D();child.position.x=5;group.add(child);cacheStaticTransforms(root);assert.ok(child.matrixWorld.elements[12]!==0);assert.deepEqual(mesh.matrixWorld.elements,expected.elements);
 mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();mesh.dispose();
});

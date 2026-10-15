import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {CityMaterialBatch} from '../src/environment/CityMaterialBatch';

test('shared-material city batch switches independent LOD geometry without duplicate visible buildings',()=>{
 const material=new THREE.MeshStandardMaterial(),near=new THREE.BoxGeometry(2,4,2),far=new THREE.BoxGeometry(1,3,1);
 const batch=new CityMaterialBatch(new Map([['a:near',[{geometry:near,material}]],['a:far',[{geometry:far,material}]],['b:near',[{geometry:near,material}]]]),[{kind:'a',tint:0},{kind:'b',tint:1}],[new THREE.Matrix4(),new THREE.Matrix4().makeTranslation(10,0,0)]);
 assert.equal(batch.meshes.length,1);const mesh=batch.meshes[0];assert.equal(mesh.instanceCount,2);
 batch.setLOD(0,0);batch.setLOD(1,0);assert.equal(mesh.getVisibleAt(0),true);assert.equal(mesh.getVisibleAt(1),true);
 const first=mesh.getGeometryIdAt(0);batch.setLOD(0,2);assert.notEqual(mesh.getGeometryIdAt(0),first);assert.equal(mesh.getVisibleAt(1),true);
 batch.setLOD(1,2);assert.equal(mesh.getVisibleAt(1),false);batch.setLOD(1,0);assert.equal(mesh.getVisibleAt(1),true);
 const matrix=new THREE.Matrix4();mesh.getMatrixAt(1,matrix);assert.equal(matrix.elements[12],10);assert.equal(mesh.instanceCount,2);
 batch.dispose();near.dispose();far.dispose();material.dispose();
});

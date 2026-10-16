import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {visualGeometry} from './helpers/visual-glb';

test('R7 has a genuinely open jet-nozzle bore and a separate solid reverse bucket',async()=>{
 const {scene}=await visualGeometry('watercraft');scene.updateMatrixWorld(true);
 const nozzle=scene.getObjectByName('R7_Nozzle')!,bucket=scene.getObjectByName('R7_ReverseBucket')!;assert.ok(nozzle&&bucket);
 const ray=new THREE.Raycaster(new THREE.Vector3(0,.04,-2.5),new THREE.Vector3(0,0,1));assert.equal(ray.intersectObject(nozzle,true).length,0,'nozzle bore must not be capped');
 ray.ray.origin.y+=.116;assert.ok(ray.intersectObject(nozzle,true).length>0,'cast nozzle wall must exist around the bore');
 const box=new THREE.Box3().setFromObject(bucket);assert.ok(box.max.y>.25&&box.min.z< -2.15);
});

test('R7 handgrips and actual foot-mat contact surfaces fit the unchanged rider sockets',async()=>{
 const {scene}=await visualGeometry('watercraft');scene.updateMatrixWorld(true);
 for(const side of ['L','R']){
  const grip=scene.getObjectByName(`Grip_${side}`)!.getWorldPosition(new THREE.Vector3()),gripMesh=scene.getObjectByName(`R7_Grip_${side}`)!;
  assert.ok(new THREE.Box3().setFromObject(gripMesh).containsPoint(grip));
  const foot=scene.getObjectByName(`Foot_${side}`)!.getWorldPosition(new THREE.Vector3()),mat=scene.getObjectByName(`R7_FootMat_${side}`)!;
  const ray=new THREE.Raycaster(foot.clone().add(new THREE.Vector3(0,.1,0)),new THREE.Vector3(0,-1,0));const hits=ray.intersectObject(mat,true);assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-foot.y)<.012);
 }
 assert.ok(scene.getObjectByName('R7_SeatDriver'));assert.ok(scene.getObjectByName('RiderSeat')!.position.distanceTo(new THREE.Vector3(0,.88,-.10))<1e-5);
});

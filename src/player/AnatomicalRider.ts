import * as THREE from 'three';

interface Limb {upper:THREE.Bone;lower:THREE.Bone;length1:number;length2:number;upperRest:THREE.Quaternion;lowerRest:THREE.Quaternion;direction1:THREE.Vector3;direction2:THREE.Vector3;side:number}
/** Visual-only two-bone reach. Skin and body proportions come from the authored GLB. */
export class AnatomicalRider {
 private limbs:Limb[]=[];private torsoRest:THREE.Quaternion;
 constructor(private root:THREE.Group,private torso:THREE.Object3D,private grips:THREE.Vector3[]){
  root.updateWorldMatrix(true,true);const inverse=root.getWorldQuaternion(new THREE.Quaternion()).invert();
  this.torsoRest=inverse.clone().multiply(torso.getWorldQuaternion(new THREE.Quaternion()));
  for(const side of [-1,1]){
   const upper=root.getObjectByName(`UpperArm_${side}`) as THREE.Bone,lower=root.getObjectByName(`Forearm_${side}`) as THREE.Bone,hand=root.getObjectByName(`Hand_${side}`)!;
   const a=root.worldToLocal(upper.getWorldPosition(new THREE.Vector3())),b=root.worldToLocal(lower.getWorldPosition(new THREE.Vector3())),c=root.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));
   this.limbs.push({upper,lower,side,length1:a.distanceTo(b),length2:b.distanceTo(c),upperRest:inverse.clone().multiply(upper.getWorldQuaternion(new THREE.Quaternion())),lowerRest:inverse.clone().multiply(lower.getWorldQuaternion(new THREE.Quaternion())),direction1:b.clone().sub(a).normalize(),direction2:c.clone().sub(b).normalize()});
  }
 }
 private orient(bone:THREE.Object3D,localWorld:THREE.Quaternion){
  const rootRotation=this.root.getWorldQuaternion(new THREE.Quaternion()),parentRotation=bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentRotation.invert().multiply(rootRotation).multiply(localWorld));bone.updateWorldMatrix(false,true);
 }
 update(lean:number,bank:number){
  this.root.updateWorldMatrix(true,true);
  this.orient(this.torso,new THREE.Quaternion().setFromEuler(new THREE.Euler(lean-.15,0,bank)).multiply(this.torsoRest));
  for(const limb of this.limbs){
   const a=this.root.worldToLocal(limb.upper.getWorldPosition(new THREE.Vector3())),grip=this.grips[limb.side<0?0:1],delta=grip.clone().sub(a),axis=delta.clone().normalize();
   const distance=Math.max(.0001,Math.min(delta.length(),limb.length1+limb.length2-.0001)),along=(distance*distance+limb.length1**2-limb.length2**2)/(2*distance);
   const bend=new THREE.Vector3(limb.side,.05,-.15).addScaledVector(axis,-new THREE.Vector3(limb.side,.05,-.15).dot(axis)).normalize();
   const elbow=a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,limb.length1**2-along**2)));
   this.orient(limb.upper,new THREE.Quaternion().setFromUnitVectors(limb.direction1,elbow.clone().sub(a).normalize()).multiply(limb.upperRest));
   const actualElbow=this.root.worldToLocal(limb.lower.getWorldPosition(new THREE.Vector3()));
   this.orient(limb.lower,new THREE.Quaternion().setFromUnitVectors(limb.direction2,grip.clone().sub(actualElbow).normalize()).multiply(limb.lowerRest));
  }
 }
}

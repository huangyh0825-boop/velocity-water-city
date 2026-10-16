import * as THREE from 'three';

interface Limb {upper:THREE.Bone;lower:THREE.Bone;hand:THREE.Object3D;handRest:THREE.Quaternion;length1:number;length2:number;upperRest:THREE.Quaternion;lowerRest:THREE.Quaternion;direction1:THREE.Vector3;direction2:THREE.Vector3;side:number}
/** Visual-only two-bone reach. Skin and body proportions come from the authored GLB. */
export class AnatomicalRider {
 private limbs:Limb[]=[];private torsoRest:THREE.Quaternion;
 private hero=false;private neck?:THREE.Object3D;private neckRest=new THREE.Quaternion();
 private chest?:THREE.Object3D;private chestRest=new THREE.Quaternion();
 private clavicles:{bone:THREE.Object3D;rest:THREE.Quaternion;side:number}[]=[];
 constructor(private root:THREE.Group,private torso:THREE.Object3D,private grips:THREE.Vector3[]){
  root.updateWorldMatrix(true,true);const inverse=root.getWorldQuaternion(new THREE.Quaternion()).invert();
  this.torsoRest=inverse.clone().multiply(torso.getWorldQuaternion(new THREE.Quaternion()));
  this.hero=Boolean(root.getObjectByName('RaceRig')?.userData.heroDetailVersion);
  this.chest=root.getObjectByName('RiderChest');
  if(this.chest)this.chestRest.copy(inverse).multiply(this.chest.getWorldQuaternion(new THREE.Quaternion()));
  for(const side of [-1,1]){const bone=root.getObjectByName('Clavicle_'+side);if(bone)this.clavicles.push({bone,side,rest:inverse.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion()))});}
  this.neck=root.getObjectByName('Neck');
  if(this.neck)this.neckRest.copy(inverse).multiply(this.neck.getWorldQuaternion(new THREE.Quaternion()));
  for(const side of [-1,1]){
   const upper=root.getObjectByName(`UpperArm_${side}`) as THREE.Bone,lower=root.getObjectByName(`Forearm_${side}`) as THREE.Bone,hand=root.getObjectByName(`Hand_${side}`)!;
   const a=root.worldToLocal(upper.getWorldPosition(new THREE.Vector3())),b=root.worldToLocal(lower.getWorldPosition(new THREE.Vector3())),c=root.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));
   this.limbs.push({upper,lower,hand,handRest:inverse.clone().multiply(hand.getWorldQuaternion(new THREE.Quaternion())),side,length1:a.distanceTo(b),length2:b.distanceTo(c),upperRest:inverse.clone().multiply(upper.getWorldQuaternion(new THREE.Quaternion())),lowerRest:inverse.clone().multiply(lower.getWorldQuaternion(new THREE.Quaternion())),direction1:b.clone().sub(a).normalize(),direction2:c.clone().sub(b).normalize()});
  }
 }
 private orient(bone:THREE.Object3D,localWorld:THREE.Quaternion){
  const rootRotation=this.root.getWorldQuaternion(new THREE.Quaternion()),parentRotation=bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentRotation.invert().multiply(rootRotation).multiply(localWorld));bone.updateWorldMatrix(false,true);
 }
 update(lean:number,bank:number,airborne=0){
  this.root.updateWorldMatrix(true,true);
  const flex=lean-.15;
  this.orient(this.torso,new THREE.Quaternion().setFromEuler(new THREE.Euler(this.chest ? .12+flex*.4 : flex,0,this.chest ? bank*.55 : bank)).multiply(this.torsoRest));
  if(this.chest){
   // Lumbar and thoracic flexion form a curved back; the pelvis/feet stay seated.
   const pitch=.20+flex-Math.min(.05,airborne*.018);
   this.orient(this.chest,new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,0,bank)).multiply(this.chestRest));
   for(const {bone,rest,side} of this.clavicles)this.orient(bone,new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,side*flex*.10,bank+side*flex*.10)).multiply(rest));
  }
  for(const limb of this.limbs){
   const a=this.root.worldToLocal(limb.upper.getWorldPosition(new THREE.Vector3())),grip=this.grips[limb.side<0?0:1],delta=grip.clone().sub(a),axis=delta.clone().normalize();
   const distance=Math.max(.0001,Math.min(delta.length(),limb.length1+limb.length2-.0001)),along=(distance*distance+limb.length1**2-limb.length2**2)/(2*distance);
   const preference=this.hero?new THREE.Vector3(limb.side*.45,-.85,-.10):new THREE.Vector3(limb.side,.05,-.15);
   const bend=preference.addScaledVector(axis,-preference.dot(axis)).normalize();
   const elbow=a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,limb.length1**2-along**2)));
   this.orient(limb.upper,new THREE.Quaternion().setFromUnitVectors(limb.direction1,elbow.clone().sub(a).normalize()).multiply(limb.upperRest));
   const actualElbow=this.root.worldToLocal(limb.lower.getWorldPosition(new THREE.Vector3()));
   this.orient(limb.lower,new THREE.Quaternion().setFromUnitVectors(limb.direction2,grip.clone().sub(actualElbow).normalize()).multiply(limb.lowerRest));
   // Keep the closed fingers wrapped around the bar while elbows/shoulders move.
   if(this.hero)this.orient(limb.hand,limb.handRest);
  }
  // Visual counter-rotation lets the rider look ahead without a rigid torso/head block.
  if(this.hero&&this.neck)this.orient(this.neck,new THREE.Quaternion().setFromEuler(new THREE.Euler((this.chest ? .055 : 0)+flex*.28,bank*.18,bank*.3)).multiply(this.neckRest));
 }
}

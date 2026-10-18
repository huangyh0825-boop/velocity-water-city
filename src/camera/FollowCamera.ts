import * as THREE from 'three';
import {DrivingModel,MAX_SPEED} from '../player/DrivingModel';
import type {CameraObstacles} from './CameraObstacles';
/** Stable third-person chase camera; view direction always follows the craft. */
export class FollowCamera {
 readonly camera=new THREE.PerspectiveCamera(58,1,.1,2200);
 private look=new THREE.Vector3();private target=new THREE.Vector3();private pivot=new THREE.Vector3();
 obstacles?:CameraObstacles;
 constructor(){this.camera.position.set(0,5.5,-11);}
 update(dt:number,model:DrivingModel,immediate=false,height=0,boost=false,surfaceHeight=0){
  const speed=Math.min(1,model.speed/MAX_SPEED),distance=10+speed*3+(boost?1.4:0),blend=immediate?1:1-Math.exp(-dt*4);
  this.pivot.set(model.x,.9+surfaceHeight+(height-surfaceHeight)*.85,model.z);
  this.target.set(model.x-Math.sin(model.heading)*distance,5.1+speed*.6+surfaceHeight+(height-surfaceHeight)*.7,model.z-Math.cos(model.heading)*distance);
  this.camera.position.lerp(this.target,blend);
  this.target.set(model.x+Math.sin(model.heading)*5,this.pivot.y,model.z+Math.cos(model.heading)*5);
  this.look.lerp(this.target,immediate?1:1-Math.exp(-dt*6));
  // Retract immediately at an obstruction; the original lerp smoothly recovers.
  if(this.obstacles){this.target.subVectors(this.camera.position,this.pivot);const length=this.target.length(),safe=this.obstacles.distance(this.pivot,this.camera.position);if(safe<length)this.camera.position.copy(this.pivot).addScaledVector(this.target,safe/Math.max(.001,length));}
  this.camera.position.y=Math.max(.45,surfaceHeight+.35,this.camera.position.y);
  this.camera.lookAt(this.look);this.camera.fov+=(58+speed*12+(boost?4:0)-this.camera.fov)*(1-Math.exp(-dt*2));this.camera.updateProjectionMatrix();
 }
 resize(width:number,height:number){this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
}

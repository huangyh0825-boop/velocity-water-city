import * as THREE from 'three';
import {DrivingModel,MAX_SPEED} from '../player/DrivingModel';
import type {CameraObstacles} from './CameraObstacles';
/** Visual-only world orbit: the boat never receives mouse motion. */
export class FollowCamera {
 readonly camera=new THREE.PerspectiveCamera(58,1,.1,2200);
 private look=new THREE.Vector3();private target=new THREE.Vector3();private pivot=new THREE.Vector3();
 private free=false;private yaw=0;private pitch=.28;private zoom=0;
 obstacles?:CameraObstacles;
 constructor(){this.camera.position.set(0,5.5,-11);}
 engage(){if(this.free)return;const delta=this.target.subVectors(this.camera.position,this.look);this.yaw=Math.atan2(delta.x,delta.z);this.pitch=THREE.MathUtils.clamp(Math.atan2(delta.y,Math.hypot(delta.x,delta.z)),.045,1.25);this.free=true;}
 orbit(dx:number,dy:number,sensitivity=1){this.engage();this.yaw+=dx*.0025*sensitivity;this.yaw=Math.atan2(Math.sin(this.yaw),Math.cos(this.yaw));this.pitch=THREE.MathUtils.clamp(this.pitch-dy*.0025*sensitivity,.045,1.25);}
 wheel(delta:number){this.engage();this.zoom=THREE.MathUtils.clamp(this.zoom+delta*.012,-5,12);}
 restore(){this.free=false;this.zoom=0;}
 get state(){return{free:this.free,yaw:this.yaw,pitch:this.pitch,zoom:this.zoom};}
 update(dt:number,model:DrivingModel,immediate=false,height=0,boost=false,surfaceHeight=0){
  const speed=Math.min(1,model.speed/MAX_SPEED),distance=10+speed*3+(boost?1.4:0),blend=immediate?1:1-Math.exp(-dt*4);
  this.pivot.set(model.x,.9+surfaceHeight+(height-surfaceHeight)*.85,model.z);
  if(this.free&&!immediate){
   const radius=THREE.MathUtils.clamp(distance+this.zoom,5,28);
   this.target.set(model.x+Math.sin(this.yaw)*Math.cos(this.pitch)*radius,this.pivot.y+Math.sin(this.pitch)*radius,model.z+Math.cos(this.yaw)*Math.cos(this.pitch)*radius);
   this.camera.position.lerp(this.target,blend);this.look.lerp(this.pivot,1-Math.exp(-dt*6));
  }else{
   // Original classic chase, with unchanged speed/nitro offsets and turn lag.
   if(immediate){this.free=false;this.zoom=0;}
   this.target.set(model.x-Math.sin(model.heading)*distance,5.1+speed*.6+surfaceHeight+(height-surfaceHeight)*.7,model.z-Math.cos(model.heading)*distance);
   this.camera.position.lerp(this.target,blend);
   this.target.set(model.x+Math.sin(model.heading)*5,this.pivot.y,model.z+Math.cos(model.heading)*5);
   this.look.lerp(this.target,immediate?1:1-Math.exp(-dt*6));
  }
  // Retract immediately at an obstruction; the original lerp smoothly recovers.
  if(this.obstacles){this.target.subVectors(this.camera.position,this.pivot);const length=this.target.length(),safe=this.obstacles.distance(this.pivot,this.camera.position);if(safe<length)this.camera.position.copy(this.pivot).addScaledVector(this.target,safe/Math.max(.001,length));}
  this.camera.position.y=Math.max(.45,surfaceHeight+.35,this.camera.position.y);
  this.camera.lookAt(this.look);this.camera.fov+=(58+speed*12+(boost?4:0)-this.camera.fov)*(1-Math.exp(-dt*2));this.camera.updateProjectionMatrix();
 }
 resize(width:number,height:number){this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
}

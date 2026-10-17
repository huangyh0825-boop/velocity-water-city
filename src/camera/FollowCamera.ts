import * as THREE from 'three';
import { DrivingModel, MAX_SPEED } from '../player/DrivingModel';
export class FollowCamera {
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 2200);
  private look = new THREE.Vector3();
  private target = new THREE.Vector3();
  constructor() { this.camera.position.set(0, 5.5, -11); }
  update(dt: number, model: DrivingModel, immediate = false, height = 0, boost = false, surfaceHeight=0) {
    const speed = Math.min(1, model.speed / MAX_SPEED);
    const distance = 10 + speed * 3 + (boost ? 1.4 : 0);
    this.target.set(model.x - Math.sin(model.heading) * distance, 5.1 + speed * 0.6 + surfaceHeight+(height-surfaceHeight) * 0.7, model.z - Math.cos(model.heading) * distance);
    this.camera.position.lerp(this.target, immediate ? 1 : 1 - Math.exp(-dt * 4));
    this.target.set(model.x + Math.sin(model.heading) * 5, 0.9 + surfaceHeight+(height-surfaceHeight) * 0.85, model.z + Math.cos(model.heading) * 5);
    this.look.lerp(this.target, immediate ? 1 : 1 - Math.exp(-dt * 6));
    this.camera.lookAt(this.look);
    this.camera.fov += (58 + speed * 12 + (boost ? 4 : 0) - this.camera.fov) * (1 - Math.exp(-dt * 2));
    this.camera.updateProjectionMatrix();
  }
  resize(width: number, height: number) { this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
}

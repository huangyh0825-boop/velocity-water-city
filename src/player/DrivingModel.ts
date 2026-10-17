import type { InputState } from '../controls/InputController';
import { SPEED_TUNING, kmhToMps } from '../config/speed';
import { NITRO_TUNING } from '../config/phase3';
export const MAX_SPEED = kmhToMps(SPEED_TUNING.player.maxKmh);
// Preserve the original response at each existing speed, plateau above the old cap.
const STEERING_REFERENCE_SPEED = 38;
export const WORLD_LIMIT = 680;
/** Metres, seconds and radians. Pure model; independent of rendering and inputs. */
export class DrivingModel {
  x = 0; z = 0; heading = 0; speed = 0; yawRate = 0; vx = 0; vz = 0;
  worldLimit:number=WORLD_LIMIT;
  /** World-space surface/flight height metadata; horizontal driving curves are unchanged. */
  y=0;
  route:string|null|undefined=undefined;
  routeIntent:string|null|undefined=undefined;
  update(dt: number, input: InputState, boost = false) {
    const speedRatio = Math.min(1, this.speed / MAX_SPEED);
    const thrust = SPEED_TUNING.player.launchAcceleration + (SPEED_TUNING.player.topSpeedAcceleration - SPEED_TUNING.player.launchAcceleration) * speedRatio;
    const acceleration = input.throttle * thrust - input.brake * 17 - 0.7 - this.speed * 0.018 + (boost ? NITRO_TUNING.acceleration : 0);
    const limit = boost ? MAX_SPEED * NITRO_TUNING.multiplier : Math.max(MAX_SPEED, this.speed - NITRO_TUNING.releaseDeceleration * dt);
    this.speed = Math.max(0, Math.min(limit, this.speed + acceleration * dt));
    const steeringRatio = Math.min(1, this.speed / STEERING_REFERENCE_SPEED);
    const targetYaw = input.steer * (0.9 - 0.23 * steeringRatio) * Math.min(1, this.speed / 5);
    this.yawRate += (targetYaw - this.yawRate) * (1 - Math.exp(-dt * 3.5));
    this.heading += this.yawRate * dt;
    const grip = 1 - Math.exp(-dt * 3.8);
    this.vx += (Math.sin(this.heading) * this.speed - this.vx) * grip;
    this.vz += (Math.cos(this.heading) * this.speed - this.vz) * grip;
    this.x += this.vx * dt; this.z += this.vz * dt;
    const radius = Math.hypot(this.x, this.z);
    if (radius > this.worldLimit) {
      this.x *= this.worldLimit / radius; this.z *= this.worldLimit / radius;
      this.speed *= Math.exp(-dt * 7); this.vx *= Math.exp(-dt * 10); this.vz *= Math.exp(-dt * 10);
    }
  }
  reset() { this.routeIntent=undefined;this.route=undefined;this.y=0;this.x = this.z = this.heading = this.speed = this.yawRate = this.vx = this.vz = 0; }
}

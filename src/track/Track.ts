import type { DrivingModel } from '../player/DrivingModel';
export interface Point { x: number; z: number }
export const TAU = Math.PI * 2;
export const signedAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
/** First course: a circular canal, measured in metres. Rendering is separate. */
export class Track {
  readonly name = '天际环城水道';
  readonly radius = 120;
  readonly halfWidth = 22;
  readonly checkpointCount = 8;
  readonly length = TAU * this.radius;
  point(angle: number, lane = 0): Point {
    return { x: Math.cos(angle) * (this.radius + lane), z: Math.sin(angle) * (this.radius + lane) };
  }
  angle(point: Point) { return Math.atan2(point.z, point.x); }
  heading(angle: number) { return -angle; }
  checkpointAngle(index: number) { return index * TAU / this.checkpointCount; }
  contains(point: Point, margin = 0) { return Math.abs(Math.hypot(point.x, point.z) - this.radius) <= this.halfWidth - margin; }
  spawn(model: DrivingModel, angle = -0.14, lane = 0) {
    model.reset(); Object.assign(model, this.point(angle, lane)); model.heading = this.heading(angle);
  }
  /** Sweep through the gate plane, in the race direction, inside its aperture. */
  crossesGate(before: Point, after: Point, index: number): boolean {
    const angle = this.checkpointAngle(index), gate = this.point(angle);
    const tx = -Math.sin(angle), tz = Math.cos(angle);
    const a = (before.x - gate.x) * tx + (before.z - gate.z) * tz;
    const b = (after.x - gate.x) * tx + (after.z - gate.z) * tz;
    if (a >= 0 || b < 0 || b - a < 1e-8) return false;
    const t = -a / (b - a);
    const x = before.x + (after.x - before.x) * t;
    const z = before.z + (after.z - before.z) * t;
    const radial = (x - gate.x) * Math.cos(angle) + (z - gate.z) * Math.sin(angle);
    return Math.abs(radial) <= this.halfWidth && this.contains({ x, z });
  }
  constrain(model: DrivingModel): boolean {
    const r = Math.hypot(model.x, model.z), safeWidth = this.halfWidth - 1;
    const radius = Math.max(this.radius - safeWidth, Math.min(this.radius + safeWidth, r));
    if (r === radius) return false;
    const nx = r > 0 ? model.x / r : 1, nz = r > 0 ? model.z / r : 0;
    model.x = nx * radius; model.z = nz * radius;
    const normalSpeed = model.vx * nx + model.vz * nz;
    if ((r > radius && normalSpeed > 0) || (r < radius && normalSpeed < 0)) {
      model.vx -= normalSpeed * nx; model.vz -= normalSpeed * nz;
    }
    model.speed *= 0.98;
    return true;
  }
}

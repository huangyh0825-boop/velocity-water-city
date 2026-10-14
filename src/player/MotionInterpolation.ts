import { DrivingModel } from './DrivingModel';
const fields = ['x', 'z', 'heading', 'speed', 'yawRate', 'vx', 'vz'] as const;
/** Display-only poses: physics is never overwritten by interpolated values. */
export class MotionInterpolation {
  private previous = new DrivingModel();
  private displayed = new DrivingModel();
  constructor(private readonly model: DrivingModel) { this.reset(); }
  capture() { for (const field of fields) this.previous[field] = this.model[field]; }
  sample(alpha: number): DrivingModel {
    const blend = Math.max(0, Math.min(1, alpha));
    for (const field of fields) this.displayed[field] = this.previous[field] + (this.model[field] - this.previous[field]) * blend;
    return this.displayed;
  }
  reset() { this.capture(); this.sample(1); }
}

import type { DrivingModel } from '../player/DrivingModel';
export interface Point { x: number; z: number; y?:number;route?:string|null;routeIntent?:string|null }
export const TAU = Math.PI * 2;
export const signedAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
/** First course: a circular canal, measured in metres. Rendering is separate. */
export class Track {
  readonly isSpline:boolean=false;
  readonly name:string = '天际环城水道';
  readonly radius:number = 120;
  readonly halfWidth:number = 22;
  readonly checkpointCount:number = 8;
  readonly length = TAU * this.radius;
  readonly vertical=false as boolean;
  surface(p:Point){return{height:0,slope:0,heading:this.heading(this.angle(p)),branch:null as string|null};}
  raceRoute(before:Point,after:Point,active:string|null,entered?:ReadonlySet<string>){return active;}
  raceAngle(p:Point,route:string|null){return this.angle(p);}
  point(angle: number, lane = 0): Point {
    return { x: Math.cos(angle) * (this.radius + lane), z: Math.sin(angle) * (this.radius + lane) };
  }
  angle(point: Point) { return Math.atan2(point.z, point.x); }
  heading(angle: number) { return -angle; }
  offset(p:Point){return Math.hypot(p.x,p.z)-this.radius;}
  widthAt(angle:number){return this.halfWidth;}
  curvature(angle:number,distance=35){return signedAngle(this.heading(angle+distance/this.radius)-this.heading(angle))/distance;}
  target(p:Point,distance:number,lane=0){return this.point(this.angle(p)+distance/this.radius,lane);}
  checkpointAngle(index: number) { return index * TAU / this.checkpointCount; }
  contains(point: Point, margin = 0) { return Math.abs(Math.hypot(point.x, point.z) - this.radius) <= this.halfWidth - margin; }
  spawn(model: DrivingModel, angle = -0.14, lane = 0) {
    model.reset(); Object.assign(model, this.point(angle, lane)); model.heading = this.heading(angle);
  }
  /** Sweep through the gate plane, in the race direction, inside its aperture. */
  crossesGate(before: Point, after: Point, index: number,route?:string|null): boolean {
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

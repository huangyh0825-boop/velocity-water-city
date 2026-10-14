import { DrivingModel } from '../player/DrivingModel';
/** Matches the 1.6m wide hull, including its nose, excluding wake and fins. */
export const BOAT_HULL = { radius: 0.8, halfSegment: 1.6, forwardOffset: 0.2 } as const;
export interface BoatBody { id: string; model: DrivingModel; fixed?: boolean; height?: number }
export interface ContactEvent { key:string; x:number; z:number; height:number; strength:number }
interface Point { x: number; z: number }
interface Snapshot extends Point { heading: number; height?: number }
interface Motion extends Snapshot { body: BoatBody; vx: number; vz: number; end: Snapshot; hit: boolean }
const dot = (a: Point, b: Point) => a.x * b.x + a.z * b.z;
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, z: a.z - b.z });
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function segment(pose: Snapshot): [Point, Point] {
  const fx = Math.sin(pose.heading), fz = Math.cos(pose.heading);
  return [
    { x: pose.x + fx * (BOAT_HULL.forwardOffset - BOAT_HULL.halfSegment), z: pose.z + fz * (BOAT_HULL.forwardOffset - BOAT_HULL.halfSegment) },
    { x: pose.x + fx * (BOAT_HULL.forwardOffset + BOAT_HULL.halfSegment), z: pose.z + fz * (BOAT_HULL.forwardOffset + BOAT_HULL.halfSegment) },
  ];
}
function closest(a: Snapshot, b: Snapshot): [Point, Point] {
  const [p, p2] = segment(a), [q, q2] = segment(b);
  const d = sub(p2, p), e = sub(q2, q), r = sub(p, q);
  const aa = dot(d, d), ee = dot(e, e), de = dot(d, e), dr = dot(d, r), er = dot(e, r);
  const denominator = aa * ee - de * de;
  let s = denominator > 1e-9 ? clamp((de * er - dr * ee) / denominator) : 0;
  let t = (de * s + er) / ee;
  if (t < 0) { t = 0; s = clamp(-dr / aa); }
  else if (t > 1) { t = 1; s = clamp((de - dr) / aa); }
  return [{ x: p.x + d.x * s, z: p.z + d.z * s }, { x: q.x + e.x * t, z: q.z + e.z * t }];
}
export function hullOverlap(a: Snapshot, b: Snapshot): number {
  const [p, q] = closest(a, b);
  return Math.max(0, BOAT_HULL.radius * 2 - Math.hypot(q.x - p.x, q.z - p.z));
}
/** Small swept substeps; positional relaxation never reapplies velocity impulses. */
export class BoatCollisions {
  private previous = new Map<string, Snapshot>();
  lastContacts = 0;
  lastSubsteps = 1;
  readonly events:ContactEvent[]=[];
  private corrections = new Map<string, number>();
  private contacts = new Set<string>();
  private paths=new Map<string,Snapshot[]>();
  sweptPath(id:string):readonly Snapshot[]{return this.paths.get(id)??[];}
  hasContact(id: string) { return this.contacts.has(id); }
  movementAllowance(id: string) { return this.corrections.get(id) ?? 0; }
  capture(bodies: readonly BoatBody[]) {
    this.previous.clear();
    bodies.forEach(({ id, model, height }) => this.previous.set(id, { x: model.x, z: model.z, heading: model.heading, height: height ?? 0 }));
  }
  resolve(bodies: readonly BoatBody[], dt: number, constrain?: (model: DrivingModel) => void) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    let distance = 0;
    const motions: Motion[] = bodies.map(body => {
      const m = body.model, start = this.previous.get(body.id) ?? { x: m.x, z: m.z, heading: m.heading };
      distance = Math.max(distance, Math.hypot(m.x - start.x, m.z - start.z) + Math.abs(m.heading - start.heading) * 2.6);
      return { body, ...start, vx: body.fixed ? 0 : (m.x - start.x) / dt, vz: body.fixed ? 0 : (m.z - start.z) / dt, end: { x: m.x, z: m.z, heading: m.heading, height: body.height ?? 0 }, hit: false };
    });
    // At 180km/h / 60Hz this is ~4–5 substeps. Relative travel < 0.44m vs 1.6m hull width.
    this.lastSubsteps = Math.max(1, Math.ceil(distance / 0.22));
    const step = dt / this.lastSubsteps, responded = new Set<string>();
    this.lastContacts = 0;
    this.events.length=0;
    this.corrections.clear();
    this.contacts.clear();
    this.paths.clear();motions.forEach(m=>this.paths.set(m.body.id,[{x:m.x,z:m.z,heading:m.heading,height:m.height}]));
    for (let substep = 0; substep < this.lastSubsteps; substep++) {
      motions.forEach(m => {
        m.x += m.vx * step; m.z += m.vz * step;
        const oldHeading = this.previous.get(m.body.id)?.heading ?? m.end.heading;
        m.heading = oldHeading + (m.end.heading - oldHeading) * (substep + 1) / this.lastSubsteps;
        const oldHeight = this.previous.get(m.body.id)?.height ?? 0;
        m.height = oldHeight + ((m.end.height ?? 0)-oldHeight)*(substep+1)/this.lastSubsteps;
      });
      for (let iteration = 0; iteration < 24; iteration++) {
        let penetration = 0;
        for (let i = 0; i < motions.length; i++) for (let j = i + 1; j < motions.length; j++) {
          const a = motions[i], b = motions[j], wa = a.body.fixed ? 0 : 1, wb = b.body.fixed ? 0 : 1;
          if (!wa && !wb) continue;
          if (Math.abs((a.height ?? 0)-(b.height ?? 0)) > 1.2) continue;
          if (Math.hypot(b.x - a.x, b.z - a.z) > 5.3) continue;
          const [p, q] = closest(a, b), dx = q.x - p.x, dz = q.z - p.z, length = Math.hypot(dx, dz);
          const depth = BOAT_HULL.radius * 2 - length;
          if (depth <= 0) continue;
          let nx: number, nz: number;
          if (length > 1e-8) { nx = dx / length; nz = dz / length; }
          else {
            const cx = b.x - a.x, cz = b.z - a.z, centerDistance = Math.hypot(cx, cz);
            if (centerDistance > 1e-8) { nx = cx / centerDistance; nz = cz / centerDistance; }
            else { nx = Math.cos(a.heading); nz = -Math.sin(a.heading); }
          }
          const correction = (depth + 0.0001) / (wa + wb);
          a.x -= nx * correction * wa; a.z -= nz * correction * wa;
          b.x += nx * correction * wb; b.z += nz * correction * wb;
          penetration = Math.max(penetration, depth); a.hit = b.hit = true;
          const key = `${i}:${j}`;
          if (!responded.has(key)) {
            responded.add(key); this.lastContacts++;
            const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
            if(closing>0.05) this.events.push({key:[a.body.id,b.body.id].sort().join(':'),x:(p.x+q.x)/2,z:(p.z+q.z)/2,height:Math.max(a.height??0,b.height??0),strength:closing});
            if (closing > 0.05) {
              const impulse = closing / (wa + wb);
              for (const [m, sign, weight] of [[a, -1, wa], [b, 1, wb]] as const) {
                if (!weight) continue;
                const before = Math.min(m.body.model.speed, Math.hypot(m.vx, m.vz));
                m.vx += sign * impulse * nx; m.vz += sign * impulse * nz;
                const after = Math.hypot(m.vx, m.vz), limit = before * (1 - Math.min(0.35, closing * 0.004));
                const scale = after > limit && after > 0 ? limit / after : 1;
                m.vx *= scale; m.vz *= scale;
                m.body.model.speed = Math.min(m.body.model.speed, Math.hypot(m.vx, m.vz));
              }
            }
          }
        }
        if (constrain) motions.forEach(m => {
          if (!m.hit) return;
          const model = m.body.model; model.x = m.x; model.z = m.z;
          if (m.hit) { model.vx = m.vx; model.vz = m.vz; }
          constrain(model); m.x = model.x; m.z = model.z;
          if (m.hit) { m.vx = model.vx; m.vz = model.vz; }
        });
        if (penetration < 0.0001) break;
      }
      motions.forEach(m=>this.paths.get(m.body.id)!.push({x:m.x,z:m.z,heading:m.heading,height:m.height}));
    }
    motions.forEach(m => {
      const model = m.body.model;
      if (m.hit) { model.x = m.x; model.z = m.z; model.vx = m.vx; model.vz = m.vz; }
      // Preserve exact original integration for boats without contact.
      else { model.x = m.end.x; model.z = m.end.z; }
      this.corrections.set(m.body.id, m.hit ? Math.hypot(model.x - m.end.x, model.z - m.end.z) : 0);
      if (m.hit) this.contacts.add(m.body.id);
    });
  }
}

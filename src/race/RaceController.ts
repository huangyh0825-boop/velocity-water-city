import { MAX_SPEED } from '../player/DrivingModel';
import { Track, signedAngle, type Point } from '../track/Track';
import {readBest,saveBest} from './BestTimes';
export type RacePhase = 'countdown' | 'racing' | 'finished';
export interface Racer {
  id: string; name: string; passed: number; position: Point; previous: Point;
  finishTime: number | null; progress: number;
  route:string|null;
  /** Legal shortcut entrances crossed during this lap, retained across a drift. */
  enteredRoutes:Set<string>;
  maxSpeed?:number;
}
export interface Entrant { id: string; name: string; position: Point;maxSpeed?:number }
export interface RaceOptions {laps?:number;bestKey?:string}
export class RaceController {
  readonly laps:number;
  private readonly bestKey:string;
  private readonly requiredAdvance:number[];
  phase: RacePhase = 'countdown';
  countdown = 3;
  elapsed = 0;
  readonly racers: Racer[];
  bestTime:number|null;
  constructor(readonly track: Track, entrants: Entrant[], readonly playerId = 'player',options:RaceOptions={}) {
    this.laps=options.laps??3;
    if(!Number.isSafeInteger(this.laps)||this.laps<1||!Number.isSafeInteger(this.laps*track.checkpointCount))throw Error('圈数必须为正整数');
    this.bestKey=options.bestKey??(this.laps===3?track.name:`${track.name}:laps:${this.laps}`);
    this.requiredAdvance=Array.from({length:track.checkpointCount},(_,last)=>{
      let advance=1;
      while(advance<track.checkpointCount&&!track.checkpointRequired((last+advance)%track.checkpointCount))advance++;
      return advance;
    });
    this.bestTime=readBest(this.bestKey);
    this.racers = entrants.map(e => ({ ...e, position: { ...e.position }, previous: { ...e.position }, passed: 0, finishTime: null,route:null, enteredRoutes:new Set<string>(), progress: track.angle(e.position) * track.radius }));
  }
  get player() { return this.racers.find(r => r.id === this.playerId)!; }
  nextCheckpoint(racer = this.player) { return (racer.passed + this.requiredAdvance[racer.passed%this.track.checkpointCount]) % this.track.checkpointCount; }
  lap(racer = this.player) { return Math.min(this.laps, Math.floor(racer.passed / this.track.checkpointCount) + 1); }
  tick(dt: number) {
    if (this.phase === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown < 1e-8) { this.countdown = 0; this.phase = 'racing'; }
    } else if (this.phase === 'racing') this.elapsed += dt;
  }
  record(id: string, position: Point, dt: number, collisionCorrection = 0) {
    const racer = this.racers.find(r => r.id === id);
    if (!racer || this.phase !== 'racing' || racer.finishTime !== null) return;
    const movement = Math.hypot(position.x - racer.previous.x, position.z - racer.previous.z);
    // Ignore checkpoint credit for discontinuities (e.g. external respawn/teleport).
    // A tuned AI may legitimately exceed the player's peak speed. Use only its
    // configured limit; the player and unconfigured racers retain the old guard.
    const continuous=movement <= (racer.maxSpeed??(MAX_SPEED+10)) * dt + 0.1 + Math.max(0, collisionCorrection);
    if(continuous){
      racer.route=this.track.raceRoute(racer.previous,position,racer.route,racer.enteredRoutes);
      if(racer.route!==null)racer.enteredRoutes.add(racer.route);
    }
    position.route=racer.route;
    const advance=this.requiredAdvance[racer.passed%this.track.checkpointCount];
    let credit=0;
    if(continuous){
      // Keep optional markers for smooth standings on either complete route.
      // A route switch may bypass them: only the next common, mandatory gate
      // is required, and its real forward sweep validates that whole section.
      if(this.track.crossesGate(racer.previous,position,(racer.passed+1)%this.track.checkpointCount,racer.route))credit=1;
      else if(advance>1&&this.track.crossesGate(racer.previous,position,this.nextCheckpoint(racer),racer.route))credit=advance;
    }
    if (credit) {
      racer.passed+=credit;
      if(racer.passed % this.track.checkpointCount === 0)racer.enteredRoutes.clear();
      if (racer.passed === this.laps * this.track.checkpointCount) racer.finishTime = this.elapsed;
    }
    racer.previous = { ...position }; racer.position = { ...position };
    const sector = this.track.length / this.track.checkpointCount;
    const lastGateAngle = this.track.checkpointAngle(racer.passed % this.track.checkpointCount);
    const offset = signedAngle(this.track.raceAngle(position,racer.route) - lastGateAngle) * this.track.radius;
    racer.progress = racer.passed * sector + Math.max(racer.passed === 0 ? -sector : 0, Math.min(this.requiredAdvance[racer.passed%this.track.checkpointCount]*sector - 0.001, offset));
  }
  /** Called after all racers have been recorded so finish order is independent of update order. */
  completeStep() { if (this.player.finishTime !== null&&this.phase!=='finished') {this.bestTime=saveBest(this.bestKey,this.player.finishTime);this.phase = 'finished';} }
  syncPosition(id: string, position: Point) {
    const racer = this.racers.find(r => r.id === id)!;
    racer.route=null;
    racer.position = { ...position }; racer.previous = { ...position };
    const sector = this.track.length / this.track.checkpointCount;
    const offset = signedAngle(this.track.angle(position) - this.track.checkpointAngle(racer.passed % this.track.checkpointCount)) * this.track.radius;
    racer.progress = racer.passed * sector + Math.max(racer.passed === 0 ? -sector : 0, Math.min(this.requiredAdvance[racer.passed%this.track.checkpointCount]*sector - 0.001, offset));
  }
  standings(): Racer[] {
    return [...this.racers].sort((a, b) => {
      if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime || a.id.localeCompare(b.id);
      if (a.finishTime !== null) return -1;
      if (b.finishTime !== null) return 1;
      return b.progress - a.progress || a.id.localeCompare(b.id);
    });
  }
  get playerRank() { return this.standings().findIndex(r => r.id === this.playerId) + 1; }
}

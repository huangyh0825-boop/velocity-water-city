export class EventLimiter {
  private last = new Map<string,number>();
  constructor(private interval=0.25) {}
  accept(key:string,time:number) { const last=this.last.get(key); if(last!==undefined && time-last<this.interval) return false; this.last.set(key,time);return true; }
  reset() {this.last.clear();}
}

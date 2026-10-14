export interface WakeStamp {x:number;z:number;heading:number;speed:number;age:number}
/** World-anchored foam stamps, one shared finite budget for all boats. */
export class WakePool {
  readonly capacity=200;
  readonly lifetime=1.45;
  limit=this.capacity;
  readonly stamps:WakeStamp[]=Array.from({length:this.capacity},()=>({x:0,z:0,heading:0,speed:0,age:10}));
  private cursor=0;
  get activeCount(){return this.stamps.reduce((n,p)=>n+(p.age<this.lifetime?1:0),0);}
  spawn(x:number,z:number,heading:number,speed:number){Object.assign(this.stamps[this.cursor++%this.limit],{x,z,heading,speed,age:0});}
  update(dt:number){for(const p of this.stamps)p.age=Math.min(10,p.age+dt);}
  reset(){for(const p of this.stamps)p.age=10;this.cursor=0;}
  setLow(low:boolean){this.limit=low?72:this.capacity;this.reset();}
}

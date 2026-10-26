export type FrameRate=0|60|120;
/** Controls visual submission only. Simulation always runs before this gate. */
export class RenderPacer{
 private due=0;private last=0;private started=false;delta=0;
 constructor(public rate:FrameRate=60){}
 setRate(rate:FrameRate){this.rate=rate;this.reset();}
 reset(){this.started=false;this.due=this.last=0;this.delta=0;}
 accepts(now:number){if(!this.started){this.started=true;this.last=now;this.due=now;this.delta=0;return true;}
  const interval=this.rate?1000/this.rate:0,elapsed=now-this.due;if(interval&&elapsed<interval-.01)return false;
  this.delta=Math.max(0,Math.min(.1,(now-this.last)/1000));this.last=now;
  // Snap the tiny rAF rounding error rather than carrying a whole overdue
  // interval into the next frame and accidentally submitting twice.
  this.due=interval?this.due+Math.max(1,Math.floor((elapsed+.01)/interval))*interval:now;return true;
 }
}

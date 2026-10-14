/** Emit each current countdown number once, including GO; never replay missed numbers. */
export class CountdownCue {
  private previous:number|null=null;
  update(phase:string,remaining:number){
    const value=phase==='countdown'?Math.max(1,Math.ceil(remaining-1e-8)):phase==='racing'?0:null;
    if(value===null||value===this.previous)return null;
    const previous=this.previous;this.previous=value;
    return value===0&&previous===null?null:value;
  }
  reset(){this.previous=null;}
}

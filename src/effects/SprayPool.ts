export class SprayPool {
  readonly capacity = 360;
  readonly positions = new Float32Array(this.capacity*3);
  readonly alpha = new Float32Array(this.capacity);
  readonly sizes = new Float32Array(this.capacity);
  private velocities = new Float32Array(this.capacity*3);
  private age = new Float32Array(this.capacity);
  private lifetime = new Float32Array(this.capacity);
  private cursor = 0;
  private floor=new Float32Array(this.capacity);
  limit = this.capacity;
  get activeCount() { let count=0; for(let i=0;i<this.capacity;i++) if(this.alpha[i]>0) count++; return count; }
  setLow(low:boolean) { this.limit=low?96:this.capacity; this.reset(); }
  spawn(x:number,y:number,z:number,vx:number,vy:number,vz:number,life:number,size:number,floor=0) {
    const i=this.cursor++%this.limit,k=i*3;
    this.positions[k]=x; this.positions[k+1]=y; this.positions[k+2]=z;
    this.velocities[k]=vx; this.velocities[k+1]=vy; this.velocities[k+2]=vz;
    this.age[i]=0; this.lifetime[i]=life; this.sizes[i]=size; this.alpha[i]=0.01;this.floor[i]=floor;
  }
  update(dt:number) {
    for(let i=0;i<this.capacity;i++) {
      if(this.alpha[i]<=0) continue;
      const k=i*3; this.age[i]+=dt;
      const t=this.age[i]/this.lifetime[i]; if(t>=1) {this.alpha[i]=0;continue;}
      this.velocities[k+1]-=13*dt;
      this.positions[k]+=this.velocities[k]*dt; this.positions[k+1]+=this.velocities[k+1]*dt; this.positions[k+2]+=this.velocities[k+2]*dt;
      this.alpha[i]=this.positions[k+1]<this.floor[i]+0.06?0:0.65*Math.min(1,this.age[i]/.045)*(1-t)*(1-t);
    }
  }
  reset() { this.alpha.fill(0);this.cursor=0; }
}

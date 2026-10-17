export class FlightController {
  state:'water'|'ramp'|'air'|'landing'='water';
  legalLaunch=false;
  generation=0;
  height = 0;
  previousHeight = 0;
  verticalSpeed = 0;
  airborne = false;
  elapsed = 0;
  readonly gravity = 14;
  private cooldown = 0;
  takeoff = false;
  landed = false;
  landingSpeed = 0;
  managedSurface=false;
  step=1/60;
  landingHeight=0;
  get remainingTime() { const gap=Math.max(0,this.height-(this.managedSurface?this.landingHeight:0));return this.airborne ? (this.verticalSpeed + Math.sqrt(this.verticalSpeed ** 2 + 2 * this.gravity * gap)) / this.gravity : 0; }
  launch(speed: number,verticalSpeed=4+Math.min(speed,60)*.14,supportHeight=2) {
    if (this.airborne || this.cooldown > 0 || speed < 2) return false;
    this.height = Math.max(this.height, supportHeight); this.verticalSpeed = verticalSpeed;
    this.airborne = true; this.state='air';this.legalLaunch=true;this.elapsed = 0; this.takeoff = true; return true;
  }
  get ready(){return !this.airborne&&this.cooldown<=0;}
  surface(height:number){if(this.airborne)return;this.height=height;this.state=height>0?'ramp':'water';}
  fall(){if(this.airborne||this.height<=0)return;this.airborne=true;this.state='air';this.legalLaunch=false;this.verticalSpeed=0;this.elapsed=0;}
  /** Leave actual support with its vertical momentum; no artificial height boost. */
  depart(height:number,velocity:number,dt:number,legal:boolean){
    this.previousHeight=height;this.height=height+velocity*dt-this.gravity*dt*dt/2;
    this.verticalSpeed=velocity-this.gravity*dt;this.airborne=true;this.state='air';this.legalLaunch=legal;this.takeoff=legal;this.elapsed=dt;
  }
  get impactFactor(){return Math.max(.90,1-Math.max(0,this.landingSpeed-16)*.004);}
  private landAt(height:number){
    this.height=height;this.landingSpeed=Math.abs(this.verticalSpeed);this.verticalSpeed=0;
    this.airborne=false;this.state='landing';this.landed=true;this.cooldown=.5;
  }
  /** A descending hull can contact the actual ramp beneath it before reaching water. */
  contactSurface(height:number){
    if(!this.airborne||height<0||this.verticalSpeed>0||this.previousHeight<height-1e-6||this.height>height)return false;
    this.landAt(height);return true;
  }
  beginStep(dt: number) {
    this.step=dt;
    this.previousHeight = this.height; this.takeoff = this.landed = false;
    if(this.state==='landing')this.state='water';
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.airborne) return;
    this.elapsed += dt; this.height += this.verticalSpeed * dt - this.gravity * dt * dt / 2;
    this.verticalSpeed -= this.gravity * dt;
    if (this.height <= 0&&!this.managedSurface) {
      this.landAt(0);
    }
  }
  displayHeight(alpha: number) { return this.previousHeight + (this.height - this.previousHeight) * Math.max(0, Math.min(1, alpha)); }
  reset() { this.generation++;this.managedSurface=false;this.landingHeight=0;this.step=1/60;this.state='water';this.legalLaunch=false;this.height = this.previousHeight = this.verticalSpeed = this.elapsed = this.cooldown = this.landingSpeed = 0; this.airborne = this.takeoff = this.landed = false; }
}

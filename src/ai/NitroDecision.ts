export interface NitroSituation {
  safe: boolean;
  opportunity: boolean;
  energy: number;
}

/** A latched request, not an alternative fuel or acceleration implementation. */
export class NitroDecision {
  requested = false;
  private nextDecision = 0;
  private held = 0;
  private contactCooldown = 0;
  constructor(private readonly stagger: number) { this.reset(); }
  reset() { this.requested=false; this.nextDecision=this.stagger; this.held=0; this.contactCooldown=0; }
  contact() { this.contactCooldown=.8; this.requested=false; }
  update(dt: number, situation: NitroSituation) {
    this.nextDecision -= dt;
    this.contactCooldown = Math.max(0,this.contactCooldown-dt);
    this.held = this.requested ? this.held+dt : 0;
    // Collision/landing danger and empty fuel override the minimum burst duration.
    if (!situation.safe || situation.energy<=0 || this.contactCooldown>0) {
      this.requested=false; this.held=0; return false;
    }
    if (this.nextDecision<=0) {
      this.nextDecision=.35;
      if (!this.requested) this.requested=situation.energy>=8 && situation.opportunity;
      else if (this.held>=.55) this.requested=situation.opportunity;
    }
    return this.requested;
  }
}

import { NITRO_TUNING } from '../config/phase3';
export class NitroController {
  energy: number = NITRO_TUNING.initial;
  active = false;
  update(dt: number, requested: boolean, enabled = true) {
    this.active = enabled && requested && this.energy > 0;
    if (this.active) this.energy = Math.max(0, this.energy - NITRO_TUNING.drainPerSecond * dt);
  }
  reward(amount: number) { this.energy = Math.max(0, Math.min(100, this.energy + Math.max(0, amount))); }
  reset() { this.energy = NITRO_TUNING.initial; this.active = false; }
}

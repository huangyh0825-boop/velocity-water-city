import { FlightController } from './FlightController';
import { NITRO_TUNING } from '../config/phase3';
export type TrickKind = 'front' | 'back' | 'spin';
export class TrickController {
  kind: TrickKind | null = null;
  progress = 0;
  used = false;
  completed = false;
  message = '';
  feedbackTime = 0;
  private duration = 1;
  private sequence = 0;
  private settled = false;
  beginJump() { this.kind = null; this.progress = 0; this.used = this.completed = this.settled = false; this.feedbackTime=0; this.message = '腾空 · 空格特技'; }
  request(flight: FlightController) {
    if (!flight.airborne || !flight.legalLaunch || this.used) return false;
    this.kind = (['front','back','spin'] as const)[this.sequence++ % 3];
    this.duration = this.kind === 'spin' ? 0.75 : 1.05;
    if (flight.remainingTime < this.duration + 0.12) { this.kind = 'spin'; this.duration = 0.75; }
    this.used = true; this.message = {front:'前空翻',back:'后空翻',spin:'水平旋转'}[this.kind]; return true;
  }
  update(dt: number) {
    this.feedbackTime=Math.max(0,this.feedbackTime-dt);
    if (!this.used || this.completed || !this.kind) return;
    this.progress = Math.min(1, this.progress + dt / this.duration); this.completed = this.progress >= 1 - 1e-8;
  }
  land(safe: boolean): { reward: number; penalty: boolean } {
    if (this.settled) return { reward: 0, penalty: false };
    this.settled = true;
    const success = this.used && this.completed && safe;
    const failed = this.used && !success;
    this.message = success ? '特技成功 · 氮气 +35%' : failed ? '落地失误 · 短暂减速' : '';
    this.feedbackTime=this.message?1.8:0;
    this.kind = null;
    return { reward: success ? NITRO_TUNING.reward : 0, penalty: failed };
  }
  get rotation() {
    const t = this.progress * this.progress * (3-2*this.progress), angle = t * Math.PI * 2;
    return { pitch: this.kind === 'front' ? angle : this.kind === 'back' ? -angle : 0, yaw: this.kind === 'spin' ? angle : 0 };
  }
  reset(sequence = 0) { this.sequence = Math.max(0, Math.floor(sequence)); this.beginJump(); this.message = ''; this.feedbackTime=0; }
}

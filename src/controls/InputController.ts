export interface InputState { throttle: number; brake: number; steer: number }
export class InputController {
  private keys = new Set<string>();
  private touches = new Map<number, string>();
  private trickQueued = false;
  private onKey = (event: KeyboardEvent) => {
    if(event.type==='keydown' && event.target instanceof HTMLElement && event.target.matches('input,textarea,select')) return;
    if (!['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].includes(event.code)) return;
    event.preventDefault();
    if (event.type === 'keydown') { if(event.code==='Space' && !event.repeat && !this.keys.has(event.code)) this.trickQueued=true; this.keys.add(event.code); }
    else this.keys.delete(event.code);
  };
  readonly clear = () => { this.keys.clear(); this.touches.clear(); this.trickQueued=false; };
  consumeTrickPress() { const queued=this.trickQueued; this.trickQueued=false; return queued; }
  get boost() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || [...this.touches.values()].includes('nitro'); }
  constructor() {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.clear);
  }
  bindButton(button: HTMLButtonElement, action: string) {
    button.addEventListener('pointerdown', event => {
      event.preventDefault(); button.setPointerCapture(event.pointerId);
      this.touches.set(event.pointerId, action);
      if(action==='trick') this.trickQueued=true;
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, event => this.touches.delete((event as PointerEvent).pointerId));
    }
  }
  get state(): InputState {
    const active = (action: string, ...keys: string[]) => [...this.touches.values()].includes(action) || keys.some(key => this.keys.has(key));
    return {
      throttle: Number(active('throttle', 'KeyW', 'ArrowUp')),
      brake: Number(active('brake', 'KeyS', 'ArrowDown')),
      steer: Number(active('left', 'KeyA', 'ArrowLeft')) - Number(active('right', 'KeyD', 'ArrowRight')),
    };
  }
  dispose() {
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.clear);
  }
}

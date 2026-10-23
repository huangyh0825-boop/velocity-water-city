import {raceTouchSurface} from './RaceTouchSurface';
export interface InputState { throttle: number; brake: number; steer: number }
export class InputController {
  private keys = new Set<string>();
  private touches = new Map<number, string>();
  private trickQueued = false;
  private focused = true;
  private touchEnabled = true;
  private buttons = new Map<HTMLButtonElement,string>();
  private releaseTouchSurface?:()=>void;
  bindTouchSurface(root:HTMLElement){if(!this.touchMode)return;this.releaseTouchSurface?.();this.releaseTouchSurface=raceTouchSurface(root);}
  private onBlur = () => { this.focused=false;this.clear(); };
  private onFocus = () => { this.focused=true; };
  private onKey = (event: KeyboardEvent) => {
    if(event.type==='keydown' && event.target instanceof HTMLElement && event.target.matches('input,textarea,select')) return;
    if (!['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].includes(event.code)) return;
    event.preventDefault();
    if (event.type === 'keydown') { if(event.code==='Space' && !event.repeat && !this.keys.has(event.code)) this.trickQueued=true; this.keys.add(event.code); }
    else this.keys.delete(event.code);
  };
  readonly clear = () => { this.keys.clear(); this.touches.clear(); this.trickQueued=false;for(const button of this.buttons.keys())button.setAttribute('aria-pressed','false'); };
  setTouchEnabled(enabled:boolean){if(this.touchEnabled===enabled)return;this.touchEnabled=enabled;this.clear();}
  releaseAction(action:string){for(const[id,value]of this.touches)if(value===action)this.touches.delete(id);for(const[button,value]of this.buttons)if(value===action)button.setAttribute('aria-pressed','false');}
  consumeTrickPress() { const queued=this.trickQueued; this.trickQueued=false; return queued; }
  get boost() { return this.focused&&(!this.touchMode||this.touchEnabled)&&(!this.touchMode||!this.keys.has('KeyS')&&!this.keys.has('ArrowDown')&&![...this.touches.values()].includes('brake'))&&(this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || [...this.touches.values()].includes('nitro')); }
  constructor(readonly touchMode=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches) {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
  }
  bindButton(button: HTMLButtonElement, action: string) {
    this.buttons.set(button,action);button.setAttribute('aria-pressed','false');
    button.addEventListener('pointerdown', event => {
      if(button.disabled||!this.touchEnabled)return;
      event.preventDefault(); button.setPointerCapture(event.pointerId);
      this.focused=true;button.setAttribute('aria-pressed','true');
      this.touches.set(event.pointerId, action);
      if(action==='trick') this.trickQueued=true;
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, event => {this.touches.delete((event as PointerEvent).pointerId);button.setAttribute('aria-pressed',String([...this.touches.values()].includes(action)));});
    }
  }
  get state(): InputState {
    if(!this.focused||this.touchMode&&!this.touchEnabled)return{throttle:0,brake:0,steer:0};
    const active = (action: string, ...keys: string[]) => [...this.touches.values()].includes(action) || keys.some(key => this.keys.has(key));
    const brake=Number(active('brake','KeyS','ArrowDown'));
    return {
      // Mobile replaces a held W only. The same driving model and race gating
      // remain authoritative; braking temporarily releases the mobile throttle.
      throttle: this.touchMode?1-brake:Number(active('throttle', 'KeyW', 'ArrowUp')),
      brake,
      steer: Number(active('left', 'KeyA', 'ArrowLeft')) - Number(active('right', 'KeyD', 'ArrowRight')),
    };
  }
  dispose() {
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);this.releaseTouchSurface?.();this.releaseTouchSurface=undefined;this.clear();this.buttons.clear();
  }
}

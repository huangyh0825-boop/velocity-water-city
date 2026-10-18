import type {FollowCamera} from '../camera/FollowCamera';
import './camera-controls.css';
type LookMode='idle'|'locked'|'window';
/** Click once, then move without holding a button. Relative Pointer Lock is primary;
 * embedded browsers that deny capture get an explicit, window-bounded fallback. */
export class CameraControls {
 enabled=true;sensitivity=1;private mode:LookMode='idle';private disposed=false;private request=0;private timer?:ReturnType<typeof setTimeout>;
 private last?:{x:number;y:number};private ui:HTMLElement;private status:HTMLElement;private enter:HTMLButtonElement;
 constructor(private canvas:HTMLCanvasElement,private camera:FollowCamera,root:HTMLElement,private clearDriving:()=>void){
  this.ui=document.createElement('div');this.ui.className='camera-controls';this.ui.innerHTML=`<label><input type="checkbox" checked aria-label="启用鼠标自由视角">鼠标视角</label><label>灵敏度 <input type="range" min="25" max="200" value="100" aria-label="鼠标视角灵敏度"></label><button type="button" class="camera-enter">进入鼠标视角</button><button type="button" class="camera-reset">恢复视角 C</button><small aria-live="polite"></small>`;root.append(this.ui);this.status=this.ui.querySelector('small')!;this.enter=this.ui.querySelector('.camera-enter')!;
  this.ui.querySelector<HTMLInputElement>('[type=checkbox]')!.onchange=e=>{this.enabled=(e.target as HTMLInputElement).checked;if(!this.enabled){this.release();camera.restore();}this.paint();};
  this.ui.querySelector<HTMLInputElement>('[type=range]')!.oninput=e=>this.sensitivity=Number((e.target as HTMLInputElement).value)/100;
  this.ui.querySelector<HTMLButtonElement>('.camera-reset')!.onclick=()=>camera.restore();this.enter.onclick=()=>this.mode==='idle'?void this.capture():this.release();
  canvas.addEventListener('click',this.click);window.addEventListener('mousemove',this.move);window.addEventListener('pointermove',this.windowMove);canvas.addEventListener('pointerleave',this.leave);canvas.addEventListener('contextmenu',this.context);canvas.addEventListener('wheel',this.wheel,{passive:false});window.addEventListener('keydown',this.key);window.addEventListener('blur',this.blur);document.addEventListener('visibilitychange',this.visibility);document.addEventListener('pointerlockchange',this.lockChange);document.addEventListener('pointerlockerror',this.lockError);this.paint();
 }
 private capable(){return this.enabled&&!matchMedia('(pointer: coarse)').matches;}
 private click=(e:MouseEvent)=>{if(e.button===0&&this.mode==='idle')void this.capture();};
 private async capture(){
  if(!this.capable()||this.disposed)return;const id=++this.request;this.last=undefined;
  if(!this.canvas.requestPointerLock){this.useWindow();return;}
  // Older implementations return void, or never report a rejected request.
  this.timer=setTimeout(()=>{if(id===this.request&&document.pointerLockElement!==this.canvas)this.useWindow();},1200);
  try{await this.canvas.requestPointerLock();if(id===this.request&&document.pointerLockElement===this.canvas)this.lockChange();}
  catch{if(id===this.request)this.useWindow();}
 }
 private useWindow(){if(this.disposed||!this.capable())return;clearTimeout(this.timer);this.timer=undefined;this.mode='window';this.last=undefined;this.camera.engage();this.paint();}
 private move=(e:MouseEvent)=>{if(this.capable()&&document.pointerLockElement===this.canvas)this.camera.orbit(e.movementX,e.movementY,this.sensitivity);};
 private windowMove=(e:PointerEvent)=>{
  if(!this.capable()||this.mode!=='window'||document.pointerLockElement===this.canvas)return;
  // Passive HUD text can cover much of a narrow preview window. It is still
  // game space; only interactive controls should suspend compatible mouse look.
  const target=e.target;if(!(target instanceof Element)||!this.canvas.parentElement?.contains(target)||target.closest('button,input,select,textarea,a,.camera-controls,.audio-controls,.touch')){this.last=undefined;return;}
  const old=this.last;this.last={x:e.clientX,y:e.clientY};if(old)this.camera.orbit(e.clientX-old.x,e.clientY-old.y,this.sensitivity);
 };
 private leave=()=>{this.last=undefined;};
 private context=(e:MouseEvent)=>{if(this.capable()&&this.mode!=='idle')e.preventDefault();};
 private wheel=(e:WheelEvent)=>{if(!this.capable())return;e.preventDefault();this.camera.wheel(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?window.innerHeight:1));};
 private key=(e:KeyboardEvent)=>{if(e.code==='Escape'){this.release();return;}if(e.target instanceof HTMLElement&&e.target.matches('input,textarea,select'))return;if(e.code==='KeyC'&&this.capable()){e.preventDefault();this.camera.restore();}};
 private lockChange=()=>{if(this.disposed)return;if(document.pointerLockElement===this.canvas){clearTimeout(this.timer);this.timer=undefined;this.mode='locked';this.last=undefined;this.camera.engage();this.paint();}else if(this.mode==='locked'){this.mode='idle';this.last=undefined;this.clearDriving();this.paint();}};
 private lockError=()=>{if(this.timer){clearTimeout(this.timer);this.timer=undefined;this.useWindow();}};
 private blur=()=>this.release();private visibility=()=>{if(document.hidden)this.release();};
 private paint(){this.canvas.dataset.mouseLook=this.mode;this.ui.dataset.mode=this.mode;this.enter.textContent=this.mode==='idle'?'进入鼠标视角':'退出鼠标视角 Esc';this.status.textContent=!this.enabled?'鼠标观察已关闭 · 经典跟随':this.mode==='locked'?'自由观察已开启 · 直接移动鼠标，无需按键 · Esc 退出':this.mode==='window'?'兼容观察已开启 · 直接移动，无需按键 · Esc 退出（窗口边缘受限）':'点击画面进入自由观察 · 无需按住鼠标 · C 归位';}
 release(){++this.request;clearTimeout(this.timer);this.timer=undefined;this.mode='idle';this.last=undefined;if(document.pointerLockElement===this.canvas)document.exitPointerLock();this.clearDriving();this.paint();}
 dispose(){this.release();this.disposed=true;this.ui.remove();this.canvas.removeEventListener('click',this.click);window.removeEventListener('mousemove',this.move);window.removeEventListener('pointermove',this.windowMove);this.canvas.removeEventListener('pointerleave',this.leave);this.canvas.removeEventListener('contextmenu',this.context);this.canvas.removeEventListener('wheel',this.wheel);window.removeEventListener('keydown',this.key);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);document.removeEventListener('pointerlockchange',this.lockChange);document.removeEventListener('pointerlockerror',this.lockError);}
}

import type {FollowCamera} from '../camera/FollowCamera';
import './camera-controls.css';
/** Pointer capture belongs only to the canvas; HUD remains ordinary DOM. */
export class CameraControls {
 enabled=true;sensitivity=1;private dragging=false;private fallback=false;private disposed=false;private dragX=0;private dragY=0;
 private ui:HTMLElement;private status:HTMLElement;
 constructor(private canvas:HTMLCanvasElement,private camera:FollowCamera,root:HTMLElement,private clearDriving:()=>void){
  this.ui=document.createElement('div');this.ui.className='camera-controls';this.ui.innerHTML=`<label><input type="checkbox" checked aria-label="启用鼠标自由视角">鼠标视角</label><label>灵敏度 <input type="range" min="25" max="200" value="100" aria-label="鼠标视角灵敏度"></label><button type="button">恢复视角 C</button><small>点击画面观察 · Esc 释放 · 滚轮远近</small>`;root.append(this.ui);this.status=this.ui.querySelector('small')!;
  this.ui.querySelector<HTMLInputElement>('[type=checkbox]')!.onchange=e=>{this.enabled=(e.target as HTMLInputElement).checked;if(!this.enabled){this.release();camera.restore();}};
  this.ui.querySelector<HTMLInputElement>('[type=range]')!.oninput=e=>this.sensitivity=Number((e.target as HTMLInputElement).value)/100;
  this.ui.querySelector('button')!.onclick=()=>camera.restore();
  canvas.addEventListener('click',this.click);canvas.addEventListener('pointerdown',this.down);window.addEventListener('pointerup',this.up);window.addEventListener('pointermove',this.dragMove);window.addEventListener('mousemove',this.move);canvas.addEventListener('contextmenu',this.context);canvas.addEventListener('wheel',this.wheel,{passive:false});window.addEventListener('keydown',this.key);window.addEventListener('blur',this.blur);document.addEventListener('pointerlockchange',this.lockChange);document.addEventListener('pointerlockerror',this.lockError);
 }
 private capable(){return this.enabled&&!matchMedia('(pointer: coarse)').matches;}
 private click=async(e:MouseEvent)=>{if(e.button!==0||!this.capable())return;if(!this.canvas.requestPointerLock){this.lockError();return;}try{await this.canvas.requestPointerLock();}catch{this.lockError();}};
 private down=(e:PointerEvent)=>{if(e.button===2&&this.capable()){e.preventDefault();this.dragging=true;this.dragX=e.clientX;this.dragY=e.clientY;this.canvas.setPointerCapture(e.pointerId);this.camera.engage();}};
 private up=()=>{this.dragging=false;};
 private move=(e:MouseEvent)=>{if(this.capable()&&document.pointerLockElement===this.canvas)this.camera.orbit(e.movementX,e.movementY,this.sensitivity);};
 // Cancelled pointerdown suppresses compatibility mousemove in Chromium. Use
 // pointermove for drag fallback, and mousemove only for Pointer Lock deltas.
 private dragMove=(e:PointerEvent)=>{if(this.capable()&&this.dragging&&document.pointerLockElement!==this.canvas){this.camera.orbit(e.clientX-this.dragX,e.clientY-this.dragY,this.sensitivity);this.dragX=e.clientX;this.dragY=e.clientY;}};
 private context=(e:MouseEvent)=>{if(this.capable())e.preventDefault();};
 private wheel=(e:WheelEvent)=>{if(!this.capable())return;e.preventDefault();this.camera.wheel(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?window.innerHeight:1));};
 private key=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&e.target.matches('input,textarea,select'))return;if(e.code==='KeyC'&&this.capable()){e.preventDefault();this.camera.restore();}if(e.code==='Escape')this.release();};
 private lockChange=()=>{if(this.disposed)return;const locked=document.pointerLockElement===this.canvas;if(locked){this.fallback=false;this.camera.engage();}else{this.dragging=false;this.clearDriving();}this.status.textContent=locked?'鼠标已捕获 · Esc 释放 · C 归位':this.fallback?'未捕获鼠标 · 按住右键拖动观察':'点击画面观察 · Esc 释放 · 滚轮远近';};
 private lockError=()=>{this.fallback=true;this.status.textContent='未捕获鼠标 · 按住右键拖动观察';};
 private blur=()=>{this.dragging=false;this.release();};
 release(){this.dragging=false;if(document.pointerLockElement===this.canvas)document.exitPointerLock();}
 dispose(){this.disposed=true;this.release();this.ui.remove();this.canvas.removeEventListener('click',this.click);this.canvas.removeEventListener('pointerdown',this.down);window.removeEventListener('pointerup',this.up);window.removeEventListener('pointermove',this.dragMove);window.removeEventListener('mousemove',this.move);this.canvas.removeEventListener('contextmenu',this.context);this.canvas.removeEventListener('wheel',this.wheel);window.removeEventListener('keydown',this.key);window.removeEventListener('blur',this.blur);document.removeEventListener('pointerlockchange',this.lockChange);document.removeEventListener('pointerlockerror',this.lockError);}
}

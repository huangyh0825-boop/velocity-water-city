import type {InputController} from '../controls/InputController';
import './touch-controls.css';

const icon=(paths:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
const icons={
 left:icon('<path class="turn-trail" d="m20 5-7 7 7 7"/><path class="turn-arrow" d="m12 3-9 9 9 9v-6h7V9h-7Z"/>'),
 right:icon('<path class="turn-trail" d="m4 5 7 7-7 7"/><path class="turn-arrow" d="m12 3 9 9-9 9v-6H5V9h7Z"/>'),
 brake:icon('<path d="m7 4 9-1 3 14-9 2L7 4Z"/><path d="m10 7 4-.5m-3.5 4 4-.5m-3 4 4-.5M13 19l1 3h6"/>'),
 trick:icon('<path d="M5 8a8 8 0 1 1-1 7M5 3v5h5"/>'),
 nitro:icon('<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>'),
 settings:icon('<path d="M4 6h16M4 12h16M4 18h16"/>')
};
export const TOUCH_CONTROLS=`<div class="touch mobile-steering" aria-label="转向控制"><button data-action="left" aria-label="左转">${icons.left}</button><button data-action="right" aria-label="右转">${icons.right}</button></div>
 <div class="touch mobile-actions" aria-label="减速与技能"><button data-action="brake" aria-label="减速" class="mobile-brake">${icons.brake}<span>减速</span></button><span class="mobile-drive-note">自动加速<br>按住减速</span><button data-action="trick" aria-label="空中特技" class="mobile-trick" disabled>${icons.trick}<span>腾空特技</span></button><button data-action="nitro" aria-label="氮气加速" class="mobile-nitro">${icons.nitro}<span>氮气</span><small id="touch-nitro-level">40%</small></button></div>
 <button class="mobile-settings" id="mobile-settings" type="button" aria-label="打开游戏设置" aria-expanded="false" aria-controls="mobile-settings-shade">${icons.settings}</button><button id="mobile-settings-shade" class="mobile-settings-shade" type="button" aria-label="关闭游戏设置" hidden></button>`;

/** Changes DOM only when availability or the integer energy level changes. */
export class TouchControls {
 private buttons:HTMLButtonElement[];
 private settings:HTMLButtonElement;
 private shade:HTMLButtonElement;
 private level:HTMLElement;
 private menu=false;private mask=-1;private percent=-1;
 constructor(private root:HTMLElement,private input:InputController){
  root.dataset.touchMenu='false';root.dataset.touchFinished='false';
  input.bindTouchSurface(root);
  this.buttons=Array.from(root.querySelectorAll<HTMLButtonElement>('[data-action]'));for(const b of this.buttons)input.bindButton(b,b.dataset.action!);
  this.settings=root.querySelector('#mobile-settings')!;this.shade=root.querySelector('#mobile-settings-shade')!;this.level=root.querySelector('#touch-nitro-level')!;
  this.settings.onclick=()=>this.setMenu(!this.menu);this.shade.onclick=()=>this.setMenu(false);
  root.querySelector('#recover')?.addEventListener('click',()=>this.setMenu(false));root.querySelector('#reset')?.addEventListener('click',()=>this.setMenu(false));
 }
 private setMenu(open:boolean){this.menu=open;this.root.dataset.touchMenu=String(open);this.settings.setAttribute('aria-expanded',String(open));this.settings.setAttribute('aria-label',open?'关闭游戏设置':'打开游戏设置');this.shade.hidden=!open;this.input.setTouchEnabled(!open);this.mask=-1;}
 update(racing:boolean,canTrick:boolean,energy:number,finished:boolean){
  if(!this.input.touchMode)return;if(finished&&this.menu)this.setMenu(false);
  const drive=racing&&!this.menu,mask=Number(drive)|Number(drive&&canTrick)<<1|Number(drive&&energy>0)<<2|Number(finished)<<3;
  if(mask!==this.mask){this.mask=mask;this.root.dataset.touchFinished=String(finished);for(const button of this.buttons){const action=button.dataset.action!,enabled=action==='trick'?!!(mask&2):action==='nitro'?!!(mask&4):!!(mask&1);if(button.disabled!==!enabled){button.disabled=!enabled;if(!enabled)this.input.releaseAction(action);}}}
  const percent=Math.ceil(energy);if(percent!==this.percent){this.percent=percent;this.level.textContent=percent+'%';}
 }
}

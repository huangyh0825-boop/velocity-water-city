import {BOOT_TASKS,BootProgress,type BootTask} from '../core/BootProgress';
import './loading.css';
export class LoadingScreen {
 readonly progress=new BootProgress();
 private panel:HTMLElement;private stage:HTMLElement;private fill:HTMLElement;private label:HTMLElement;
 constructor(root:HTMLElement){
  this.panel=document.createElement('section');this.panel.className='boot-screen';this.panel.setAttribute('aria-label','游戏加载');
  this.panel.innerHTML=`<div class="boot-art" aria-hidden="true"></div><div class="boot-card"><small>AURORA RACEWAY / SYSTEM START</small><h1>极速水城<span>未来竞速</span></h1><p class="boot-english">VELOCITY / WATER CITY</p><div class="boot-stage" aria-live="polite">初始化竞速系统</div><div class="boot-track" role="progressbar" aria-label="已完成的启动任务" aria-valuemin="0" aria-valuemax="100"><i></i></div><div class="boot-progress">0% · 0 / 9 项任务</div><p class="boot-tip">正在准备完整城市与五名选手。首次启动需要解码高质量资源。<br>WASD 驾驶 · Shift 氮气 · 空格 特技 · 鼠标观察 · C 恢复镜头</p><button type="button" hidden>重新加载资源</button></div>`;
  root.append(this.panel);this.stage=this.panel.querySelector('.boot-stage')!;this.fill=this.panel.querySelector('.boot-track i')!;this.label=this.panel.querySelector('.boot-progress')!;
  this.panel.querySelector('button')!.onclick=()=>location.reload();
 }
 begin(task:BootTask){this.stage.textContent=BOOT_TASKS.find(t=>t[0]===task)![1];this.panel.dataset.stage=task;}
 complete(task:BootTask){this.progress.complete(task);this.fill.style.width=`${this.progress.percent}%`;this.fill.parentElement!.setAttribute('aria-valuenow',String(this.progress.percent));this.label.textContent=`${this.progress.percent}% · ${this.progress.completed.size} / ${BOOT_TASKS.length} 项任务`;}
 fail(error:unknown){this.panel.classList.add('boot-failed');this.stage.textContent='启动未完成';this.label.textContent=String(error instanceof Error?error.message:error);this.panel.querySelector<HTMLButtonElement>('button')!.hidden=false;}
 finish(){this.panel.remove();}
}

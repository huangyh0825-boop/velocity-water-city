import './tutorial.css';

const KEY='velocity-water-city:tutorial:v1';
let seenThisSession=false;
function hasSeen(){try{return seenThisSession||localStorage.getItem(KEY)==='seen';}catch{return seenThisSession;}}
function remember(){seenThisSession=true;try{localStorage.setItem(KEY,'seen');}catch{/* Still usable when browser storage is blocked. */}}
const boat='<path d="M-9 13Q-13-5 0-23Q13-5 9 13L0 20Z" fill="#e7fafa" stroke="#8bdad9" stroke-width="2"/><path d="M-5 8V-7L0-15L5-7V8L0 13Z" fill="#397cd9"/>';
const art=(content:string)=>`<svg viewBox="0 0 240 140" aria-hidden="true"><path d="M0 104Q60 92 120 104T240 104M0 119Q60 107 120 119T240 119" fill="none" stroke="#76d9df" stroke-opacity=".22" stroke-width="2"/>${content}</svg>`;
const panels=[
 {title:'加速冲上跳台',key:'W 加速 · A / D 转向',text:'沿水道找到斜坡，保持速度，正对跳台冲上去。',image:art(`<path d="M100 98 192 54 210 98Z" fill="#476c81" stroke="#b3e6ec" stroke-width="2"/><path d="m146 78 18-9m-8 1 8-1-3 8" fill="none" stroke="#b3ffda" stroke-width="3"/><g transform="translate(66 87) rotate(65)">${boat}</g><path d="M13 98h27M17 90h19" stroke="#8ce9df" stroke-width="3"/>`)},
 {title:'腾空后做特技',key:'空格 按一次',text:'离开跳台腾空后，尽早按空格，留足时间完成翻转。',image:art(`<path d="M24 95Q112-12 205 87" fill="none" stroke="#92cbdc" stroke-width="2" stroke-dasharray="5 6"/><g transform="translate(121 52) rotate(58)">${boat}</g><path d="M96 37a31 31 0 1 1 48 35m0-12v12h12" fill="none" stroke="#b6a6ff" stroke-width="3"/>`)},
 {title:'安全落水，补充氮气',key:'特技成功 +35%',text:'完成特技并安全落回水道，氮气槽就会增加。',image:art(`<g transform="translate(96 72) rotate(65)">${boat}</g><path d="m66 93-15-10m77 9 15-13M83 100l-5 12m37-12 5 12" stroke="#9be9ed" stroke-width="3"/><rect x="43" y="19" width="154" height="12" rx="6" fill="#244957"/><rect x="43" y="19" width="109" height="12" rx="6" fill="#b2f4d8"/><path d="m170 45 5 5 10-12" fill="none" stroke="#b2f4d8" stroke-width="3"/>`)},
 {title:'释放氮气，超越对手',key:'按住 左Shift',text:'有氮气时按住左Shift加速；用完后，再找跳台补充。',image:art(`<path d="M24 56h51M13 71h56M31 86h47" stroke="#7bc8f6" stroke-width="4" stroke-linecap="round"/><g transform="translate(130 69) rotate(90)">${boat}<path d="m-6 18 6 35 6-35" fill="#8bebff"/></g><path d="m175 54 17 15-17 15m25-30 17 15-17 15" fill="none" stroke="#b2f4d8" stroke-width="4"/>`)}
];

/** Home-only overlay: no renderer resources, input handlers or per-frame work. */
export class DrivingTutorial {
 private dialog:HTMLDialogElement;
 constructor(root:HTMLElement){
  this.dialog=document.createElement('dialog');this.dialog.className='driving-tutorial';this.dialog.id='driving-tutorial';this.dialog.setAttribute('aria-labelledby','tutorial-title');
  this.dialog.innerHTML=`<div class="tutorial-heading"><div><small>30 秒 · 上手水城</small><h2 id="tutorial-title">想跑得快，先学会飞。</h2></div><button type="button" class="tutorial-close" aria-label="关闭玩法教程">×</button></div><p class="tutorial-intro">核心玩法：冲跳台 → 空中特技 → 安全落水获得氮气 → 氮气加速</p><ol class="tutorial-panels">${panels.map((p,i)=>`<li><div class="tutorial-art"><span>0${i+1}</span>${p.image}</div><h3>${p.title}</h3><strong>${p.key}</strong><p>${p.text}</p></li>`).join('')}</ol><p class="tutorial-touch">手机玩家：用屏幕上的「加速」「转向」「特技」「氮气」按钮完成同样的操作。<br>先在单人训练熟悉跳台；普通腾空不奖励氮气，特技未完成就落水会短暂减速。</p><button class="primary-button tutorial-done" type="button">明白了，准备出发 <span>→</span></button><p class="tutorial-footer">首页「玩法教程」随时重看 · 单人和多人玩法相同</p>`;
  root.append(this.dialog);
  const dismiss=()=>{remember();this.dialog.close();};
  this.dialog.querySelector<HTMLButtonElement>('.tutorial-close')!.onclick=dismiss;this.dialog.querySelector<HTMLButtonElement>('.tutorial-done')!.onclick=dismiss;
  this.dialog.addEventListener('cancel',()=>remember());
 }
 showIfNeeded(){if(!hasSeen())this.open();}
 open(){if(!this.dialog.open)this.dialog.showModal();}
 dispose(){if(this.dialog.open)this.dialog.close();this.dialog.remove();}
}

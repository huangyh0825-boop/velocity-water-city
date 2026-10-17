import {mkdirSync,writeFileSync} from 'node:fs';
import {CityTrack} from '../../src/track/CityTrack';
const track=new CityTrack(),tau=Math.PI*2,folder='docs/vertical-track';mkdirSync(folder,{recursive:true});
const sx=(x:number)=>80+(x+480)*.67,sy=(z:number)=>70+(z+720)*.67;
const path=(points:readonly {x:number;z:number}[])=>points.map((p,i)=>`${i?'L':'M'}${sx(p.x).toFixed(1)},${sy(p.z).toFixed(1)}`).join(' ');
const section=(a:number,b:number)=>Array.from({length:Math.ceil((b-a)*1000)+1},(_,i,)=>track.point((a+(b-a)*i/Math.ceil((b-a)*1000))*tau));
const marks=[['J1',.28,'普通跳台 · +2m'],['D1',.354,'16m溢流落差 · 大型自然腾空'],['J2',.41,'中型跳台 · +4.2m'],['D2',.728,'8m凸坡顶 · 速度决定离水'],['J3',.876,'冲刺前普通跳台 · +2m']] as const;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1700" height="1200" viewBox="0 0 1700 1200"><rect width="1700" height="1200" fill="#101f2c"/><style>text{font-family:'Microsoft YaHei',sans-serif;fill:#e0f4ff;font-size:17px}.small{font-size:13px}.title{font-size:28px;font-weight:bold}</style><text x="40" y="38" class="title">极速水城 · 立体赛道前置规划 V1</text><text x="40" y="65">主线平面路线保持 · 水平长度约4745m · 高程相对普通静水0m · 2026-10-17</text><path d="${path(track.samples)}" fill="none" stroke="#456275" stroke-width="30"/><path d="${path(track.samples)}" fill="none" stroke="#80d6ee" stroke-width="7"/>`;
for(const [a,b,color]of [[.30,.354,'#ffc45f'],[.69,.738,'#ffc45f']] as const)svg+=`<path d="${path(section(a,b))}" fill="none" stroke="${color}" stroke-width="15"/>`;
for(let i=0;i<24;i++){const p=track.point(i/24*tau);svg+=`<circle cx="${sx(p.x)}" cy="${sy(p.z)}" r="${i%4?4:8}" fill="#fff"/><text class="small" x="${sx(p.x)+9}" y="${sy(p.z)-7}">${i===0?'START / CP0':`CP${i}`}</text>`;}
for(const [n,s]of track.shortcuts.entries()){
 const color=n?'#cc9dff':'#6cffe2';svg+=`<path d="${path(s.samples)}" fill="none" stroke="${color}" stroke-width="6" stroke-dasharray="11 5"/>`;
 for(const [which,p]of [['IN',s.samples[0]],['OUT',s.samples.at(-1)!]] as const)svg+=`<rect x="${sx(p.x)-8}" y="${sy(p.z)-8}" width="16" height="16" fill="${color}"/><text x="${sx(p.x)+12}" y="${sy(p.z)+18}">S${n+1} ${which}</text>`;
}
for(const [id,t]of marks){const p=track.point(t*tau);svg+=`<circle cx="${sx(p.x)}" cy="${sy(p.z)}" r="17" fill="#b6532e" stroke="#ffc45f"/><text text-anchor="middle" x="${sx(p.x)}" y="${sy(p.z)+6}">${id}</text>`;}
const cut=track.shortcuts[1],p=cut.samples[Math.round(128*.4)];svg+=`<circle cx="${sx(p.x)}" cy="${sy(p.z)}" r="17" fill="#754fb2"/><text text-anchor="middle" x="${sx(p.x)}" y="${sy(p.z)+6}">S2J</text>`;
const lines=['规划图例 / 设计自查','蓝线：0m普通主水道，24个顺序检查点','金线：人工起伏/高架槽，非倾斜静水','青虚线 S1：城市结构下穿隧道，0m','紫虚线 S2：独立高架捷径，0→14→0m','','六处有效起跳机会',...marks.map(([id,t,label])=>`${id}  ${(t*100).toFixed(1)}%圈程：${label}`),'S2J  捷径约40%：14m高架跳跃','','A区 30.0%–35.4%：0→12→16m','末段上扬溢流槽，脱离真实承托后弹道下落','落地走廊35.4%–38.4%，之后留恢复直道','J2移至41.0%，避免紧接大落差再跳','','B区 69.0%–73.8%：0→8→0m','连续凸坡；低速贴坡，高速自然离水','平缓港湾及最终直道保留','','S1 IN 48% / OUT 60%：主线CP12–14','隧道CP与主线共用顺序ID，入口合法激活','增加轻微S线、窄护栏、独立出口汇流','','S2 IN 65% / OUT 86%：主线CP16–20','窄上坡→高架→断水槽飞跃→安全落水区','入口分叉、落地区、出口均单独标识','','布局自查：','• 不改变发车/城市样板区平面中心线','• A区避开29%桥；落地早于40%桥','• 两个高差区相隔约1.6km，不连续堆跳','• D1至J2约266m，先落地再进入下次助跑','• 落地与计分使用同一实际高度/合法路线','• 恢复位置在最后已验证检查点的安全承托面','• 高架与低水道按真实高度区分碰撞','• 仅增加必要水槽/支撑，不扩建城市'];
lines.forEach((line,i)=>svg+=`<text x="1080" y="${105+i*25}"${i===0?' class="title"':''}>${line.replaceAll('&','&amp;').replaceAll('<','&lt;')}</text>`);
svg+='<text x="70" y="1130">↑ 北 / -Z　　J = 传统跳台　D = 自然离水　S = 合法分支捷径　高度单位：米</text></svg>';
writeFileSync(`${folder}/plan.svg`,svg);
console.log('Wrote docs/vertical-track/plan.svg before track implementation');

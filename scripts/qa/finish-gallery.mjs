import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const out='docs/final-finish';await mkdir(`${out}/images`,{recursive:true});
const shots=[
 ['boat-left-front-45','快艇','左前 45° 近景','主壳、分件与清漆层；原高模与 UV 保留。'],['boat-right-rear-45','快艇','右后 45° 近景','推进口分层、紧固件、脚踏与尾部发光环。'],['driving-third-person','快艇','实际驾驶跟随视角','真实跟随镜头与竞速 HUD，没有固定相机替代。'],
 ['rider-riding','车手','骑乘近景','面罩透光、头盔铰链、织物与护甲的反光区分。'],['rider-side','车手','骑乘侧面','原骨骼与握把接触保持，新增细节使用原骨骼。'],['rider-turning','车手','转弯姿态','实际转向输入下的车手倾身和接触状态。'],
 ['water-cruise','水面与特效','平稳行驶','保留完整波浪、法线与实时反射。'],['wake-high-speed','水面与特效','高速尾浪','固定采样预算内保留可见尾浪；破碎泡沫边缘保留水色。'],['turn-spray','水面与特效','转弯水花','水滴随速度方向拉长，外侧水花加强。'],['jump-airborne','水面与特效','真实跳台腾空','沿原跳台驶入，使用原腾空与特技逻辑。'],['jump-landing','水面与特效','落水冲击','真实接触后的压力环、短暂水冠与分层水滴。'],['nitro','水面与特效','氮气加速','流动外喷流与亮芯同一绘制组，使用原加速数值。'],
 ['district-cbd','城市环境','中央商务区','近景幕墙、街区公共空间与远处天际线。'],['district-tech','城市环境','未来科技区','冷白与冰蓝的街区色材，保留原建筑覆盖。'],['district-harbor','城市环境','港湾区','海绿色材与原港口设施，维护柜补充装配细节。'],['district-leisure','城市环境','滨水休闲区','暖白、绿化与公共设施，种植原型补充叶片层次。'],['district-elevated','城市环境','高架水道','原高差、支撑与边界保持，水面/天空/建筑共用一致日光方向。'],
 ['hud-racing','界面','比赛 HUD','统一深海色面板、冰蓝标签、薄荷青强调与清晰数字。'],['trick-feedback','界面','特技成功反馈','真实特技奖励的成功标记，不伪造分数。'],['menu-home','界面','首页','菜单、输入框、按钮与比赛界面统一。'],['loading','界面','加载界面','沿用真实启动进度与资源重试，统一颜色和边框。']
];
const compress=`from PIL import Image
from pathlib import Path
out=Path('docs/final-finish/images')
for group in ['after','before']:
 for source in Path('work/final-finish',group).glob('*.png'):
  if group=='before' and source.stem not in ['boat-front-left','rider-riding','nitro','hud-racing','district-tech']: continue
  Image.open(source).convert('RGB').save(out/(group+'-'+source.stem+'.jpg'),quality=92,subsampling=0,optimize=True)
`;
execFileSync('C:/Users/17033/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-c',compress]);
const perf=JSON.parse(await readFile('work/final-finish/performance.json','utf8')),capture=JSON.parse(await readFile('work/final-finish/after/capture-report.json','utf8')),before=JSON.parse(await readFile('work/final-finish/before/capture-report.json','utf8'));
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
const sceneNames={'city-separated':'普通驾驶','city-five':'商务区五艇','elevated-five':'高架五艇','nitro-five':'氮气五艇'};
const performance=Object.entries(sceneNames).map(([id,name])=>{const values=label=>perf.results.filter(v=>v.label===label&&v.scenario===id),b=values('before'),a=values('after');return{name,before:1000/avg(b.map(v=>v.frameMs)),after:1000/avg(a.map(v=>v.frameMs)),gpuBefore:avg(b.map(v=>v.gpuMs)),gpuAfter:avg(a.map(v=>v.gpuMs)),callsBefore:avg(b.map(v=>v.calls)),callsAfter:avg(a.map(v=>v.calls))};});
const summary={baseline:'b2daa088c06bb9451203ec9e08f18ef631d1b1b0',performanceStatus:'inconclusive-system-memory-pressure',quality:'Desktop standard, 1600x1000 DPR1, RTX 4060 Laptop / Edge',geometryBefore:before.asset.nodes.reduce((s,v)=>s+v.count,0),geometryAfter:capture.asset.nodes.reduce((s,v)=>s+v.count,0),performance,shots:shots.map(([id,category,title])=>({id,category,title}))};
await writeFile(`${out}/summary.json`,JSON.stringify(summary,null,2));for(const file of['performance.json','after/capture-report.json','full-race/full-drive.json','mobile/browser.json','online/result.json'])await copyFile(`work/final-finish/${file}`,`${out}/${file.split('/').at(-1)}`);
const cards=shots.map(([id,category,title,note],i)=>`<button class="shot" data-category="${category}" data-id="${id}" data-title="${title}" data-note="${note}"><img loading="lazy" src="images/after-${id}.jpg" alt="${title}"><span class="meta">${String(i+1).padStart(2,'0')} / ${category}</span><h3>${title}</h3><p>${note}</p></button>`).join('');
const tables=performance.map(v=>`<tr><td>${v.name}</td><td>${v.before.toFixed(1)}</td><td>${v.after.toFixed(1)}</td><td>${((v.after/v.before-1)*100).toFixed(1)}%</td><td>${v.gpuBefore.toFixed(2)} → ${v.gpuAfter.toFixed(2)}</td></tr>`).join('');
for(const file of['performance-first.json','performance-variance.json','performance-extended-variance.json','system-memory.json'])await copyFile(`work/final-finish/${file}`,`${out}/${file}`);
const markdown=`# 极速水城：最终质感精修验收

本轮视觉改动已在本机就绪，等待用户验收。**性能稳定性尚未通过最终验收。** **没有推送或部署 GitHub，也没有修改公网服务器。**

[打开交互图集](index.html) · [审查记录](AUDIT.md) · [最终性能原始数据](performance.json)

## 本轮具体改变

| 内容 | 实际精修 | 保留的基础 |
|---|---|---|
| 快艇模型 | 原材质组内补充脚踏紧固件、推进口分层/紧固件与发光细环、仪表边框 | 原船头/壳体曲面高模、座椅、握把、UV、物理尺寸和插槽 |
| 车手模型 | 头盔铰链与贴合壳体的后通风细节；极轻微静止呼吸 | 原成人比例、骨骼、握把 IK、骑姿、转弯与空中特技 |
| 材质 | 船漆清漆层、陶瓷白壳、拉丝金属、橡胶/座垫、织物、皮肤与面罩分别调整 | 原所有贴图、法线/粗糙度/金属图、UV 与房间分配颜色 |
| 水与特效 | 方向水滴、外侧转弯水花、落水压力环/短暂水冠、分层落水粒子、破碎 V 形尾浪、流动氮气亮芯与外喷流 | 原水波/法线/反射、粒子容量、速度、跳台、氮气消耗与奖励数值 |
| 建筑环境 | 六个街区统一而略有差异的色材；共享花箱叶片与维护柜把手、脚垫和紧固细节 | 原建筑覆盖、位置、楼数、LOD、观众、绿化及可行驶空间 |
| 光照 | 水面、天空与城市采用一致太阳方向；直射/环境填光/曝光平衡 | 原阴影分辨率、反射预算，没有增加全屏 Bloom、景深或运动模糊 |
| UI | 首页/加载/比赛面板统一；数字、边框、按钮、氮气强调、特技成功标记与排名变化提示 | 原按键、信息、七种触控布局和防误缩放逻辑 |

最明显的完成品感来自：近景面罩/仪表与船漆材质区分、推进口细节、流动喷流及整套 HUD 的统一。本轮没有把已有高模重新做一遍，也没有以堆楼数或更换玩法冒充视觉精修。

## 验收截图

全部为真实游戏画面。PNG 原图保留在本机 work/final-finish/after，下面为保持原尺寸的 JPEG 验收副本。近景与环境图使用验收机位；驾驶跟随图使用游戏实际镜头。

${shots.map(([id,category,title,note])=>`- [${category} / ${title}](images/after-${id}.jpg)：${note}`).join('\n')}

## 验证结果

- 248 项 Node 功能/资源/物理/多人协议测试通过；随后最新特效变更的相关测试与类型检查再次通过。
- 13 项 Cloudflare Workers 测试与前后端类型检查通过。
- 真实 Game.frame 完整三圈：玩家与四 AI 都完成 72 个检查点、进入完赛；两条捷径均经过。[回放数据](full-drive.json)
- 手机七种尺寸下控制键、菜单及提示无重叠；真实双指输入取消默认手势且按键仍有效；回到首页恢复原手势策略。[结果](browser.json) 原生手机缩放没有拿模拟器结果冒充真机验证。
- 截图阶段没有浏览器运行错误；实际跳台起跳、落水、特技奖励和氮气加速均由原游戏逻辑触发。[截图状态数据](capture-report.json)
- 本地双客户端检查通过：房主及全员准备、慢客户端阻止提前倒计时、全员加载后同步五秒、实际行驶广播、断线恢复、一分钟无发送限流断连与返回首页。[联机结果](result.json)\n- 本机生产构建通过。体积提示是既有 Three.js 分块提示，不是构建失败。

## 性能与实现预算

RTX 4060 Laptop / Edge，1600×1000 DPR1、桌面标准画质。最终一组每轮独立启动/关闭 Edge，采用 ABBA 顺序、180 帧预热、240 帧测量；全帧统计包含主画面、反射和局部阴影，GPU 为非 disjoint 计时查询。下表是每版本两次测量的平均帧时间换算结果，不能等同所有设备表现。

| 场景 | 原版 FPS | 新版 FPS | 变化 | GPU 毫秒 原→新 |
|---|---:|---:|---:|---:|
${performance.map(v=>`| ${v.name} | ${v.before.toFixed(1)} | ${v.after.toFixed(1)} | ${((v.after/v.before-1)*100).toFixed(1)}% | ${v.gpuBefore.toFixed(2)} → ${v.gpuAfter.toFixed(2)} |`).join('\n')}

**性能稳定性未验收通过。测量限制：** 首轮密集五艇场景约 36–38 FPS，修改前后差异约 2%；后续重复测量出现明显波动，原版也出现 21–52 FPS 的轮次。因此不将某轮高帧率当作确定优化收益，不承诺所有场景帧率完全不变。[首轮记录](performance-first.json) · [波动轮次记录](performance-variance.json)。最终重复测试期间，系统可用内存一度只有约 15–60 MB，原版和新版都出现长帧。当前不能将波动单独归因于视觉改动，也不能据此承诺性能持平。[系统内存记录](system-memory.json) · [延长预热的波动记录](performance-extended-variance.json)。五艇高精度模型同屏仍然是主要重负载。

- 保留 320 水面网格、1024 实时反射、2048 城市阴影及原高精度模型与贴图。
- 玩家视觉总三角形：${summary.geometryBefore.toLocaleString('en-US')} → ${summary.geometryAfter.toLocaleString('en-US')}；新增装配细节没有增加模型材质组/绘制组。
- 新氮气核心与外流合为一组；压力环/水冠为八个有限实例，仅事件期间绘制，低画质关闭。原水滴池 360 个容量保持。
- 同样 32 个水面尾浪样本，优先可见区域；复用原环境探针与资源，未增加网络模型/贴图文件。
- 所有四组性能回放的车辆终态与检查点进度逐项一致。

## 性能问题记录及保留观感的处理方案\n\n本轮已移除织物/橡胶不必要的清漆层、合并喷流绘制、复用细节几何与原环境探针、限制事件实例及优先可见尾浪。接下来的验收条件是在可用内存充足的固定环境复测；如仍有稳定回退，按实际 CPU/GPU 与内存峰值定位，优先复用临时缓冲、减少无效上传与着色工作，保留几何、贴图和阴影规格。本轮不通过降低画质掩盖波动，也不把功能测试通过当成性能通过。\n\n## 尚未彻底解决的视觉短板

1. 车手近距离仍可看到局部服装接缝与肩部体块不够自然；本轮精修头盔和材质，没有宣称重新扫描或重拓扑真人。
2. 部分中远景建筑仍有重复的构件语言，近距离市民的脸部、手部精度低于玩家车手；未通过继续堆模型放大性能成本。
3. 单平面实时反射与有限水花预算仍有上限，落水是短暂水冠/压力环和粒子，不是流体模拟；没有使用模糊滤镜掩盖这些限制。
4. 本轮重点是 PC 观感；手机专项提质和性能结论仍需真机验收，未代替用户做真实手机性能承诺。

请按图集与本机实际驾驶验收。本轮在此停止，不自动增加玩法，不自动上线。
`;
await writeFile(`${out}/README.md`,markdown);
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>极速水城 · 视觉精修验收</title><link rel="icon" href="data:,"><style>
*{box-sizing:border-box}body{margin:0;background:#091b27;color:#e0f0f1;font:15px/1.8 system-ui,sans-serif}a{color:#a5f4de}button{font:inherit;cursor:pointer}header{max-width:1380px;margin:auto;padding:25px 28px;display:flex;justify-content:space-between;border-bottom:1px solid #c9ece51c}.tag{color:#a5f4de;font-size:11px;letter-spacing:3px}main{max-width:1380px;margin:auto;padding:32px 28px}h1{font-size:42px;letter-spacing:2px;line-height:1.3;margin:10px 0}h2{font-size:24px;margin:0 0 12px}p{color:#aac4ce}section{margin-bottom:52px}.intro{max-width:850px;margin-bottom:30px}.actions{display:flex;gap:18px;flex-wrap:wrap}.actions a{border:1px solid #a5f4de50;border-radius:8px;padding:8px 17px;text-decoration:none}.hero{width:100%;display:block;border-radius:15px;max-height:630px;object-fit:cover}.badge{font-size:12px;border:1px solid #a5f4de55;border-radius:22px;padding:4px 13px;color:#a5f4de}.filters{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}.filters button{border:1px solid #a9d5de38;background:#153544;color:#bdd4dc;border-radius:24px;padding:6px 18px}.filters [aria-pressed="true"]{background:#a5f4de;color:#0b2835}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.shot{text-align:left;padding:0 0 18px;overflow:hidden;border:1px solid #a9d5de38;border-radius:13px;background:#102d3a;color:#e0f0f1;transition:transform .15s}.shot:hover{transform:translateY(-3px);border-color:#a5f4de88}.shot img{width:100%;aspect-ratio:1.6;object-fit:cover;display:block}.shot .meta{display:block;font-size:10px;letter-spacing:2px;color:#8bd6d5;margin:16px 18px 4px}.shot h3{font-size:17px;margin:0 18px}.shot p{font-size:12px;line-height:1.7;margin:7px 18px 0}.comparison{position:relative;overflow:hidden;border:1px solid #a9d5de38;border-radius:14px;aspect-ratio:1.6;background:#0b2432}.comparison img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.comparison img.new{clip-path:inset(0 0 0 var(--cut,50%))}.comparison .line{position:absolute;top:0;bottom:0;left:var(--cut,50%);border-left:2px solid #b7fff3;pointer-events:none}.comparison label{position:absolute;top:15px;padding:4px 12px;border-radius:5px;background:#061c2dd9;font-size:12px}.comparison .old-label{left:15px}.comparison .new-label{right:15px}.comparison input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize}.select-compare{padding:9px 13px;margin:12px 0;background:#173c4b;border:1px solid #a5f4de55;border-radius:8px;color:#e0f0f1}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:12px;border-bottom:1px solid #c9ece51c}th{font-size:11px;color:#a5f4de;font-weight:500;letter-spacing:1px}td{font-size:14px}.panel{border:1px solid #a9d5de38;border-radius:14px;padding:25px;background:#102d3a}ul{padding-left:20px;color:#aac4ce}.limitations{color:#d4c8ab}dialog{width:95vw;max-width:1700px;max-height:96vh;padding:15px;background:#0d2836;border:1px solid #a5f4de66;border-radius:12px;color:#e0f0f1}dialog::backdrop{background:#020c14e6}dialog img{width:100%;max-height:79vh;object-fit:contain}dialog button{float:right;border:1px solid #a5f4de55;border-radius:7px;background:#173c4b;color:#e0f0f1;padding:5px 15px}dialog p{margin:5px 0}footer{padding:20px 0;color:#809aa5;font-size:12px}[hidden]{display:none!important}@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}h1{font-size:32px}}@media(max-width:600px){main,header{padding:20px 16px}.grid{grid-template-columns:1fr}.badge{display:none}h1{font-size:28px}td,th{padding:9px 6px;font-size:11px}}
</style></head><body><header><strong>极速水城 / VELOCITY</strong><span class="badge">本机视觉验收 · 尚未发布</span></header><main><section><div class="intro"><span class="tag">FINAL VISUAL FINISH / 2026.10.25</span><h1>熟悉的赛道，<br>更完整的竞速质感。</h1><p>本轮保留玩法、驾驶、地图与多人协议，精修快艇装配、车手材质、水面特效和整套界面。以下全部为真实游戏画面，点击图片可查看大图。</p><div class="actions"><a href="/" target="_blank">打开本机游戏 →</a><a href="README.md">完整验收报告</a><a href="AUDIT.md">审查记录</a></div></div><img class="hero" src="images/after-boat-left-front-45.jpg" alt="新版快艇左前45度实机近景"></section>
<section><span class="tag">BEFORE / AFTER</span><h2>同视角对照</h2><p>拖动分隔线比较。左为本轮前的版本，右为精修版本；保留同一资源、机位和质量设置。</p><select class="select-compare" aria-label="选择对照内容"><option value="boat-front-left">快艇右前近景</option><option value="rider-riding">车手骑乘近景</option><option value="nitro">氮气喷流与 HUD</option><option value="hud-racing">比赛 HUD</option><option value="district-tech">科技区环境</option></select><div class="comparison"><img class="old" src="images/before-boat-front-left.jpg" alt="精修前"><img class="new" src="images/after-boat-front-left.jpg" alt="精修后"><div class="line"></div><label class="old-label">精修前</label><label class="new-label">精修后</label><input type="range" min="0" max="100" value="50" aria-label="前后画面对照分隔线"></div></section>
<section><span class="tag">IN-GAME CAPTURES</span><h2>逐项验收图集</h2><div class="filters">${['全部','快艇','车手','水面与特效','城市环境','界面'].map((v,i)=>`<button aria-pressed="${!i}">${v}</button>`).join('')}</div><div class="grid">${cards}</div></section>
<section class="panel"><span class="tag">PERFORMANCE / SAME REPLAY</span><h2>性能对照：仍需稳定性复测</h2><p>本机 RTX 4060 Laptop，Edge，1600×1000、DPR1、桌面标准画质。每轮独立启动/关闭 Edge，交替测试两轮修改前后版本，每场景预热 180 帧、记录 240 帧。没有同时录制视频或运行其他 GPU 验收。</p><p class="limitations"><strong>性能稳定性尚未通过最终验收。</strong> 重复测试中，系统可用内存一度仅约 15–60 MB，原版和新版都出现长帧。下面完整保留最终轮次结果，不把波动当作确定收益或归因结论。请结合完整报告中的其他轮次查看。</p><table><thead><tr><th>场景</th><th>原版 FPS</th><th>新版 FPS</th><th>变化</th><th>GPU 毫秒</th></tr></thead><tbody>${tables}</tbody></table><p>反射仍为 1024，水面网格仍为 320，城市阴影仍为 2048；原高模与贴图保留。四组回放的车辆物理终态与检查点进度逐项一致。此结果仅代表本机这些场景，不代表所有电脑和手机。</p><a href="performance.json">查看完整测量数据</a></section>
<section class="panel"><h2>已完成与保留的边界</h2><ul><li>快艇推进口、脚踏紧固、仪表边框与车手头盔细节并入原有模型材质组；未增加模型绘制组。</li><li>船漆清漆层、金属、橡胶、织物、头盔和面罩分别调整，保留原贴图、UV 与队伍颜色。</li><li>氮气亮芯/流动外喷流、方向水滴、破碎尾浪、落水压力环和短暂水冠；不增加原水滴容量。</li><li>街区色材、花箱叶片、维护设施装配、日光方向以及 HUD/首页/加载界面统一。</li><li>248 项功能测试、13 项 Workers 测试、完整三圈实机与七种触控尺寸回归。详见验收报告。</li></ul><p class="limitations">仍有短板：车手的局部服装接缝和肩部体块、近距离市民、部分建筑重复度，以及单平面反射与小规模粒子效果的表现上限。本轮没有宣称完成电影级人物或流体模拟；高精度五艇同屏也仍是较重场景。</p></section><footer>本地验收版本 · 未推送或部署 · 等待用户验收</footer></main><dialog><button class="close">关闭 ×</button><p class="caption"></p><img alt=""><p class="note"></p></dialog><script>
const compare=document.querySelector('.comparison');compare.querySelector('input').addEventListener('input',e=>compare.style.setProperty('--cut',e.target.value+'%'));document.querySelector('.select-compare').addEventListener('change',e=>{compare.querySelector('.old').src='images/before-'+e.target.value+'.jpg';compare.querySelector('.new').src='images/after-'+e.target.value+'.jpg'});
document.querySelectorAll('.filters button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filters button').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));document.querySelectorAll('.shot').forEach(v=>v.hidden=b.textContent!=='全部'&&v.dataset.category!==b.textContent)}));const dialog=document.querySelector('dialog');document.querySelectorAll('.shot').forEach(b=>b.addEventListener('click',()=>{dialog.querySelector('img').src='images/after-'+b.dataset.id+'.jpg';dialog.querySelector('img').alt=b.dataset.title;dialog.querySelector('.caption').textContent=b.dataset.title;dialog.querySelector('.note').textContent=b.dataset.note;dialog.showModal()}));dialog.querySelector('.close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
</script></body></html>`;await writeFile(`${out}/index.html`,html);console.log(JSON.stringify(summary,null,2));

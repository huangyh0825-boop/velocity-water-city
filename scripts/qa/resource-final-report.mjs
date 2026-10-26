import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const out='docs/resource-quality',folder=out+'/final';await mkdir(folder+'/data',{recursive:true});await mkdir(folder+'/images',{recursive:true});
const paths={before:'work/resource-quality/before-final/baseline.json',after:'work/resource-quality/final/baseline.json',round1:'work/resource-quality/round1/baseline.json',round1Focused:'work/resource-quality/round1-focused/baseline.json',round2Focused:'work/resource-quality/round2-focused/baseline.json',network:'work/resource-quality/cold-network.json',fallback:'work/resource-quality/final/fallback.json',lifecycle:'work/resource-quality/final/lifecycle.json',framePhysics:'work/resource-quality/frame-physics.json',online:'work/resource-quality/final/online/result.json',captures:'work/final-finish/resource-final/capture-report.json',details:'work/resource-quality/final/art/detail-views.json',poses:'work/resource-quality/round2/skin-compare/result.json',fullRace:'work/resource-quality/round1/full-race/full-drive.json',mobile:'work/resource-quality/final/mobile/browser.json',review:'work/resource-quality/final/review-browser.json'};
const d={};for(const[k,path]of Object.entries(paths)){d[k]=JSON.parse(await readFile(path,'utf8'));await copyFile(path,`${folder}/data/${k}.json`);}
assert.ok(d.after.completed&&!d.after.short&&d.after.long.at(-1).wallSeconds>=960);assert.equal(d.after.scenes.length,7);assert.deepEqual(d.after.errors,[]);assert.ok(d.fallback.completed&&d.lifecycle.completed&&d.details.completed&&d.poses.completed&&d.network.completed);
for(let i=0;i<7;i++){assert.deepEqual(d.after.scenes[i].end,d.before.scenes[i].end);assert.deepEqual(d.after.scenes[i].passed,d.before.scenes[i].passed);}
const compress=`from PIL import Image
from pathlib import Path
out=Path('docs/resource-quality/final/images')
for f in Path('work/final-finish/resource-final').glob('*.png'):
 Image.open(f).convert('RGB').save(out/('after-'+f.stem+'.jpg'),quality=94,subsampling=0,optimize=True)
for name in ['quality-low','quality-standard','quality-high','spray-close-round1','spray-close-final']:
 f=Path('work/resource-quality/final/art',name+'.png');Image.open(f).convert('RGB').save(out/(name+'.jpg'),quality=94,subsampling=0,optimize=True)
`;
execFileSync('C:/Users/17033/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-c',compress]);
const a=d.after,b=d.before,sum=(r,k)=>r.initialMemory.processes.reduce((s,p)=>s+p[k],0),f=n=>n.toFixed(1),m=n=>(n/1048576).toFixed(1),percent=(before,after)=>((1-after/before)*100).toFixed(1),meanFrame=r=>r.scenes.reduce((s,x)=>s+1000/x.fps,0)/r.scenes.length,names=['进入赛道','中央商务区','密集科技区','高架水道','高速行驶','五艇同屏','水花与氮气'];
const long=a.long,settled=long.filter(s=>s.wallSeconds>=60),range=fn=>{const values=settled.map(fn);return`${f(Math.min(...values))}–${f(Math.max(...values))}`;};
const resources=[['浏览器进程私有提交 / MiB',m(sum(b,'PrivateBytes')),m(sum(a,'PrivateBytes'))],['浏览器私有驻留 / MiB',m(sum(b,'WorkingSetPrivate')),m(sum(a,'WorkingSetPrivate'))],['JS Heap / MiB',m(b.initialMemory.heap.usedSize),m(a.initialMemory.heap.usedSize)],['ArrayBuffer 等 backing store / MiB',m(b.initialMemory.heap.backingStorageSize),m(a.initialMemory.heap.backingStorageSize)],['纹理 API 分配估算 / MiB',m(b.initial.allocation[0].textureBytesEstimate),m(a.initial.allocation[0].textureBytesEstimate)],['顶点、索引与实例 buffer 分配 / MiB',m(b.initial.allocation[0].bufferBytes),m(a.initial.allocation[0].bufferBytes)],['Renderbuffer 分配估算 / MiB',m(b.initial.allocation[0].renderbufferBytesEstimate),m(a.initial.allocation[0].renderbufferBytesEstimate)],['WebGL 纹理对象（含内部默认对象）',b.initial.allocation[0].textures,a.initial.allocation[0].textures],['场景纹理对象',b.initial.scene.textures,a.initial.scene.textures],['场景 geometry 对象',b.initial.scene.geometries,a.initial.scene.geometries],['初次 shader 编译次数',b.initial.allocation[0].compiled,a.initial.allocation[0].compiled],['本次本机首次加载 / ms',b.loadMs,a.loadMs]];
const sceneRows=a.scenes.map((s,i)=>`|${names[i]}|${f(b.scenes[i].fps)} → ${f(s.fps)}|${f(b.scenes[i].low1Fps)} → ${f(s.low1Fps)}|${f(b.scenes[i].cpuMs)} → ${f(s.cpuMs)}|${f(b.scenes[i].gpuMs)} → ${f(s.gpuMs)}|${f(b.scenes[i].calls)} → ${f(s.calls)}|${(b.scenes[i].triangles/1e6).toFixed(2)} → ${(s.triangles/1e6).toFixed(2)}|`).join('\n');
const netB=d.network.result.find(r=>r.label==='before'),netA=d.network.result.find(r=>r.label==='after');
const sourceHash=createHash('sha256').update(await readFile('src/effects/Spray.ts')).digest('hex');
const notes=`# 极速水城：两轮性能与视觉精修验收

本机版本已完成两轮优化和验证，等待用户试玩验收。**没有推送或部署 GitHub，没有更改 Render / Cloudflare 服务或多人协议。**

[交互图集](index.html) · [第一轮检查点报告](round1/README.md) · [最新原始数据](final/data/after.json)

## 实测结果与适用范围

RTX 4060 Laptop 8 GB / Ryzen 9 7945HX / 约 16 GB 系统内存 / Edge，1600×1000、DPR1、标准画质。原版 b17679f 与最终版紧接测量；排除了其他游戏占用显卡、内存的记录。每场景预热 120 帧，记录 360 帧；表中 1% Low 为最慢 1% 帧的平均帧时间换算。测试解除渲染上限，正式默认 60。

- 七场景等帧数组合 FPS：${f(1000/meanFrame(b))} → ${f(1000/meanFrame(a))}。这是测试组合，不是整场驾驶平均值。
- 纹理 API 分配估算减少 ${percent(b.initial.allocation[0].textureBytesEstimate,a.initial.allocation[0].textureBytesEstimate)}%；浏览器私有提交减少 ${percent(sum(b,'PrivateBytes'),sum(a,'PrivateBytes'))}%，私有驻留减少 ${percent(sum(b,'WorkingSetPrivate'),sum(a,'WorkingSetPrivate'))}%。
- 原快艇 3,419,130 + 车手 1,508,630 个三角形保留，没有简化或量化。新增的护件和护领等小细节使用已有材质组。所有城市原始 geometry buffer 也逐项校验。
- **多艇高精度场景仍约 35–42 FPS，尚未达到普遍稳定 60 FPS。** 没有将平均值、峰值或渲染上限当成保证帧率。

|场景|FPS|1% Low FPS|CPU 提交 ms|GPU ms|Draw Calls|三角形 / 百万（全部绘制通道合计）|
|---|---:|---:|---:|---:|---:|---:|
${sceneRows}

CPU 提交时间含驱动同步等待，不是纯 JavaScript 执行时间。GPU 数据来自有效、非 disjoint 的浏览器 timer query。主画面、倒影和阴影都会重复绘制高模，因此通道合计三角数远高于单艇模型面数。七场景稳态采样中的额外 shader 编译均为 ${a.scenes.reduce((n,s)=>n+s.compileDuringMeasurement,0)} 次。七组同输入回放的所有快艇位置、速度、路线和检查点终态逐项相同。

|资源|原版|最终版|
|---|---:|---:|
${resources.map(r=>'|'+r.join('|')+'|').join('\n')}

上述纹理、buffer 与 renderbuffer 是 WebGL API 请求存储的估算，**不是游戏独占物理显存**，也不等于 nvidia-smi 的整机显存数字。浏览器合计私有提交和私有驻留分别报告；后者才是私有驻留页。JS Heap 受 GC 时机影响。压缩 mip 数据保留在 CPU 侧，因此 backing store 上升，但总进程内存下降。

## 两轮的实际改动

### 第一轮：资源与近景质量

- 对顶点缓存和取数顺序做无损重排、共享相同 buffer；不减面、不改位置/法线/UV/关节权重，透明面的绘制顺序保留。
- 原尺寸 UASTC/KTX2、完整 mip 链与图像源复用；城市模型的内嵌图片外置去重，几何 gzip 传输。GPU 纹理压缩是高质量有损格式，**没有宣称压缩纹理像素数据无损**。原图与旧 GLB 留作回退。
- 模型/骨骼/图像/解码器按最后一个使用者释放，回首页立即释放旧 WebGL context。共享资源不会在其他艇仍使用时提前销毁。
- 自阴影未使用的颜色附件改 R8，原 2048 深度精度和九次采样保留。没有关闭阴影或水面反射。
- 船头护件的圆角、拼接和紧固点，头盔下方的软护领，肩部颜色过渡，织物/橡胶的粗糙度，近景入口雨棚与圆角门框，随艇接触波纹、破碎水冠和喷流压力节。
- 高/标准/低画质与 60/120/不限制。标准保留原来的渲染分辨率与所有主要模型/阴影/水面预算；手机标准沿用已有平衡配置。

### 第二轮：水滴表现与零贡献运算

- 水滴增加随世界日光方向变化的亮面、轻量透镜明暗和透明边缘。光照方向每粒子计算，片元使用低成本多项式近似；没有新增纹理、RenderTarget、绘制组或粒子。
- 透明度为零的池内点提前裁到视锥外，减少不可见点的后续光栅化。可见粒子的数量、寿命、大小和运动数据保持。
- 骨骼专用化实验未显示稳定收益，已撤回；最终骨骼代码与第一轮相同。最终五姿态的骨骼矩阵与机位对照通过，不把弃用实验算成成果。

第二轮选取四个场景交替测量，幅度较小，不能外推为所有设备收益：

|场景|第一轮 FPS|第二轮 FPS|
|---|---:|---:|
${d.round2Focused.scenes.map((s,i)=>`|${names[a.scenes.findIndex(x=>x.id===s.id)]}|${f(d.round1Focused.scenes[i].fps)}|${f(s.fps)}|`).join('\n')}

## 加载与兼容性

独立冷启动使用全新浏览器 context，服务端统计所有模型/纹理 GET 响应的实际 body 字节，覆盖 worker 与 Range 分片；HEAD 的响应没有 body，已排除。旧版 worker 缺失的 raw GLB 字节字段没有被当成零下载量。

|独立网络检查|原版|最终版|
|---|---:|---:|
|模型与纹理 body / MB（十进制）|${(netB.modelAndTextureBytes/1e6).toFixed(2)}|${(netA.modelAndTextureBytes/1e6).toFixed(2)}|
|本地该轮启动 ms|${netB.loadMs}|${netA.loadMs}|

传输量减少 ${percent(netB.modelAndTextureBytes,netA.modelAndTextureBytes)}%。不同轮次本地启动耗时有波动，不能承诺所有网络上启动更快；本轮更明确的收益是内存与纹理压力降低。没有用本机 localhost 结果冒充中国大陆公网连通性测试。

三种故障/兼容条件均实际进入游戏、模型与城市齐全、WebGL error=0：

${d.fallback.checks.map(c=>`- ${c.mode}：通过，本机启动 ${c.loadMs} ms。`).join('\n')}

## 长时间、生命周期与玩法回归

- 最终代码真实驾驶 ${f(long.at(-1).wallSeconds)} 秒，模拟 ${f(long.at(-1).simulationSeconds)} 秒，玩家通过 ${long.at(-1).passed[0]} 个检查点，完成多圈；不是加速回放。第 1 轮也保留独立的 960 秒记录。
- 60 秒后至结束，GPU 纹理对象 ${range(s=>s.allocation[0].textures)}、renderer geometry ${range(s=>s.renderer.geometries)}；JS Heap ${range(s=>s.memory.heap.usedSize/1048576)} MiB 随 GC 波动，没有随圈数持续累积。固定池的粒子、尾浪和水冠均持续回收。
- 最终三轮开局→重开→低/标准/高→回首页，以及加载中途取消后再进游戏，通过；首页图像源、模型用户与 Game 引用归零。比赛内部保留有限的画质变体，退出时一起释放。
- 实际 Game.frame 在相同 144Hz 时间序列、60/120/不限制三档全部执行 600 次物理步，位置、速度、氮气、计圈相同。上限不会改变物理结果。
- 玩家和四 AI 完整三圈、两条捷径、72 个检查点并进入完赛：第一轮真实游戏逻辑的加速回归通过。此后物理/赛道/AI/成绩代码未变；最终长测另覆盖完整地图多圈。
- 最终双浏览器客户端：房主与准备、等待慢玩家加载、共享五秒倒计时、真实驾驶与对手广播、断线重连、一分钟频率限制、退出均通过。
- 最终手机七种视口的按键、菜单、提示和多指控制回归通过；原生 iPhone 缩放及真机手机 FPS没有冒充模拟器验证。
- 255 项 Node 测试、13 项 Workers 测试、前端/Node 服务端/Workers 类型检查和生产构建通过。截图与各兼容检查没有浏览器运行错误。

## 截图与具体可见改进

[交互图集](index.html)包含全部 21 项分类验收图，以及 9 种原版/最终版滑动对照。原尺寸 PNG 保留在本机 work/final-finish/resource-final；此处 JPEG 使用相同参数导出，没有重画或重新调色。

${[['boat-left-front-45','快艇左前45°'],['boat-right-rear-45','快艇右后45°'],['driving-third-person','驾驶第三人称'],['rider-riding','车手骑乘近景'],['rider-side','车手侧面'],['rider-turning','车手转弯'],['water-cruise','平稳水面'],['wake-high-speed','高速尾浪'],['turn-spray','转弯水花'],['jump-landing','跳跃落水'],['nitro','氮气加速'],['district-cbd','中央商务区'],['district-tech','科技区'],['district-harbor','港湾区'],['district-leisure','滨水休闲区'],['district-elevated','高架水道'],['hud-racing','比赛HUD'],['trick-feedback','特技反馈'],['menu-home','首页'],['loading','加载界面']].map(([id,t])=>`- [${t}](final/images/after-${id}.jpg)`).join('\n')}

附加：[第二轮水滴近景前](final/images/spray-close-round1.jpg) / [后](final/images/spray-close-final.jpg)，[低](final/images/quality-low.jpg) / [标准](final/images/quality-standard.jpg) / [高](final/images/quality-high.jpg)。高与标准使用同一套 ${d.details.grades.find(g=>g.level==='high').triangles.toLocaleString('en-US')} 三角形的艇/车手/附属显示对象，原始 492.8 万三角形未减；高档反射 1536、城市阴影 3072，标准反射 1024、城市阴影 2048、车手阴影 2048、水网格 320。这里的高档图是功能与观感检查，不代表最高 DPI 下保证 60 FPS。

## 主要代码与重建

|文件|作用|
|---|---|
|[TextureResources.ts](../../src/player/TextureResources.ts)、[AssetGLTF.ts](../../src/player/AssetGLTF.ts)|共享图像源、GPU 纹理与原图/旧模型回退|
|[VisualAssets.ts](../../src/player/VisualAssets.ts)、[Watercraft.ts](../../src/player/Watercraft.ts)|模型租约、共享资源与骨骼释放|
|[HeroLighting.ts](../../src/player/HeroLighting.ts)|保留深度精度、缩减闲置颜色附件|
|[RacecraftDetails.ts](../../src/player/RacecraftDetails.ts)、[FinishMaterials.ts](../../src/player/FinishMaterials.ts)|护件、护领、肩部颜色与材质质感|
|[CityInteriors.ts](../../src/environment/CityInteriors.ts)|共享入口门框、雨棚和阈槛|
|[Water.ts](../../src/effects/Water.ts)、[ImpactRipples.ts](../../src/effects/ImpactRipples.ts)、[Spray.ts](../../src/effects/Spray.ts)|接触水、落水水冠、水滴与零贡献裁剪|
|[RenderPacer.ts](../../src/core/RenderPacer.ts)、[RenderQuality.ts](../../src/core/RenderQuality.ts)、[Hud.ts](../../src/ui/Hud.ts)|独立渲染上限和档位|
|[资源生成脚本](../../scripts/build-gpu-textures.mjs)、[模型缓存重排](../../scripts/optimize-racer-buffers.mjs)、[城市传输打包](../../scripts/pack-city-transport.mjs)|可复现生成，原资源保留|

生产构建使用已提交的派生资源，不需要在线编码。重建纹理前运行 node scripts/setup-gpu-encoder.mjs，下载并校验固定的隔离编码器，不更换项目依赖；随后依次运行城市传输与纹理生成脚本。依据：[Three.js KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html)、[Basis Universal](https://github.com/BinomialLLC/basis_universal)。

最终水滴源码 SHA256：${sourceHash}。所有本轮结果在 final/data，第一轮保持单独检查点。

## 尚未彻底解决

高精度五艇在主画面/倒影/阴影中重复绘制仍然较重，普通机器或高 DPI 下不能保证 60 FPS。人物面部与部分服装、近距离市民、建筑重复度、单平面反射和小规模粒子效果仍有表现上限。本轮没有新增全屏滤镜来遮掩这些问题，也没有承诺达到电影级人物或真实流体。

完成后停止，等待用户试玩验收。公网版本未变。
`;
await writeFile(out+'/README.md',notes);await writeFile(folder+'/summary.json',JSON.stringify({sourceHash,baseline:'b17679f',round1Checkpoint:'e5ea0b0',textureReductionPercent:Number(percent(b.initial.allocation[0].textureBytesEstimate,a.initial.allocation[0].textureBytesEstimate)),privateCommitReductionPercent:Number(percent(sum(b,'PrivateBytes'),sum(a,'PrivateBytes'))),combinedFps:[1000/meanFrame(b),1000/meanFrame(a)],longSeconds:long.at(-1).wallSeconds,networkBytes:[netB.modelAndTextureBytes,netA.modelAndTextureBytes]},null,2));console.log('Final report and portable image evidence written.');

import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const out='docs/resource-quality/round1';await mkdir(out+'/data',{recursive:true});await mkdir(out+'/images',{recursive:true});
const paths={before:'work/resource-quality/before-repeat/baseline.json',after:'work/resource-quality/round1/baseline.json',longBefore:'work/resource-quality/before/baseline.json',lifecycleBefore:'work/resource-quality/before/lifecycle.json',lifecycleAfter:'work/resource-quality/after/lifecycle.json',framePhysics:'work/resource-quality/frame-physics.json',online:'work/resource-quality/round1/online/result.json',fullRace:'work/resource-quality/round1/full-race/full-drive.json',captures:'work/final-finish/resource-round1/capture-report.json',mobile:'work/resource-quality/mobile/browser.json'};
const data={};for(const[k,path]of Object.entries(paths)){data[k]=JSON.parse(await readFile(path,'utf8'));await copyFile(path,`${out}/data/${k}.json`);}if(!data.after.completed||data.after.short||data.after.long.at(-1).wallSeconds<960)throw Error('First-round real-time run incomplete');
const compress=`from PIL import Image
from pathlib import Path
out=Path('docs/resource-quality/round1/images')
for label,source in [('before','resource-before'),('after','resource-round1')]:
 for f in Path('work/final-finish',source).glob('*.png'):
  Image.open(f).convert('RGB').save(out/(label+'-'+f.stem+'.jpg'),quality=94,subsampling=0,optimize=True)
`;
execFileSync('C:/Users/17033/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-c',compress]);
const names=['进入赛道','中央商务区','密集科技区','高架水道','高速行驶','五艇同屏','水花与氮气'],b=data.before,a=data.after,sum=(r,k)=>r.initialMemory.processes.reduce((s,p)=>s+p[k],0),MiB=n=>(n/1048576).toFixed(1),f=n=>n.toFixed(1);
await writeFile(out+'/README.md',`# 第 1 轮：资源与质感联合优化检查点

本机候选已经通过下列验证，用户随后要求继续第 2 轮。没有推送或部署。第 2 轮将另保留数据，避免混写轮次。

RTX 4060 Laptop / Ryzen 9 7945HX / Edge，1600×1000 DPR1，标准画质。基准版本 b17679f。原版在退出另一款游戏后重新测量，紧接着测新版。七场景每次预热 120 帧、记录 360 帧。对比解除渲染上限，生产默认 60；物理保持固定 60Hz。

|场景|原 FPS → 本轮 FPS|1% Low FPS|GPU ms|CPU 提交 ms|
|---|---:|---:|---:|---:|
${a.scenes.map((s,i)=>`${'|'}${names[i]}|${f(b.scenes[i].fps)} → ${f(s.fps)}|${f(b.scenes[i].low1Fps)} → ${f(s.low1Fps)}|${f(b.scenes[i].gpuMs)} → ${f(s.gpuMs)}|${f(b.scenes[i].cpuMs)} → ${f(s.cpuMs)}|`).join('\n')}

|资源|原版|本轮|
|---|---:|---:|
|纹理 API 分配估算 MiB|${MiB(b.initial.allocation[0].textureBytesEstimate)}|${MiB(a.initial.allocation[0].textureBytesEstimate)}|
|顶点/索引等 buffer 分配 MiB|${MiB(b.initial.allocation[0].bufferBytes)}|${MiB(a.initial.allocation[0].bufferBytes)}|
|浏览器进程合计私有提交 MiB|${MiB(sum(b,'PrivateBytes'))}|${MiB(sum(a,'PrivateBytes'))}|
|浏览器私有驻留 MiB|${MiB(sum(b,'WorkingSetPrivate'))}|${MiB(sum(a,'WorkingSetPrivate'))}|
|JS Heap MiB|${MiB(b.initialMemory.heap.usedSize)}|${MiB(a.initialMemory.heap.usedSize)}|
|ArrayBuffer 等 backing store MiB|${MiB(b.initialMemory.heap.backingStorageSize)}|${MiB(a.initialMemory.heap.backingStorageSize)}|
|本机冷启动 ms|${b.loadMs}|${a.loadMs}|

纹理数字是 WebGL 请求的存储估算，不是游戏独占物理显存。进程私有提交与驻留分别列出，不冒充系统内存或显存。压缩 mip 数据保留在 CPU 侧，ArrayBuffer 指标升高；总进程内存下降。初次 shader 编译数量从 ${b.initial.allocation[0].compiled} 到 ${a.initial.allocation[0].compiled}；七场景稳定测量期间新增编译全部为零。本地加载耗时变化很小，不能承诺互联网下载同样改善。下载统计正在补入独立服务器侧统计，旧版 worker 未报告 raw GLB 的字节数，不能用缺失项推断网络总量。

## 实际改变

- 模型不减面、不量化：重新排列顶点缓存顺序与复用 buffer，透明三角顺序保留。原快艇 3,419,130 + 车手 1,508,630 个三角形全部保留，骨骼、UV、插槽和动作保留。
- 原尺寸完整 mip 的 UASTC/KTX2；原始图片和旧 GLB 保留为回退。GPU 压缩是高质量有损格式，没有宣称像素数据无损。城市图片去重并与几何分离，几何 buffer 字节逐项验证。
- 引用计数释放共享模型、纹理、骨骼调色板和解码工作线程；返回首页后 Source/模型引用均归零。三次重开/画质切换/返回与启动中途取消已通过。
- 未使用的自阴影颜色附件改 R8，原 2048 深度与九次采样保留。标准画质的分辨率、320 水网格、1024 倒影、2048 城市/车手阴影都保留。
- 画质高/标准/低和 60/120/不限制。实际 Game.frame 在相同 144Hz 时间序列下三档全部执行 600 次物理步，位置/速度/氮气/计圈结果完全一致。
- 船头弧边护件、颈部护领、服装肩部颜色过渡、织物与橡胶粗糙度、入口雨棚/圆角门框、随艇接触波纹、破碎水冠和喷流压力节均有更新；没有通过曝光更改冒充建模升级。

## 验证与边界

- 实时驾驶 ${f(a.long.at(-1).wallSeconds)} 秒，模拟 ${f(a.long.at(-1).simulationSeconds)} 秒，玩家通过 ${a.long.at(-1).passed[0]} 个检查点。原版的实时时长也保留在 data/longBefore.json；此项没有加速模拟。
- 完整三圈与两条捷径：玩家和四 AI 全部 72 个检查点、进入完赛。此回归使用加速 QA，仅与上面的真实时长测试分开报告。
- 两真实浏览器客户端的大厅、准备、等待慢玩家、共同五秒倒计时、竞速广播、断线重连、频率上限与退出通过。
- 254 项完整 Node 测试与 13 项 Workers 测试通过；新增水面零贡献裁剪数学测试随后单独通过。最终轮次会再次跑完整测试。四套 TypeScript 检查和生产构建通过。
- 七种触控尺寸通过；原生 iPhone 手势行为没有冒充真机验收。
- 第一轮多艇场景依然约 34–42 FPS，未达到普遍 60 FPS。1% Low 在进入赛道的场景有波动，不能宣称全部场景更稳。人物面部、局部服装和单平面水反射仍有表现上限。

## 同机位图像

${['boat-left-front-45','boat-right-rear-45','rider-riding','rider-side','district-cbd','district-harbor','district-tech','water-cruise','wake-high-speed','turn-spray','nitro','jump-landing','hud-racing'].map(id=>`- ${id}：[原版](images/before-${id}.jpg) / [本轮](images/after-${id}.jpg)`).join('\n')}

完整 PNG 保留在本机 work/final-finish/resource-round1。此目录的 JPEG 只做同参数导出，没有重画或重调色。
`);
console.log('First-round report and actual evidence saved.');

import{readFileSync,writeFileSync}from'node:fs';
const folder='docs/waterfront-life',layout=JSON.parse(readFileSync(folder+'/layout.json')),perf=JSON.parse(readFileSync(folder+'/performance.json')),race=JSON.parse(readFileSync(folder+'/full-race/full-drive.json'));
const names={central:'中央商务区',science:'未来科技区',transit:'高架交通区',industrial:'工业水道区',harbor:'港湾区',leisure:'城市休闲区'},sceneNames={'city-driver':'中央水道驾驶视角','city-distance':'中央水道远眺','elevated-five':'高架水道五艇','tunnel-five':'工业隧道五艇'},f=v=>v.toFixed(2);
const table=Object.keys(sceneNames).map(id=>{const a=perf.results.find(r=>r.label==='before'&&r.id===id),b=perf.results.find(r=>r.label==='after'&&r.id===id);return`| ${sceneNames[id]} | ${f(a.fps)} → ${f(b.fps)} | ${f(a.low1)} → ${f(b.low1)} | ${f(a.frameMs)} → ${f(b.frameMs)} | ${f(a.cpuMs)} → ${f(b.cpuMs)} | ${f(a.gpuMs)} → ${f(b.gpuMs)} | ${a.calls} → ${b.calls} |`;}).join('\n');
writeFileSync(folder+'/REPORT.md',`# 滨水公共空间与直接鼠标观察修订

基线：waterfront-life-baseline / aeb908e。保留原有建筑、赛道、水面、赛车资产与玩法。本轮只修改环境布置、鼠标输入及对应说明和测试，没有部署。

[同视角对照与驾驶截图](index.html) · [完整布置坐标](layout.json) · [鼠标测试](camera-tests.json) · [正式入口测试](production.json) · [内置浏览器记录](iab-tests.json) · [性能原始数据](performance.json) · [三圈比赛记录](full-race/full-drive.json) · [145 项自动化测试](test-results.txt)

## 1. 补充了哪些空地

共 ${layout.pockets.length} 处功能空间：39 处完整观景/休息/港湾服务平台、176 处适应狭窄步道的休息点、66 处低层商业与服务建筑前庭。没有增加大楼或移动现有建筑。

| 区域 | 公共空间数 | 布置用途 |
| --- | ---: | --- |
${Object.entries(names).map(([id,name])=>`| ${name} | ${layout.pockets.filter(p=>p.district===id).length} | ${({central:'桥前桥后、曲线步道、商业建筑门前观赛与休息',science:'科研/商业建筑前庭、树池与绿化休息点',transit:'桥边和地面交通节点的等候、观景空间；避开高架飞行净空',industrial:'低层服务建筑前庭、维护水岸、观赛点和芦苇箱',harbor:'系泊/救生设施、码头服务空间与弯道观赛点',leisure:'滨水观景、商业前庭和树木/花箱休闲区'})[id]} |`).join('\n')}

设施：${layout.counts.bench} 组条板长椅、${layout.counts.tree} 个树池、${layout.counts.flowerbox} 个绿植箱、${layout.counts.reeds} 个观赏草箱、${layout.counts.lamp} 根灯柱、${layout.counts.bin} 个垃圾桶、${layout.counts.display} 块公共信息屏、${layout.counts.railing} 段新增平台护栏、13 组系泊柱和 13 组救生设施。背景观众 ${Object.entries(layout.counts).filter(([k])=>k.startsWith('spectator-')).reduce((n,[,v])=>n+v,0)} 人，使用四种服装/肤色/手势变体，朝向比赛水道。

观景点位于弯道外侧，前庭按已有建筑入口和沿程分区选择，港湾/工业采用系泊、救生及观赏草组合，桥墩间采用窄型休息点。保持通行带与入口空间。新增公共信息屏有两个独立、正常 UV 的正面，不生成 CP 或赛段悬挂牌。

## 2. 资产、贴地与安全

- 新增街具和观众由 CityFurnishings 的原创曲面/曲线/网格及程序纹理生成，无新增第三方下载模型或授权依赖。复用项目现有已登记的混凝土和金属 PBR 纹理；新增木纹、织物、叶片与公共信息屏纹理均为项目代码生成，尺寸 512 级。
- 站立、挥手的背景观众为轻量角色，没有人群寻路系统。未替换主角或 AI 竞速模型。
- 初始化一次检测建筑、桥墩、既有灯具/花池/棚亭占地；对完整主线、捷径、坡道、飞行和落水包络执行三维避让，并检查九个地面采样点不在合法赛道水域。
- 高架旁不生成无支撑的步道。观景平台有边缘裙板与短桩。样板区原铺装高于全图地面，初始化向下取接触面修正设施高度，避免花箱和人物脚部埋入地面。
- 这些对象只加入环境渲染树，没有注册快艇碰撞体或写入比赛状态。现有建筑/桥梁摄像机避障索引保留。

## 3. 鼠标机制

旧版在内置浏览器捕获请求失败后，显示“按住右键拖动”，实际落入与要求不符的备用交互；已在原试玩窗口复现并保存 before-iab-capture.png。

当前操作：点击游戏画面或“进入鼠标视角”一次，随后直接移动鼠标，**无需按住任何鼠标键**。

- 支持捕获时采用 Pointer Lock 相对位移。Edge 浏览器真实点击后、buttons=0 的移动已验证，移动镜头不改变艇的物理朝向。
- 不支持、拒绝、或请求迟迟无结果时，进入直接移动的窗口兼容模式，同样无需按住鼠标键；界面明确显示窗口边缘限制。内置浏览器实际采用此模式，并使用 buttons=0 的原生浏览器输入验证。
- 只读 HUD 不再阻挡兼容观察；按钮、滑块和触控区域暂停观察，避免操作 UI 时转动。
- Esc 退出并恢复 UI 操作；再次点击可进入。C 平滑恢复默认第三人称，滚轮距离、灵敏度、关闭鼠标观察均保留。失焦/后台释放输入，延迟拒绝不会在退出后重新开启。
- 左右环绕、俯仰限制、镜头水面下限及原有障碍收镜头由既有 FollowCamera 执行，没有重写跟随模型。WASD 仍只负责驾驶。
- 窄 PC 预览窗口的设置面板移至 HUD 下方，手机粗指针布局仍隐藏鼠标设置并保留触控。

## 4. 实际测试

- TypeScript 检查通过；生产 Vite 构建通过。仍有既有的大 bundle 提示，它是构建警告。
- 自动化测试 **145/145** 通过，其中新增三个布局测试覆盖可重复性、六区双岸分布、三维净空、干燥占地、建筑/设施相互避让以及赛道数据不变。
- 浏览器相机测试：实际捕获、buttons=0 横纵移动、拒绝捕获、不支持 API、超时兼容、Esc、重新进入、C、滚轮、关闭模式、只读 HUD、不改变艇朝向及 W/A/S/D 均通过；桥下、S1 隧道和高架观察用例保持避障且高于水面。详细数值见 camera-tests.json。
- 正式生产入口没有 QA Game 钩子；实际键盘 W 行驶显示 103 km/h，S 后降至 0，原生 Esc、重新比赛及触控模拟均通过。真实手机和其他硬件没有专项测试。
- 生产编译的真实 Game.frame 自动驾驶回归，玩家第一圈主线、第二圈 S1、第三圈 S2，${race.steps} 个物理步骤，玩家与四名 AI 均通过 72 个合法门并完赛。${race.launches} 次起跳事件、${race.landings} 次落水事件，氮气/特技继续参与，页面错误为空。为了让全部 AI 完赛，QA 玩家在最后一个门前等待。
- 三圈回归使用真实固定 60Hz 物理与 AI，自动转向输入、每 12 个物理步渲染一次以加速；它验证比赛逻辑，不代表真人全程驾驶或真实 FPS。记录有 ${race.wallHits} 个玩家边界接触步骤，与基线同一脚本一致，不能宣称全程无碰撞。
- 提供十组同位置对照、六区驾驶图、前庭近景、内置浏览器直接移动前后截图及完整赛道逐段截图。截图已实际打开检查，修正了贴地和公共信息屏被外壳遮住的问题。

## 5. 性能实测与未解决限制

静态原型几何/纹理共享，按材质使用 ${layout.batches} 个 BatchedMesh，保留逐对象视锥剔除。观众颜色烘入顶点色以共享布料/肤色材质；焊接完全相同的顶点属性，保留三角形、硬边、UV 和材质；不对不透明街具反复按距离排序。没有每帧创建新设施、贴图或光源。

试验过空间分块与静态展开。前者增加 Draw Calls，后者增加约 350MB 的 JS 快照占用而没有明显提高 GPU 帧率，均未采用。对应原始试验 JSON 保留供复查。最终版维持共享原型，不削减已有建筑、模型、水面、分辨率或可见设施。

设备 RTX 4060 Laptop / ANGLE D3D11，同一 Edge、1600×1000、DPR1、标准画质、五艇、t=12、同相机，生产编译。每个视角预热 120 帧，记录 360 帧；1% Low 取最慢四帧。CPU 为 JS 提交耗时，GPU 使用非 disjoint timer query。Draw Calls 与面数包含反射、选手深度和主画面所有 pass，不只是主视图。

| 场景 | 平均 FPS 前→后 | 1% Low 前→后 | 帧时间 ms 前→后 | CPU ms 前→后 | GPU ms 前→后 | Draw Calls 前→后 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${table}

**仍有性能代价，不能宣称“没有影响”。** 四个固定视角平均 FPS 下降约 5%–10%，GPU 增加约 1–2ms；隧道 1% Low 下降较明显。没有发现持续每帧分配设施或爆发性粒子叠加的问题，但新增可见内容的渲染成本尚未消除，未完全达到“流畅度无明显下降”的目标，需要实际试玩验收。固定视角短测也不能保证全程稳定 60FPS；一次较短的高架样本出现 46FPS，后续较长复测为上表值，说明短样本有波动。

相机现有桥梁/建筑避障用例通过，未观察到新增的自动跟随争抢抖动。未穷举所有自由视角组合；小型背景人物、叶片和细街具没有独立的摄像机精确网格碰撞，需要用户检查极近观察。兼容模式受窗口边缘限制，完整无限相对移动需要浏览器允许 Pointer Lock。

## 6. 主要文件

- src/environment/WaterfrontLayout.ts：功能分区、建筑及三维赛道避让、前庭和窄步道位置。
- src/environment/CityFurnishings.ts：街具、植物、观众、铺装、贴地、共享材质及批次。
- src/environment/CityDensity.ts：加载/释放环境设施接入。
- src/controls/CameraControls.ts、camera-controls.css：直接移动、捕获状态、兼容和窄窗口布局。
- tests/waterfront-layout.test.ts；scripts/qa/life-*.mjs：针对性布局/浏览器/视觉/性能/比赛检查。
- README.md 与旧验收报告：更新当前操作入口，保留历史数据。

驾驶物理、AI、赛道、跳台、碰撞、氮气、特技、音频、比赛实现和 public 美术资源未修改。当前本地试玩 http://localhost:5174/。完成此轮后停止，等待验收。
`);console.log('Report generated from actual results.');

import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const dir='docs/city-quality-repair',read=name=>JSON.parse(readFileSync(`${dir}/${name}`,'utf8'));
const env=read('environment-stats.json').report,before=env.find(r=>r.label==='before'),after=env.find(r=>r.label==='after');
const survey=read('vacancy-layout.json'),performance=read('performance.json'),race=read('full-race/full-drive.json'),production=read('production.json');
const sum=o=>Object.values(o).reduce((s,n)=>s+n,0),number=n=>n.toLocaleString('en-US'),fixed=n=>n?.toFixed(2)??'不可用';
const districts={central:'中央商务区',science:'未来科技区',transit:'高架交通区',industrial:'地下水道与工业区',harbor:'港湾区',leisure:'城市休闲区'};
const types={park:'景观绿地',market:'商业服务点','race-plaza':'观赛广场',maintenance:'维护设施区','transit-court':'交通休息区'};
const civic=after.pockets.filter(p=>p.id.startsWith('civic-')),people=Object.entries(after.counts).filter(([k])=>k.startsWith('spectator-')).reduce((s,[,n])=>s+n,0),trees=['tree','tree-1','tree-2'].reduce((s,k)=>s+(after.counts[k]??0),0);
const runs=performance.results.filter(r=>r.label==='before').map(b=>({b,a:performance.results.find(a=>a.label==='after'&&a.id===b.id)}));
const losses=runs.map(({b,a})=>100*(1-a.fps/b.fps)),loss=`${Math.min(...losses).toFixed(1)}%–${Math.max(...losses).toFixed(1)}%`;
const course=readdirSync(`${dir}/full-race`).filter(f=>/^course-\d+\.jpg$/.test(f)).sort();
const perfRows=runs.map(({b,a})=>`| ${b.id} | ${fixed(b.fps)} → ${fixed(a.fps)} | ${fixed(b.low1)} → ${fixed(a.low1)} | ${fixed(b.frameMs)} → ${fixed(a.frameMs)} | ${fixed(b.cpuMs)} → ${fixed(a.cpuMs)} | ${fixed(b.gpuMs)} → ${fixed(a.gpuMs)} | ${b.calls} → ${a.calls} |`).join('\n');
const districtRows=Object.entries(districts).map(([id,name],i)=>`| ${name} | ${civic.filter(p=>p.district===id).length} | ${after.infill.filter(p=>{const t=((p.angle/(Math.PI*2))%1+1)%1;return t>=([0,.16,.30,.46,.65,.86][i])&&t<([.16,.30,.46,.65,.86,1][i]);}).length} |`).join('\n');
const report=`# 强制修复与全地图环境完善 · 交付记录

本轮基于 Git 检查点 \`city-quality-repair-baseline\`（6338e0e）修改。四项功能已实施并进行了下列运行验证；**不能将此报告等同于用户美术验收通过，也不能宣称没有性能代价。**

[截图与原始数据画廊](index.html) · [本地试玩](http://localhost:5174/) · [完整地图环境分布](after-environment-plan.svg)

## 1. 捷径：已确认的原因与局部修复

### 入口物理判定

原逻辑在比赛系统识别分支之前，先按艇当前主路线夹回主水道；分支允许进入的窗口又仅覆盖前10%/入口附近65m。S1两路线在入口后仍有一段重叠，高速及靠侧进入时，尚未被确认为分支就错过窗口。旧测试预先赋予玩家 routeIntent，会掩盖这一真实手动驾驶情况。

现在仅在**同高度、真实入口/出口**采用连续的相接水道通行范围，分支识别窗口延伸至几何上真正分离的位置，并检查前进方向。分支内仍受本分支边界约束，高低层路线不会被平面并集合并。没有修改全局转向、速度、碰撞响应或中心线路线。

### 护栏/横梁可见阻挡

原生成器通过把 BoxGeometry 护栏/青色压条的 Y 缩放设为0来“移除”分叉口构件，实际仍保留顶底三角形；只检查线段中点还会漏掉入口部分横穿的边界。这些面又没进入 cameraSolids，导致旧的障碍检查遗漏。

现在沿连续边界切分并裁掉与同层合法分支相交的跨度：**被移除的区段不再产生三角形**，其余边界保留；相机避障元数据与真实保留几何一致。高架横梁去除重复生成，并按完整三维通行/飞行净空检查；下穿自身甲板的合法支撑保留，不能借净空检查把整座高架的支撑全删掉。

### 实测结果与边界

- 基线正确出生点复现：18组中S1有5组未能完整获得分支/通过，见 before-model-entry.json；没有使用早期错误测试夹具的结论。
- 实际浏览器、生产编译的真实 Game.frame：两路线 × 40/100/160 km/h × 左/中/右3m，**18组均进入、通过和汇合**，没有给玩家 routeIntent。S1零边界接触；S2高油门窄弯会擦栏并降速，仍能通过，不能称为“160全油门无碰撞”。
- 同一 DrivingModel/Ramps/Race 的预判制动模拟：18组均零边界接触；S1高速接近会降到约100km/h，S2窄弯保守策略最低约33km/h，不需停车/倒车。此项是模型模拟，不冒充浏览器手动试玩。
- 浏览器AI独立使用两条捷径及玩家/AI同时汇合均完成，检查点分别正常推进；并排接触仍保留实体推挤，未关闭碰撞。
- 静态全路线结构扫描剩余1个候选位于S2落差后 q≈0.451：它按“艇贴着下层水面”采样，与主线边栏近接；真实起跳轨迹在其上方。此扫描本身不能证明完整飞行净空，须结合真实通行测试，而不是隐去候选或声称静态扫描零命中。

[两条捷径18组浏览器记录](after-browser-shortcuts.json) · [制动模拟](after-safe-model-entry.json) · [AI及合流](ai-merges.json) · [静态候选](after-structures.json)

## 2. 鼠标自由视角与左下角面板

| 操作 | 实际观察方向验证 |
| --- | --- |
| 鼠标左/右 | 观察方向左/右；按移动前屏幕右向量验证，不以环绕位置代替观察方向 |
| 鼠标上/下 | 向下看/向上看，即垂直反转 |
| 点击画面后移动 | 不需要按住左键或右键，测试事件 buttons=0 |
| Esc | 释放鼠标，恢复UI操作 |
| C | 平滑恢复经典第三人称；首步位置变化约0.099m，没有瞬时跳回 |
| 同时 W/A 与移动鼠标 | 正常加速/转向，用户选择的自由观察方向不被艇朝向覆盖 |

Pointer Lock 仍为主方案。捕获被浏览器拒绝时，直接移动的窗口兼容模式方向相同，但受窗口边缘限制。灵敏度、滚轮、俯仰限制、平滑跟随和避障保留。新增的布局只有紧凑化与设置展开，不改驾驶输入。

控制区移至左下角WASD提示上方；设置向上展开。1920×1080、1366×768、1600×900、1280×720共8个展开/收起布局均检查屏幕边界、按键提示、艇/HUD区域及按钮/灵敏度操作。

[方向/按键记录](camera-tests.json) · [8种布局记录](ui-layout.json)

## 3. 全地图公共空间，而非只增添大楼

沿主线和两条捷径，结合实际生成陆地、六个城区、已有资产占地、三维通行/飞行/落地净空，以5m网格检查水道外115m内可见近中景公共用地；不是随机在整座岛上撒物体。先安排大地块，再填小地块，保留入口与通行缝隙。

- 保留原281处滨水/前庭空间，新增 **${civic.length}处**按功能设计的公共空间，总计${after.pockets.length}处。
- 新增 **${after.buildings-before.buildings}栋**同级样板区GLB中小型建筑，每区8栋；原建筑、样板区及主体路线未移动。
- 环境物体摆放由${number(sum(before.counts))}增至${number(sum(after.counts))}，**新增${number(sum(after.counts)-sum(before.counts))}个**；不把材质子网格或LOD算成独立物体。
- 观众/行人共${number(people)}人，4种烘焙姿态；树木${trees}株、3种冠形和高度变体。不是活动NPC，没有行走寻路或交互逻辑。
- 新的公共构件包括曲顶廊架、商业柜台、草坪岛、绿化岛、维护设备站、公共雕塑；同时扩展长椅、灯柱、信息屏、垃圾桶、花箱、观赏草、救生设施及码头功能点。
- 新增建筑复用样板区的门厅、外立面/屋顶/PBR资产与假室内体系；可布置的服务空间继续接入 CityInteriors。未用纯色方盒替换现有资产。

| 城区 | 新增功能空间 | 新增样板区同级中小建筑 |
| --- | ---: | ---: |
${districtRows}

公共空间类型：${Object.entries(types).map(([id,name])=>name+' '+civic.filter(p=>p.kind===id).length+'处').join('；')}。

原空旷位置的对照覆盖商务广场、科技园绿地、高架交通前庭、工业维护地块、港湾水岸、休闲滨水花园。两侧均补充，不只展示原样板区。

同口径未占用采样面积由${number(survey.before.freeArea)}m²降至${number(survey.after.freeArea)}m²；最大连通空地由${number(survey.before.plots[0].area)}m²降至${number(survey.after.plots[0].area)}m²。**这些数字不是美术完成度评分**：采样仍含步行通道、建筑入口和必须留白的安全缓冲。

已复查全圈${course.length}个沿线驾驶观察点，并公开全部截图。远离水道115m以上的背景陆地不在此次精细铺设范围；部分建筑背后的灰色通行空地仍可见。没有宣称整座城市每平方米已填满。若用户认为这些留白仍过空，需要定位后继续局部调整，不能把本报告当成其美术验收结论。

## 4. 资产来源与精度

- 观众人体使用已保存在仓库的 Blender Human Base Meshes v1.4，GEO-body_male_realistic；随包明确CC0。没有使用旁边另行CC BY授权的Rain角色。
- Blender中制作衣服体积/材料分区、四种自然观赛姿态、鞋/领口/衣缝；源文件 assets/city-public/public-citizens.blend，运行时 public/models/city-sample/public-citizens.glb。
- 每个近景人体主体11,638三角形，另有衣领与边线。布料法线512px。4种姿态共享人体/服装材料体系，皮肤和衣服颜色区分。
- 公共设施、植物、铺装为原创程序网格；植物使用小型立体叶片而不是大张交叉卡片。原样板区混凝土/金属PBR贴图继续共享，新增木材/植物表面512px。
- **没有改变主角/AI的艇、车手资产或水面着色器。**

详细许可及可编辑文件：[资产说明](../../assets/city-public/README.md)。

## 5. 性能：进行了修复，但仍存在代价

最初直接增加观众和树叶使部分测试下降约三分之一到一半，因此没有接受该实现。改为共享硬件实例、精确逐部件视锥剔除、相机独立实例缓冲、只在可见列表改变时上传矩阵、独立阴影投射批次。反射视角不能覆盖主视角缓冲，避免新增水面/设施闪烁。尝试过的深度预通道更慢，最终未启用。

仅对**本轮新背景观众/树叶**采用屏幕误差约束LOD；近景保持完整模型，主角/AI/建筑/水面不降低精度。Blender验证各姿态双向顶点到表面误差，误差上界投影小于0.9物理像素才切观众档位，叶片小于0.6像素。树叶数量保持不变。

实际同视角1600×1000全精度与此LOD截图，平均RGB字节差约0.004/255；任一通道差大于8的像素占比约0.02%。这是两处正常游玩距离的实测，不保证任意放大下完全相同。

性能测试：Edge / RTX 4060 Laptop / 1600×1000 / DPR1 / 标准画质；同一五艇布局、相机、FOV52、t=12，生产编译私有测试入口；120帧预热+360帧记录。CPU列仅JS提交耗时，GPU列来自非disjoint计时查询。1%Low使用最慢4帧均值。绝非整圈平均或人工体验帧率。

以下是最后一次完整的同条件对照，发生在最终“甲板下支撑净空”小修正之前。该修正后的功能/比赛/构建均已重跑。尝试再次补测最终构建时，未修改基线也从53.23FPS降至17.58FPS，GPU使用率98%，同时有其他3D程序运行；无法隔离其贡献，因此停止补测，不将其作为有效前后对比。**精确最终构建的隔离负载性能复测尚未完成。** 原始记录见 performance-repeat-notes.json。

| 场景 | FPS 前→后 | 1%Low 前→后 | 帧时ms 前→后 | CPU提交ms 前→后 | GPUms 前→后 | Draw Calls 前→后 |
| --- | --- | --- | --- | --- | --- | --- |
${perfRows}

**新增环境后仍有${loss}的FPS损失**；部分视角未达60FPS。瓶颈仍含GPU几何/阴影/反射绘制及CPU实例准备，没有证据支持“水面是唯一原因”。本轮不降低已有画质来掩盖代价，也不声称性能验收无条件通过。应由用户在实际窗口确认是否可接受。

[原始性能、三角形及资源数](performance.json) · [补测中止说明](performance-repeat-notes.json) · [LOD前后测量](prop-lod-profile.json) · [像素对照](lod-pixel-comparison.json)

## 6. 实际验证与主要文件

### 技术检查

- TypeScript：\`node node_modules/typescript/bin/tsc --noEmit\`，通过。
- 自动化：\`node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts\`，**157/157通过**；原始输出见 [test-results.txt](test-results.txt)。
- 生产构建：\`node node_modules/vite/bin/vite.js build\`，通过；Three.js分包大于500k的体积提示仍存在，不是构建错误。
- 结构净空、自然入口/分支、保留甲板支撑、鼠标最终方向、公共地块避让、镜面独立实例及阴影投射等都有针对性回归。
- 真实生产网页黑盒：无QA全局注入，W加速至${production.accelerated}km/h、S减速至${production.braked}、Pointer Lock/Esc、设置、重赛倒计时${production.reset?'均通过':'待确认'}，pageerror为空。
- 真实浏览器真实Game.frame自动驾驶：三圈、玩家第二圈S1/第三圈S2，**全部5艇均72个检查点并完赛**；phase=${race.phase}，两分支都访问。用自动驾驶输入及固定物理步长加速回归，**不是人工连续实况试玩，也不是性能测量**。另有两捷径AI/同时合流测试。
- 连续赛道截图覆盖${course.length}个观察点，六区对照固定画质/相机/水面时间。普通生产入口截图也单独提供，避免用调试画面代替可玩版本。

### 修改文件分组

| 文件 | 作用 |
| --- | --- |
| src/track/CityTrack.ts | 物理入口范围与合法路线识别的顺序/窗口修复 |
| src/track/CanalBanks.ts、CityTrackView.ts | 连续裁剪真实护栏网格，清除零厚度面 |
| src/track/VerticalTrackView.ts、TrackClearance.ts | 横梁唯一生成、三维净空与甲板下安全支撑 |
| src/camera/FollowCamera.ts | 水平观察方向符号修复，保留反转Y与跟随 |
| src/controls/CameraControls.ts、camera-controls.css | 左下紧凑布局和展开设置，保持输入功能 |
| src/environment/CityVacancy.ts、WaterfrontLayout.ts、WorldCityLayout.ts | 全圈空地采样、功能地块、同质量小建筑 |
| CityFurnishings.ts、PublicCitizens.ts、StaticPropInstances.ts | 公共资产、人体、实例化/反射/阴影一致性 |
| CityDensity.ts、CitySample.ts、CityInteriors.ts | 资源加载、渲染前更新与已有室内接入 |
| assets/city-public、public/models/city-sample/public-citizens.glb | 可编辑Blender文件、授权、运行时观众 |
| scripts/art/build-city-public.py、validate-city-public.py | 可重建资产及实测LOD表面误差 |
| tests/shortcut-repair.test.ts、mouse-direction.test.ts、city-public.test.ts、static-prop-instances.test.ts | 本轮针对性测试 |
| scripts/qa/quality-*.mjs / .ts | 浏览器、分区、空地、比赛、性能及本报告的可复查脚本 |

保护检查：对检查点版本比较 src/player、src/ai、src/physics、src/effects、src/race，无源文件差异。无CP悬挂路牌重新生成，无部署。

### 重现说明

浏览器QA使用现有 \`scripts/qa/build-vertical.mjs\`，私有测试页服务5177；冻结基线6338e0e的对应生产编译页5182；普通dist预览5174。先准备这些服务，再分别运行 quality-shortcuts、quality-camera、quality-ui、quality-ai-merges、quality-environment、quality-full-race、quality-performance、quality-production 脚本。性能与其他重浏览器任务不要同时运行。

\`quality-entry-probe.ts before\`需先把6338e0e的CityTrack.ts放入忽略目录 .qa/baseline-CityTrack.ts，并将相对导入改至当前src；仅供复现入口差异。当前入口模拟可直接运行 \`node node_modules/tsx/dist/cli.mjs scripts/qa/quality-entry-probe.ts after --safe\`。

## 7. 尚需用户试玩确认

1. S1实际选线手感、S2窄弯制动强度与氮气接近时机；没有把窄捷径改成任意极速直线。
2. 六区公共空间的自然程度；仍有通行/安全留白与远背景空地，不宣称全图美术绝对达标。
3. 新增环境后${loss}的实测帧率代价是否影响当前设备体验；没有稳定60FPS承诺。最终支撑小修后的隔离负载补测因共享GPU负载异常中止，不能宣称已经完成最终性能验收。
4. 自动浏览器回归不能替代用户长期手动驾驶、任意自由视角与特殊撞击组合。没有发现新的pageerror/无法完赛问题，但不能保证所有未覆盖组合无穿模。

本轮不扩展新玩法、不部署、不进入手机专项。实施及可重复验证到此，等待实际试玩验收。
`;
writeFileSync(`${dir}/README.md`,report);
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const figure=(file,title)=>`<figure><a href="${file}" target="_blank"><img loading="lazy" src="${file}" alt="${esc(title)}"></a><figcaption>${esc(title)}</figcaption></figure>`;
const pair=(a,b,title)=>`<h3>${title}</h3><div class="grid">${figure(a,'修改前 · 相同观察位置')}${figure(b,'修改后 · 相同观察位置')}</div>`;
const links=['after-browser-shortcuts.json','after-safe-model-entry.json','ai-merges.json','camera-tests.json','ui-layout.json','vacancy-layout.json','environment-stats.json','performance.json','performance-repeat-notes.json','lod-pixel-comparison.json','production.json','full-race/full-drive.json','test-results.txt'];
writeFileSync(`${dir}/index.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>极速水城 · 修复与整图环境验收</title><style>
*{box-sizing:border-box}body{margin:0;background:#0e202a;color:#e3edf0;font:16px/1.7 system-ui,sans-serif}main{max-width:1600px;margin:auto;padding:32px}h1{font-size:32px;line-height:1.3}h2{margin-top:52px}p{max-width:1150px;color:#b8ccd5}a{color:#8ce2d3}nav{display:flex;gap:18px;flex-wrap:wrap}figure{margin:0;background:#183541;border:1px solid #345562;border-radius:8px;overflow:hidden}figure img{display:block;width:100%;height:auto}figcaption{padding:10px 14px;font-size:14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:16px 0}.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.notice{border-left:4px solid #e4b966;padding:14px 18px;background:#273536}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:10px;border:1px solid #345562;text-align:left}.table{overflow:auto}summary{cursor:pointer;color:#8ce2d3}@media(max-width:900px){main{padding:18px}.grid,.gallery{grid-template-columns:1fr}h1{font-size:26px}}
</style><main><h1>捷径修复 / 正确鼠标视角 / 左下UI / 全圈公共空间</h1>
<nav><a href="http://localhost:5174/">进入本地游戏</a><a href="README.md">完整交付报告</a><a href="#shortcuts">捷径</a><a href="#camera">视角与UI</a><a href="#districts">六区对照</a><a href="#lap">整圈检查</a><a href="#performance">性能与限制</a></nav>
<p>实际浏览器截图。分区前后对比为相同相机、1600×1000、DPR1、标准画质、FOV52、水面时间t=12。定点对照用于画质检查，不冒充连续比赛性能。</p>
<p class="notice">四项改动已实施并测试。性能仍有${loss}的FPS下降，部分镜头不到60FPS；S2窄弯需制动；通行安全留白及远背景空地仍存在。此页完整呈现这些限制，不代表用户已认可美术或性能。</p>
<section id="shortcuts"><h2>1 / 捷径入口阻挡前后</h2><p>真正移除零高度护栏残留面，连续裁剪分叉口边界；修复玩家无routeIntent时的自然入口识别。保持快艇碰撞与路线高度。以下入口前后严格使用相同位置。</p>
${pair('before-s1-obstruction.jpg','after-tunnel-cut-entry.jpg','S1 地下捷径入口')}${pair('before-s2-obstruction.jpg','after-harbor-cut-entry.jpg','S2 高架捷径入口 · 青色交叉残留面消除')}
<div class="gallery">${['tunnel-cut','harbor-cut'].map((id,i)=>['inside','exit'].map(kind=>figure(`after-${id}-${kind}.jpg`,`S${i+1} ${kind==='inside'?'内部通行':'出口汇合'}`)).join('')).join('')}${figure('tunnel-cut-ai-complete.jpg','S1 · AI正常驶出')}${figure('harbor-cut-ai-complete.jpg','S2 · AI正常驶出')}${figure('tunnel-cut-simultaneous-merge.jpg','S1 · 玩家/AI同时合流')}${figure('harbor-cut-simultaneous-merge.jpg','S2 · 玩家/AI同时合流')}</div>
<p>18组浏览器速度/左右接近均通过。S1无边界接触；S2固定高油门会擦栏，合理预判制动的18组物理模拟无边界接触。没有关闭实体碰撞来换通行。</p></section>
<section id="camera"><h2>2 / 移动鼠标即可观察，垂直反转</h2><p>左移左看，右移右看，上移下看，下移上看。不按住任何鼠标键；Esc退出，C平滑归位，WASD独立驾驶。Pointer Lock和被拒绝后的窗口兼容模式均验证。</p>
<div class="grid">${figure('ui-1920-1080.png','1920×1080 · 左下紧凑控制，WASD提示在下方')}${figure('ui-1366-768-expanded.png','1366×768 · 设置向上展开，灵敏度可操作')}</div>
<details><summary>其余桌面布局</summary><div class="grid">${['1920-1080-expanded','1366-768','1600-900','1600-900-expanded','1280-720','1280-720-expanded'].map(id=>figure(`ui-${id}.png`,id)).join('')}</div></details></section>
<section><h2>3 / 全圈分区公共空间与原空地</h2><p>新增${civic.length}处功能空间、${after.buildings-before.buildings}栋样板区同级中小建筑，环境摆放新增${number(sum(after.counts)-sum(before.counts))}个。观众总${number(people)}人、树木总${trees}株。所有新增地块使用实际陆地、建筑占地和三维赛道/飞行避让。</p>
${pair('before-environment-plan.svg','after-environment-plan.svg','整图分布与剩余空地 · 六个城区全部公开')}
${pair('environment/before-whole-map.jpg','environment/after-whole-map.jpg','完整城市同视角概览')}</section>
<section id="districts"><h2>六个城区 · 驾驶视角与原空地逐区对照</h2>${Object.entries(districts).map(([id,name])=>`<h3>${name}</h3><div class="grid">${figure(`environment/before-${id}-driver.jpg`,'驾驶视角 · 修改前')}${figure(`environment/after-${id}-driver.jpg`,'驾驶视角 · 修改后')}${figure(`environment/before-${id}-${{central:'plaza',science:'park',transit:'court',industrial:'yard',harbor:'wharf',leisure:'garden'}[id]}.jpg`,'空地 · 修改前')}${figure(`environment/after-${id}-${{central:'plaza',science:'park',transit:'court',industrial:'yard',harbor:'wharf',leisure:'garden'}[id]}.jpg`,'空地 · 修改后')}</div>`).join('')}</section>
<section><h2>新增人群、绿地、商业与维护空间</h2><p>人体为CC0真实比例基础网格的四种静态姿态；设施为原创共享网格；小建筑继续使用完整样板区GLB/PBR及已有假室内，不替换成低质量方盒。人群不是活动NPC。</p><div class="grid">${figure('environment/crowd-close.jpg','观赛广场 · 人群/座椅/信息屏/公共艺术')}${figure('environment/green-close.jpg','公园与前庭 · 绿地、三类立体树冠与休闲设施')}${figure('environment/market-close.jpg','商业水岸 · 曲顶廊架与服务柜台')}${figure('environment/service-close.jpg','港口维护 · 设备和救生功能点')}${figure('environment/transport-close.jpg','交通前庭 · 休息点及导视')}${figure('full-race/central-interior.jpg','同级小建筑与沿用的可见室内层次')}</div></section>
<section id="lap"><h2>4 / 全圈连续检查，不只挑选好看的区域</h2><p>实际浏览器真实Game.frame，用转向/油门/制动输入自动驾驶。玩家两条捷径都使用，全部5艇完成三圈，均72个检查点。不是人工全程驾驶。以下公开全部${course.length}个沿线观察点；某些非赛道背景灰地、通行空隙仍然可见。</p>
${figure('full-lap-contact.jpg','整圈驾驶联络图 · 点击查看大图')}<details><summary>展开全部沿线原始截图</summary><div class="gallery">${course.map(f=>figure(`full-race/${f}`,f)).join('')}</div></details>
<div class="grid">${figure('full-race/race-result.jpg','玩家与4名AI三圈结果')}${figure('live-driving.jpg','普通生产网页 · 真实键鼠驾驶，无QA全局接口')}</div></section>
<section id="performance"><h2>5 / 性能实测与未消除的代价</h2><p>Edge / RTX 4060 Laptop / 1600×1000 DPR1标准画质，同五艇布局、时间和相机。每视角预热120帧+记录360帧；GPU是可靠的非disjoint查询。这里是固定视角渲染性能，不是比赛平均FPS。</p><div class="table"><table><thead><tr><th>视角</th><th>FPS前→后</th><th>1%Low前→后</th><th>帧时ms前→后</th><th>DrawCalls前→后</th></tr></thead><tbody>${runs.map(({b,a})=>`<tr><td>${b.id}</td><td>${fixed(b.fps)} → ${fixed(a.fps)}</td><td>${fixed(b.low1)} → ${fixed(a.low1)}</td><td>${fixed(b.frameMs)} → ${fixed(a.frameMs)}</td><td>${b.calls} → ${a.calls}</td></tr>`).join('')}</tbody></table></div>
<p>用共享硬件实例、反射独立缓冲、精确剔除和新背景资产的亚像素LOD，消除了最初严重的新增开销，但仍有${loss}的FPS代价。没有降低主角、AI、水面或建筑精度/纹理/渲染分辨率。若该代价影响用户体验，不能称性能验收已通过。</p><p class="notice">上表对照在最后的甲板下支撑小修之前完成。最终功能回归已重跑，但性能补测发现旧基线也显著变慢（53.23→17.58FPS，GPU98%，有其他3D程序运行），无法隔离负载，已停止而未覆盖原有效数据。精确最终构建的隔离性能补测尚未完成。</p>
<details><summary>全几何与亚像素LOD同视角画面对照</summary>${pair('lod-0.06-false.png','lod-0.06-true.png','城市视角 · 新公共资产全几何 / 亚像素LOD')}${pair('lod-0.535-false.png','lod-0.535-true.png','工业视角 · 新公共资产全几何 / 亚像素LOD')}</details></section>
<section><h2>验证证据与限制</h2><p>TypeScript、157项自动化、生产构建通过。新增内容以PC测试为主，没有进行手机专项或部署。S2窄弯要刹车，观众是静态姿态，远背景用地未精细铺满，任意自由视角或碰撞组合仍需用户试玩。完整细节见报告。</p><ul>${links.map(f=>`<li><a href="${f}">${f}</a></li>`).join('')}</ul></section></main></html>`);
console.log({report:`${dir}/README.md`,gallery:`${dir}/index.html`,courseFrames:course.length,loss});

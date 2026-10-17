import{readFileSync,writeFileSync,existsSync}from'node:fs';
const dir='docs/view-loading-water/',read=name=>JSON.parse(readFileSync(dir+name,'utf8')),perf=read('performance.json'),browser=read('browser.json'),production=read('production.json'),race=read('full-race/full-drive.json'),water=read('water-pixel-proof.json'),resources=read('resources.json'),extra=read('camera-extra.json');
browser.boot=read('boot-smoke.json').r;
const f=(n,d=2)=>Number(n).toFixed(d),pairs=perf.results.filter(r=>r.label==='before').map(a=>({a,b:perf.results.find(b=>b.label==='after'&&b.id===a.id)}));
const rows=pairs.map(({a,b})=>`| ${a.id} | ${f(a.fps)} → ${f(b.fps)} | ${f(a.low1)} → ${f(b.low1)} | ${f(a.frameMs)} → ${f(b.frameMs)} | ${f(a.cpuMs)} → ${f(b.cpuMs)} | ${f(a.gpuMs)} → ${f(b.gpuMs)} | ${a.calls} → ${b.calls} | ${f(a.triangles/1e6)} → ${f(b.triangles/1e6)} |`).join('\n');
const log=browser.boot.log.map(r=>`| ${r.task} | ${r.percent}% | ${f(r.elapsedMs/1000,3)}s |`).join('\n');
const report=`# 远景、启动、水面与自由视角验收报告

基线：Git 标签 \`view-loading-baseline\`，提交 \`c571d2e\`。本轮只修改渲染与镜头相关实现；驾驶、AI、碰撞、氮气、特技、赛道数据、比赛和音频源码对该基线无差异，public/assets 资源文件未改动。没有部署。

[对照截图与动态录像](index.html) · [性能原始数据](performance.json) · [资源清单](resources.json) · [浏览器记录](browser.json) · [正式入口与触控回归](production.json) · [备用鼠标与 A/D/S](camera-extra.json)

## 1. 建筑细节距离

确认原因：城市 GLB 在启动时整体加载，不是沿路线分区临时下载。原标准 LOD 的 near=125m、far=290m，另有原样板区 skyline 强制远层；假室内在95–175m淡出。远裁剪面2200m和每实例视锥剔除并非这次细节突然出现的主因。

- PC 标准：near **375m**、far **800m**，滞回35m。向建筑接近时 <340m 进入完整层，离开时到410m再退到中层；远层接近765m才回中层，离开835m才进远层。不是额外隐藏建筑。
- PC 的原样板区天际线也按距离使用完整资产；大型地标本来就是完整精度，继续保留。
- 标准玻璃假室内260–480m平滑淡出；真实浅室内内容范围115m→240m。低画质保留95–175m假室内淡出以及原70/210m几何策略；原样板区低画质 skyline 仍用远层。
- 同一建筑每时刻只绘制一个几何层，避免重叠透明过渡或历史残影。仍有远距离离散 LOD，不能保证放大观察时完全看不到切换。
- [接近过程坐标与LOD记录](approach.json)、前后各10张连续画面及两段录像均在图库。固定相机、t=12、标准/低画质广角对照也已保存。

## 2. 正式启动加载

入口先绘制加载界面，再动态导入Game并建立场景。进度显示“完成任务数/9”，不是下载字节百分比，也不是按时间伪造。资源和必要GPU准备完成前主循环不推进物理或比赛；完成后重新建立比赛倒计时。

实际预加载：5份GLB、37份外部快艇/车手贴图，共 **${f(resources.downloadedBytes/1024/1024)} MiB** 本地资源；城市GLB内嵌PBR贴图。五艘艇共享模型几何/图片，各自保留配色和骨骼。另在本地构建全赛道、城市批次、程序化水面/法线、玻璃与广告图集、粒子缓冲、HDR反射和深度目标。逐一初始化场景贴图；城市探针和五艘艇局部阴影先运行，compileAsync包含暂时可见的氮气喷射器，随后完成首帧渲染。

这批资产本来就很大，本轮没有压缩或降精度。本机私有生产测试的任务阶段约${f(browser.boot.log.at(-1).elapsedMs/1000)}秒；正式完整冷/热启动时间受缓存、PNG解码和驱动编译影响。性能测试的导航到就绪时间见原始JSON；旧版本没有同等就绪门槛，不能将两者直接解释为加载速度对比。

| 完成任务 | 进度 | 自加载屏创建起 |
|---|---:|---:|
${log}

就绪时比赛倒计时=${browser.boot.countdown}，已建立${browser.boot.programs}个Three.js程序缓存项（含反射/深度变体，不代表只有这么多模型）。资源等待120秒、Shader异步预热90秒超时会显示失败。GPU同步驱动调用期间仍可能暂时占用主线程，进度不会虚假前进。

实际注入rider.glb 404：显示错误与重试按钮，比赛计时保持00:00.00；解除404并点击重试后正式入口正常加载。重试采用整页重载，清除失败状态。生产入口没有window.testGame等私有QA钩子。

## 3. 水面频闪：已复现的原因和修复

确认一个实际问题：在人工坡道与普通水面交界，抬升水皮和底层海面同时覆盖相同像素。两者虽然使用同一四层波动方程，但网格密度不同，插值波形并不一致，低坡段会反复交换深度。A区2秒数学采样记录29–31次上下交换，最大穿插约1.8cm；C区入口也记录到交换。不能把所有偶发闪烁一概归因于这一点。

进一步做实际GPU读回：仅在QA中把底层水染红、坡面染绿，保持原位移、深度与动画。A区入口132个三角中心、120帧：

| 指标 | 修复前 | 修复后 |
|---|---:|---:|
| 坡面内部被底层水覆盖的红色样本 | ${water.results[0].redUnderlay} | ${water.results[1].redUnderlay} |
| 红/绿覆盖切换次数 | ${water.results[0].colourFlips} | ${water.results[1].colourFlips} |

修复：主渲染启用模板缓冲；抬升水面先写入精确像素覆盖，基础水面跳过这些像素。没有粗糙世界空间遮罩，没有删掉水层、波浪或反射。两份水材质共用原Uniform和Shader；首个水面绘制先完成本次相机的反射更新，避免坡面先画时使用上一帧矩阵。每视图仅准备一次反射。

保留原320段水网格、256²多级法线谱、四层位移、双层滚动法线、1024²反射、五次反射采样、Fresnel、全部尾浪和水花。没有加入运动模糊。数学诊断和红绿截图仅用于定位，不是正式游戏美术。

普通水面、A入口、A高架、B入口、C入口、S2坡道各连续运行90帧动态水面；另有前后接近录像和完整赛道运行。当前复现的交界频闪已消除；其他设备、极端视角或长时间运行中的其他闪烁尚不能保证全部排除。

## 4. 鼠标自由第三人称

- 点击游戏画布：Pointer Lock；鼠标直接环绕，左右不限周数，俯仰约2.6°–71.6°；Esc释放，再点击重捕获。
- 不支持或被拒绝时：按住右键拖动。备用路径使用pointermove，避免取消pointerdown后Chromium不再发兼容mousemove的问题；已实际验证右拖横纵两方向均改变角度。
- 滚轮控制基础距离偏移−5m到+12m，实际环绕半径限制5–28m；保留速度/氮气拉远和原FOV公式。禁止滚动网页。
- C及设置按钮平滑回到经典跟随，恢复默认距离；关闭鼠标视角后保持经典行为。HUD新增启用、灵敏度25%–200%及恢复按钮。Esc退出后WASD状态清空，避免粘键。
- 自由方向使用世界yaw，不被快艇转向或特技视觉旋转覆盖。跟随快艇位置和真实飞行高度；水面最低高度有保护。
- 摄像机独立空间索引覆盖建筑、原样板地标、分开的桥墩/桥面、隧道顶板与侧壁、岸边护栏和坡道支撑。沿艇到镜头的路径做扩张包围体检测，遇阻缩短，解除后用原平滑系数恢复。该索引不参与快艇碰撞。
- 建筑避让采用保守体积而不是逐三角精确曲面，凹面建筑/桥拱附近可能提前收镜头。没有声称实现完整电影级摄像机系统。

实测：真实鼠标Pointer Lock、横纵移动、跨越360°、C、原生Esc、滚轮、关闭模式、右键备用路径、W加速、A/D转向、S刹车、Shift消耗氮气、合法跳跃与特技落地奖励、HUD重新比赛均正常。鼠标操作不写入DrivingModel。桥下、隧道、高架侧向观察未检测到穿入已索引障碍；复杂曲面仍需用户实际观察验收。

触控模拟：pointer:coarse，低画质、触控按钮存在，鼠标设置隐藏，保留经典跟随。尚未进行真实手机专项测试。

## 5. 性能：保留画质后的实际代价

${perf.method}

GPU：${perf.results[0].renderer}。下面Draw Calls与三角数包含主画面、反射及局部阴影等全部Pass；不是单一主画面的数值。CPU为JS渲染提交耗时，不是完整操作系统主线程归因；GPU为EXT计时查询中非disjoint样本，仍受系统负载和驱动调度影响。短样本1% Low波动较大，不能据此宣称长期稳定帧率。没有同时运行其他QA浏览器测性能。

| 场景 | 平均FPS 前→后 | 1% Low 前→后 | 帧ms 前→后 | CPU ms 前→后 | GPU ms 前→后 | Calls 前→后 | 三角数百万 前→后 |
|---|---:|---:|---:|---:|---:|---:|---:|
${rows}

这轮目标是延长细节距离，不能声称平均FPS提升或稳定60FPS。没有降低分辨率、模型精度、贴图或水面质量。原始JSON还记录了Three.js几何/纹理计数与JS堆；未可靠测量专用显存字节数。几何模型、材质纹理文件和城市布局未改变，可见变化是更远处的高精度立面和室内内容。

## 6. 回归与交付范围

- TypeScript检查、生产构建通过；自动化测试142/142通过，包括新增6项启动/镜头/覆盖约束测试。
- 真实生产编译Game.frame以60Hz物理执行${race.steps}步：玩家与四名AI均72个顺序检查点、三圈结束；玩家通行S1、S2，结算、有限氮气和特技仍工作。截图见full-race，浏览器错误列表为空。
- 完整比赛使用自动转向/刹车输入，QA为加速执行每12物理步渲染一次。这验证真实比赛状态，不是逐帧人工驾驶或性能数据。记录到${race.wallHits}个玩家边界接触物理步，不能将其描述为完美无擦边驾驶。
- 另有正常逐帧鼠标与键盘驾驶、水面动画、正式入口404重试和触控模拟；浏览器脚本与JSON均可复查。
- 主要实现：src/environment/CityDensityLayout.ts、CityDensity.ts、CityGlass.ts、CityInteriors.ts、CitySample.ts；src/core/BootProgress.ts、Game.ts、src/main.ts、src/ui/LoadingScreen.ts；src/effects/Water.ts；src/camera/FollowCamera.ts、CameraObstacles.ts、src/controls/CameraControls.ts及样式。CityDistricts/CityTrackView/VerticalTrackView只补充摄像机用的静态体积元数据，未改路线与物理。

## 待用户试玩验收

请重点体验鼠标灵敏度、C归位速度、狭窄隧道收镜头是否舒服；检查中远景切换是否仍明显，并在曾频闪的位置长时间驾驶观察。较低性能GPU可能无法同时满足更远高精度与原帧率；本轮没有用画质下降掩盖代价。实际手机、其他GPU/浏览器和更长时间稳定性尚未专项验证。完成本轮后停止，等待验收。
`;
writeFileSync(dir+'README.md',report);
const image=(file,title)=>`<figure><a href="${file}"><img loading="lazy" src="${file}" alt="${title}"></a><figcaption>${title}</figcaption></figure>`;
const pictures=[['loading.png','真实任务加载屏'],['loading-failure.png','资源404与重试'],['camera-side.png','鼠标侧向观察'],['camera-fallback.png','右键备用拖动'],['camera-driving-nitro.png','自由镜头下键盘驾驶与氮气'],['camera-air-trick.png','真实腾空，镜头保持直立'],['water-flat.png','普通水面'],['water-slope-A.png','坡道入口'],['water-deck-A.png','高架水面'],['water-slope-B.png','B区衔接'],['water-slope-C.png','C区衔接'],['water-S2-ramp.png','S2坡面'],['after-low-distance.png','低画质距离策略保持'],['full-race/race-result.png','玩家与4名AI全部三圈完赛']];
const table=`<table><thead><tr><th>场景</th><th>平均FPS</th><th>1% Low</th><th>CPU ms</th><th>GPU ms</th><th>Calls</th></tr></thead><tbody>${pairs.map(({a,b})=>`<tr><td>${a.id}</td><td>${f(a.fps)} → ${f(b.fps)}</td><td>${f(a.low1)} → ${f(b.low1)}</td><td>${f(a.cpuMs)} → ${f(b.cpuMs)}</td><td>${f(a.gpuMs)} → ${f(b.gpuMs)}</td><td>${a.calls} → ${b.calls}</td></tr>`).join('')}</tbody></table>`;
writeFileSync(dir+'index.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>极速水城｜远景、加载、水面与自由视角验收</title><style>body{margin:0;background:#071721;color:#d7eaf2;font:15px/1.8 system-ui}main{max-width:1450px;margin:auto;padding:35px}h1{font-size:32px;color:#a2f6ee}h2{margin-top:48px}a{color:#79dce9}p{max-width:1050px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:18px}figure{margin:0;background:#102e3d}img,video{width:100%;display:block}figcaption{padding:9px 14px;font-size:13px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:10px;border-bottom:1px solid #37515e;text-align:left}.compare{position:relative}.compare img{width:100%;display:block}.compare .over{position:absolute;inset:0;clip-path:inset(0 50% 0 0)}input[type=range]{width:100%}.note{border-left:3px solid #74d4cf;padding:12px 20px;background:#11303e}.steps{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.steps figure{font-size:11px}.steps figcaption{padding:4px}@media(max-width:700px){main{padding:15px}.grid{grid-template-columns:1fr}.steps{grid-template-columns:repeat(2,1fr)}table{font-size:10px}}</style><main><small>VELOCITY / WATER CITY · LOCAL REVIEW</small><h1>远景、启动加载、水面与自由视角</h1><p>本页是本轮实测证据，不是新游戏UI。<a href="README.md">完整报告</a> · <a href="browser.json">浏览器记录</a> · <a href="resources.json">资源清单</a> · <a href="performance.json">性能原始数据</a></p><div class="note">高精度125m→375m；中等细节290m→800m。9项真实加载任务。坡面覆盖诊断：126个错误红色样本→0，18次覆盖切换→0。玩家与四名AI完成三圈。尚需用户对镜头手感、长期闪烁与设备帧率验收。</div><h2>同视角远景对照：拖动滑条（左为修改后）</h2><div class="compare"><img src="before-city-distance.png"><img class="over" id="overlay" src="after-city-distance.png"></div><input type="range" min="0" max="100" value="50" oninput="document.getElementById('overlay').style.clipPath='inset(0 '+(100-this.value)+'% 0 0)'" aria-label="前后对比"><div class="grid">${image('before-city-driver.png','修改前 · 固定相机 / 水面t12')}${image('after-city-driver.png','修改后 · 相同画质 / 分辨率 / 相机 / t12')}</div><h2>连续接近：原物理逐帧行驶</h2><div class="grid"><figure><video controls preload="metadata" src="video/before-continuous-approach.webm"></video><figcaption>基线：包含启动与驾驶</figcaption></figure><figure><video controls preload="metadata" src="video/after-continuous-approach.webm"></video><figcaption>修改后：包含加载与驾驶</figcaption></figure></div><div class="steps">${Array.from({length:10},(_,i)=>image('after-approach-'+i+'.png','接近帧 '+i*30)).join('')}</div><h2>操作、加载与水面</h2><div class="grid">${pictures.map(([file,title])=>image(file,title)).join('')}</div><h2>动态浏览器验证录像</h2><video controls preload="metadata" src="video/browser-dynamic.webm"></video><p>录制含鼠标操作、六处动态水面以及合法跳跃/特技；独立的备用右拖与A/D/S验证见camera-extra.json。红绿诊断只改QA颜色，不是正式水面。</p><div class="grid">${image('before-water-coverage-diagnostic.png','修复前：绿色坡面被红色底层覆盖')}${image('after-water-coverage-diagnostic.png','修复后：精确覆盖互斥，不压平波纹')}</div><h2>同条件性能，不能据此承诺稳定60FPS</h2>${table}<p>1600×1000 DPR1，RTX4060 Laptop，Edge/ANGLE D3D11；完整多Pass计数，所有采样保留。画质距离增加带来实际开销，详见报告限定条件。未降低内部渲染分辨率、模型、贴图或水面质量。</p></main></html>`);
console.log('Report and gallery generated.');

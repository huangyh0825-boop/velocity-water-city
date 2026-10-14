# 城市密度与空间层次验收 · 2026-10-15

保护点：`city-density-baseline`（b461d46）。原280m精细水岸样板、赛道长度/路线、检查点、玩家/AI物理、速度、氮气、跳台、特技、碰撞和比赛均未改。原三栋标志建筑、桥梁、水岸PBR和光照保留。

## 为什么之前像几个建筑模型

样板原有3栋主建筑、3个额外远景轮廓，商业/设施虽然有细节，但缺少连续街区。原高楼之间的大块空地、视线前方的天空、相近的建筑高度与缺少低层园区，使驾驶画面难产生城市规模感。此次增加场景密度与类型，没有继续雕刻原三栋主楼。

第一轮增加60处布局，截图仍发现远景集中在两侧、被主楼遮挡、前方空旷。因此进一步加入前后视野的天际线背景，并在塔楼之间补充低层科技/商业园区，而非只按数量验收。

## 实际新增的模块库与布局

模块是原创Blender资产，使用曲面截面、网格挤出、开孔环形庭院、倒角、优化法线、UV和已有PBR，不是新增大量BoxGeometry。模型与碰撞系统分离。

| 模块 | 新布局数量 | 造型与用途 |
|---|---:|---|
| spindle_office | 22 | 渐缩曲面办公塔楼、竖肋、屋顶设备和入口 |
| split_office | 19 | 非对称双塔、不同高度、空中连接与冠部 |
| terrace_residence | 19 | 多层退台住宅、阳台、裙房和屋顶机组 |
| research_campus | 7 | 开孔中庭、环形研究楼、庭院平台 |
| data_centre | 8 | 数据/能源设施、斜屋顶、侧面散热肋与排风口 |
| retail_hub | 6 | 曲面商业中心、悬挑雨棚、玻璃大厅和上层露台 |
| transit_station | 3 | 架空车站、拱形罩棚、升降核心和支撑 |
| drydock_service | 4 | 维修船坞、作业平台、吊具与系缆设备 |

共 **88处新增建筑布局**（不把窗框、灯杆或标牌计成建筑）：水岸8、中景街区28、远景52。中景包含三排不同用途街区；远景使用三种塔楼轮廓，改变高度/横向尺度、颜色和朝向，形成遮挡与高度变化。保留原近景灯具、桥、维护设备等。

精细近景/中景仍限制在原280m样板的沿线范围。为填补驾驶视线和起点方向的空白，**远景背景在样板前后各形成低成本城市轮廓，背景占地沿线范围约±340m**；没有延长水道、创建新路线或把精细区域铺到整张4.75km地图。背景地面仅承托这些建筑，仍避开所有合法水道。

新增8块功能/城市宣传屏，共用一张1024×1024 Canvas图集。屏幕文字与建筑用途匹配，复用独立正反面的ReadableSign，UV仅裁到对应图集格；新增车站连接梁/步道接入原架空轨道，均在岸侧。

布局采用沿原路线的确定性街区排布，预留已有主楼、桥墩、商铺、平台；使用有向矩形占地检测避免互相穿插，并用全赛道投影约束避免遮住合法水面。不是随机散放建筑。

## 模型与文件

- 原创建模脚本：`scripts/art/build-city-modules.py`。
- 可编辑源：`assets/city-sample/source/city-modules.blend`（5,613,369字节）。在Blender集合中分别显示模块/轮廓，源模块均在各自局部原点，便于复用。
- 标准运行库：`public/models/city-sample/city-modules.glb`（5,791,216字节）。
- 低画质库：`public/models/city-sample/city-modules-low.glb`（2,295,308字节）。
- 元数据/逐模块预算：`public/models/city-sample/modules-manifest.json`。
- 实例化、资源缓存、距离LOD、共享广告图集与背景地面：`src/environment/CityDensity.ts`。
- 排布、占地预留和LOD规则：`src/environment/CityDensityLayout.ts`。
- 接入：`CitySample.ts`；`Game.ts`只把现有相机传给环境LOD，摄像机计算未改。
- 新测试：`tests/city-density.test.ts`。

素材全部复用原有喷涂合金、玻璃及ambientCG Concrete034/Metal032 CC0贴图，没有付费下载或新的第三方素材。新建筑和文字为原创，未使用商业游戏资产。来源与许可证仍见 [资源清单](resources.md) / [素材记录](../assets-license.md)。

## LOD与性能

每种模块具有near/mid/far真实几何。Near分别840–8,152三角面，mid374–3,661，far116–136。标准中景约125m内使用near，之后mid，约290m后far；远景布局始终使用far。切换有10m滞后，更新通常每0.15秒或相机移动8m执行一次。

低画质使用独立2.30MB模型库，near再减至约35%，纹理不超过512px；更早转LOD，关闭新增广告与车站连接细节，保留城市轮廓。按模块/LOD/材质使用InstancedMesh，并更新包围球以正确视锥剔除；材质与几何缓存、共享图集避免每栋建筑加载独立贴图。无运动模糊、历史帧混合或高成本新后处理。

| 同机、同相机、标准画质 | 保护点 | 本次 |
|---|---:|---:|
| Draw calls | 168 | 217 |
| 绘制三角面 | 452,495 | 477,554 |
| 几何/贴图对象 | 233 / 61 | 371 / 74 |
| 5秒平均FPS | 240.0 | 240.0 |
| P95帧间隔 | 4.3ms | 4.3ms |
| >50ms帧 | 0 | 0 |

1440×900、Edge headless、RTX 4060 Laptop，预热2秒，模拟暂停以比较纯渲染。旧版通过Git保护点单独解压运行，没有修改当前工作文件。此环境约240Hz封顶，因此只能说明本机短测未观察到明显掉帧，**不能证明没有GPU成本增长或所有PC都达到60FPS**。

另一次实际按W、模拟未暂停的5秒短测：240.0 FPS、P95 4.3ms、0帧>50ms，最多210 Draw calls / 483,043三角面。6次画质切换后几何/贴图保持354/63，无持续增长。视角/资源加载不同会影响对象统计，原始JSON均在截图目录。

下载体积增加：原水岸GLB保持不变，标准场景增加5.79MB，低画质增加2.30MB。首次模型加载/着色器编译和较弱显卡仍需人工试玩，真实手机未测。

## 实际截图

| 验收项 | 截图 |
|---|---|
| 正常驾驶（真实按W，约110–116km/h） | [normal-driving](density-screenshots/normal-driving.png) |
| 高速驾驶（真实按W，170–180km/h） | [highspeed-driving](density-screenshots/highspeed-driving.png)、[fullspeed-driving](density-screenshots/fullspeed-driving.png) |
| 起点及三艇出发视角 | [start](density-screenshots/start.png) |
| 城市远景 | [skyline](density-screenshots/skyline.png) |
| 桥梁区域 | [bridge](density-screenshots/bridge.png) |
| 同相机驾驶高度比较 | [before-driving](density-screenshots/before-driving.png)、[after-driving](density-screenshots/after-driving.png) |
| 同相机街区比较 | [before-district](density-screenshots/before-district.png)、[after-district](density-screenshots/after-district.png) |

驾驶图没有直接给模型设定180km/h：QA起步点放到样板入口后，等待原比赛倒计时，以W按键正常加速。截图与随后状态采样之间相隔若干帧；最高速图HUD为179，随后物理状态采样为180。计圈/排名显示仍正常，下一检查点由CP01更新为CP02。

## 验证结果与边界

- TypeScript + 生产构建：通过；Three.js的572.85kB分块提示保留，不是构建错误。
- `npm test`：**84/84通过**（原80项+4项）。新增验证布局确定性/八种模块、三层密度、轨道数据不变、全部水道净空、占地不重叠、实际GLB边界/有限坐标、真实LOD减面与切换滞后。
- Edge运行：模型正常加载，实际W驾驶达到180；排名/圈数/检查点HUD更新，无页面错误；正常/高速/起点/城市/桥梁均拍图。
- 生产页面：新旧模型全部HTTP200，W加速、A转向、S刹车、重新开始恢复40%氮气和倒计时，window.testGame未暴露，无页面错误。
- 浏览器触控模拟844×390：保留按钮、默认低画质，只请求waterfront-low与city-modules-low，未请求标准版，无页面错误；不是手机真机测试。
- 49块路牌98个正反面：迎车法线与路线方向点积<−0.9，FrontSide，图集格内文字UV从左向右，全部通过。
- 实际遇到Vite监视QA保护点临时文件的Windows EBUSY导致开发服务退出，已将`.qa/**`排除监视并重新验证。配置改动不影响生产资源或游戏玩法。
- Git改动审计：player/ai/physics/race/track/config/camera/controls/audio均无修改。原三栋建筑/桥梁GLB、速度和赛道数据未改。

远景有意简化并复用三种塔楼轮廓，尚无完整室内、城市居民或交通玩法；不宣称所有建筑独一无二或已达到商业游戏最终美术标准。人工完整三圈、真实手机、长时间热稳定性未在本轮重新测试；比赛全流程依赖已有自动化回归。请用驾驶截图与实际经过样板的体验判断规模感是否达标。完成后停止等待验收，无部署。

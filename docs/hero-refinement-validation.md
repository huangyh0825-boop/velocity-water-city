# 主角快艇与车手深度精修验收 · 2026-10-16

本轮仅修改主角视觉资产及其视觉姿态适配。保护点：Git标签 `hero-refinement-baseline`，对应 `9cf5ffd`。水面、城市、镜头、驾驶/速度、AI、碰撞、跳台、检查点、氮气/特技规则与比赛流程没有改动。AI沿用上一版低档模型，两个 `*-low.glb` 与保护点的SHA256一致。

这轮是Blender关键部件重建，不是只在旧GLB上加灯带或做全局细分。截图与资源体量供验收；面数增长不能证明达到商业成品美术质量。

## 同视角前后对比

Edge实际WebGL渲染，1600×1000；相同赛道坐标、时间、水面状态、镜头位置和40°FOV。仅拍摄资产近景时暂时隐藏HUD、暂停模拟；没有增加补光或后期修图。快艇三视角暂时隐藏车手，其他近景保留车手。镜头参数在 `hero-refinement/before-angles.json` 和 `after-angles.json`。

| 旧版 | 本轮 |
|---|---|
| ![旧快艇](hero-refinement/before-craft-front.png) | ![新快艇](hero-refinement/after-craft-front.png) |
| ![旧车手](hero-refinement/before-rider-front.png) | ![新车手](hero-refinement/after-rider-front.png) |
| ![旧骑乘](hero-refinement/before-mounted.png) | ![新骑乘](hero-refinement/after-mounted.png) |

## 快艇：外壳与工业部件

- 重建主要下船体：纵向截面网格、抬升船头、双折线船底、成型舷缘和尾板，替换旧版普通小船式船头。视觉尺寸仍通过原艇身包围范围测试，未修改物理碰撞体。
- 重建船头主壳与成型银色肩板、独立后侧壳；壳体厚度、倒角、分件缝、保护胶条、侧进气凹腔/格栅、镜壳与镜片独立制作。
- 独立驾驶座/后部抬升座、座椅承托壳、滚边和针脚；脚踏防滑纹、排水孔、脚槽边沿、登艇防滑垫、铸造抓手与固定件。
- 完整的转向立柱、弯曲车把、夹具螺栓、握把纹路、开关、扳机与控制线；新宽幅LCD与密封边框，仪表图片为原创。
- 尾部喷嘴、铸造筋、定子导叶、轮毂、反推框架、执行连杆与排水塞；蓝灯嵌在踏板外下侧，避免穿入靴子。喷射特效仍复用原系统，仅跟随新视觉喷口节点。
- 烤漆/清漆、珍珠银、碳纤维、拉丝钛、牵引橡胶与座垫皮革分开使用PBR纹理；不更改全局光照来掩盖模型问题。

| 船头 | 侧面 | 船尾 |
|---|---|---|
| ![船头](hero-refinement/after-craft-front.png) | ![侧面](hero-refinement/after-craft-side.png) | ![船尾](hero-refinement/after-craft-rear.png) |

![仪表与控制区](hero-refinement/after-cockpit.png)

## 车手：人体、装备与骑姿

保留Blender官方真人基础网格的成年人比例，重塑骑姿和手臂静止姿态。躯干加入服装余量/轻微褶皱；服装面片沿实际人体网格裁切并保留厚度，替代上一版射线投影在腋下跳面、裁片边缘台阶等问题。

- 蓝色皮革前胸/背部裁片、腰侧弹性分区、上臂袖片、渐变护臂、裤腿/小腿裁片、膝部保护、缝边、拉链、腰部支撑及背号。
- 新头盔使用编辑截面网格，具有真正的眼部开口、独立弧面烟色镜片、橡胶密封、铰链、额部进气、下巴格栅、后导流与颈部包边。镜片后保留同一真人基础网格的面部和原创简化眼部，并非球体上涂一块黑色。
- 重做握把手套：掌部、指节保护和每根弯曲手指包住实际握把；靴子具有脚跟/脚背/脚趾体积、独立外底、防滑纹和脚踝过渡。
- 原15骨骼重新调整双肘静止姿态，更新对应人体网格；新增28根手指骨，共43骨。服装转移人体蒙皮权重；手套分指绑定。没有新增指尖实时动作库或手工逐顶点重刷全部权重。
- 主角专用视觉IK采用更自然的下沉肘部；车手前倾、转向、特技时双手的位置和朝向保持握住原握把。头部以较小幅度跟随躯干，避免整块僵硬倾斜。腿部仍使用匹配原脚踏的静止骑姿，落水缓冲继续使用原输入。

| 前侧 | 侧面 | 背面 |
|---|---|---|
| ![车手前侧](hero-refinement/after-rider-front.png) | ![车手侧面](hero-refinement/after-rider-side.png) | ![车手背面](hero-refinement/after-rider-back.png) |

![头盔近景](hero-refinement/after-helmet.png)

![手套握把](hero-refinement/after-glove.png)

![靴子与脚踏](hero-refinement/after-boot.png)

## 实际驾驶与姿态截图

以下正常驾驶截图使用原跟随镜头。另提供同一真实动作状态的近景照片：暂停后只移动QA相机，未写入假转向、假腾空或假特技完成状态。

![正常驾驶](hero-refinement/driving.png)

| 转向原镜头 | 转向姿态近景 |
|---|---|
| ![转向](hero-refinement/turning.png) | ![转向近景](hero-refinement/turning-close.png) |

| 加速原镜头 | 加速姿态近景 |
|---|---|
| ![加速](hero-refinement/acceleration.png) | ![加速近景](hero-refinement/acceleration-close.png) |

| 腾空原镜头 | 腾空近景 |
|---|---|
| ![腾空](hero-refinement/airborne.png) | ![腾空近景](hero-refinement/airborne-close.png) |

![空中特技](hero-refinement/air-trick.png)

![落水结算](hero-refinement/landing.png)

## 来源、文件与复现

没有购买或新增来源不明的模型。复用已下载并保留许可证明的Innerscene CC0 PWC与Blender官方CC0 Human Base Meshes；本轮主要外壳、机械件、服装装备、头盔、手套、绑定扩展和贴图为项目原创Blender工作。完整URL、作者、原始文件SHA256和Blender包内许可说明见 [来源记录](../assets/racecraft/README.md)。没有使用商业游戏提取资产、品牌标志或外部动画。

| 文件 | 用途 |
|---|---|
| `scripts/art/refine-hero-assets.py` | 原创截面/网格建模、倒角/厚度/细分、服装裁切、姿态和分指蒙皮、PBR制作与GLB导出 |
| `assets/racecraft/source/hero-craft.blend` | 分件可编辑的主角快艇，导出批处理前保存 |
| `assets/racecraft/source/hero-racer.blend` | 人体、服装、装备及43骨可编辑源文件，合并前保存 |
| `assets/racecraft/textures/hero/` | 36张2048²BaseColor/Normal/ORM与1张1024²LCD原图；ORM的AO为程序局部遮蔽，不是光追烘焙AO |
| `public/models/watercraft.glb` / `rider.glb` | 实际主角GLB，贴图内嵌、无本机绝对资源路径 |
| `src/player/AnatomicalRider.ts` | 主角肘部、手掌朝向和头部的视觉姿态适配，旧AI模型保持原路径 |
| `tests/hero-assets.test.ts` | 新材质/固定挂点/分指骨骼/握姿及有限蒙皮数值回归 |

`npm run assets:build`调用Blender 4.5+重新生成两份主角资产，不覆盖AI/低档GLB；可用`BLENDER_PATH`指定可执行文件。该脚本读取上一版可编辑场景，不会反复在已细分主角GLB上累计细分。普通游戏构建不需要Blender。

## 验证记录

- 最终资产运行 `tsc --noEmit`：通过。
- 最终自动化测试：**96/96通过**，新增2项主角资产回归；原驾驶、碰撞、检查点、三圈与30/60/120渲染调度回归仍通过。记录 [tests.txt](hero-refinement/tests.txt)。
- 最终Vite生产构建通过；保留原Three.js包大于500kB的提示，没有把提示隐藏。记录 [production-build.txt](hero-refinement/production-build.txt)。
- Edge实际WebGL游戏输入：W正常加速、D转向、Shift氮气超过200km/h、Space特技；真实游戏循环起跳/落水并获得一次+35%氮气。最后一次采样加速215.28km/h，能量22.77%→57.77%，没有改速度参数。QA仅将艇放到已有跳台前18米以缩短等待，未直接设置成功/奖励。记录 [game-results.json](hero-refinement/game-results.json)。
- 玩家与4个AI均成功加载，5套独立Skeleton，无页面/模型/着色器控制台错误。主角约146.65万渲染三角面；各AI约3.16万，仍使用旧模型。
- 生产页W/A/S、减速归零、重新开始恢复40%氮气和倒计时通过；六个场景/艇身/车手GLB均HTTP200，无测试Game实例泄漏到生产页。记录 [production-results.json](hero-refinement/production-results.json)。
- `git diff hero-refinement-baseline`确认核心驾驶、AI、物理、赛道、比赛、镜头、输入、城市、水面与水花文件无改动；低档两个GLB逐文件SHA256一致。

浏览器测试为自动化真实按键及目视检查截图，并非人工长时间驾驶或人工完整跑三圈。没有重新做所有多艇挤压组合的人工碰撞验收；原自动化回归继续覆盖这些逻辑。本轮没有真实手机/低端显卡测试或长期帧率基准。

## 成本、限制与验收重点

| 主角资产 | 上一版三角面 | 本轮Blender三角面 | 本轮GLB体积 |
|---|---:|---:|---:|
| 快艇 | 51,473 | 689,146 | 77.4 MiB |
| 车手 | 21,586 | 777,360 | 88.5 MiB |

按本次要求优先精度，没有给主角减面或缩贴图。两份GLB合计约166MiB，首次加载、内存和显存需求显著增大；运行验证只证明本机可加载和驾驶，不能视作低配置流畅承诺。AI低档资源保持原样。

主要可见提升是连续船体/成型分件、真实控制总成和尾部结构，以及真人比例骑姿、可辨认的竞速服、全盔、握把手指与靴子。仍有边界：服装采用程序裁片/褶皱，不是专业服装仿真或高模雕刻烘焙；局部接缝、腋下与关节在极近视角仍需美术打磨；面部无表情绑定，手指为固定握姿。当前原跟随镜头较远，第三人称中细小机械件和织物纹理受屏幕占比限制，本轮没有通过改镜头夸大正常驾驶画面的提升。

请重点验收新船头/侧壳是否像高端PWC、头盔和人体比例、手脚接触、转向/加速前倾以及腾空落地时服装/装备是否出现可见穿插。**仍不能仅凭这一轮面数和截图就宣称达到《激流快艇2》的商业成品美术质量。** 本轮停止在此版本，等待实际试玩与美术验收，不扩建地图、不优化其他系统、不部署。

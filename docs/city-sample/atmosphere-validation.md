# 城市竞速氛围与路牌修复验收

2026-10-14。修改前检查点：`city-atmosphere-baseline`（cd3e5f9）。路牌修复独立提交9d86f1a。范围仍为原280米街区；没有扩展地图。

## 路牌原因与修复

现用CityTrackView检查点、CityDistricts分区牌原本是朝向行驶前方的+Z单平面，配合DoubleSide，玩家从后方接近看到背面而镜像。样板广告虽已旋转一部分，仍存在双面背字和支撑体未跟随朝向的问题。GLB幕墙贴图没有文字，文字均由Canvas生成；没有负UV缩放。

新增ReadableSign：局部+Z为行驶方向，顺向文字面的法线朝-Z；返向文字面朝+Z。两个独立单面网格使用正常UV，绝不把背面当正面。每块牌按自己的路线切线旋转，没有旋转场景。广告基座及商业入口在Blender里同步按真实局部航向旋转；商店文字面置于玻璃外，避免嵌入基座。原圆环检查点已有正确的两个单面，保留；旧CityEnvironment广告也接入新结构。

浏览器逐一检查现用41块牌、82个文字面：法线面对接近方向、FrontSide、投影后UV左右/上下正确。包含24检查点、6分区牌、2原广告、9新增屏幕。低画质隐藏大型全息屏，但保留方向信息。正面截图见下方，几何检查不替代人工判断远距离文字清晰度。

## 场景改造

- 三栋主建筑由原先每类两次复制改为各一次：ASTER渐缩曲面塔（约90m）、HELIX扭转双翼塔（约100m）、MARINA退台商业展馆（约30m）。各有不同立面色调、屋顶设备、入口、灯带和标识。
- 近景：成组维修/充电设施，金属冷却鳍、软管、端口、检修踏步；曲线灯柱、植栽座椅、井盖、连续短遮棚和沿岸服务区。
- 中景：三个商业入口、半透明大厅、暖色室内灯板；桥墩检修口、梯架、桥挂比赛提示屏、两个大型全息广告；各主建筑外立面标识。
- 远景：三种低精度独特轮廓补充楼宇、双侧悬挂交通轨道；三辆纯装饰交通舱使用InstancedMesh，共享几何/材质，仅更新视觉矩阵，低画质关闭。
- 材质：深石墨构造、银色机械、琥珀合金、青蓝/银蓝/绿蓝三种幕墙；新增原创512×1024法线与粗糙度图。混凝土和金属仍使用原CC0材质，没有新增下载素材。
- 光照：半球光从2.8降至1.8以增强形体层次，日光仍保持白天风格。标准画质一次性捕获128²街区立方体并生成PMREM，仅用于楼宇玻璃/金属；不逐帧捕获，没有SSR/运动模糊。低画质首次加载不执行该捕获。建筑阴影仍是局部静态2048²贴图。

新增元素围绕水岸维修、商业、城市交通和赛事标识组织。不是以建筑数量增长宣称达标；是否达到所需“高速穿越城市”的第一眼印象，应由下面的驾驶图和实际试玩验收。

## 预算

| | 前版 | 本版 |
| --- | ---: | ---: |
| 标准街区三角面 | 255,244 | 222,596 |
| 低精度三角面 | 102,092 | 89,028 |
| 主体材质组 | 7 | 13 |
| 标准GLB | 11.00MB | 10.17MB |
| 低精度GLB | 3.46MB | 3.23MB |

标准面数降低约12.8%，同时增加材质层次。广告、指示牌与装饰交通另计，不把它们隐瞒在GLB预算中。原三栋建筑的编辑源仍在 `assets/city-sample/source/waterfront-sample.blend`；全套导出与源脚本路径不变。

## 实际截图

同视角对比采用改动前真实截图与最终截图，均为1440×900，同相机位置、FOV、目标和水面时间；没有把近景特写拿来代替同镜头对比。

| | 优化前 | 优化后 |
| --- | --- | --- |
| 城市全景 | [前](atmosphere-screenshots/before-district.png) | [后](atmosphere-screenshots/after-district.png) |
| 低位驾驶镜头 | [前](atmosphere-screenshots/before-driving.png) | [后](atmosphere-screenshots/after-driving.png) |
| 桥梁 | [前](atmosphere-screenshots/before-bridge.png) | [后](atmosphere-screenshots/after-bridge.png) |
| 同位置建筑观察 | [前](atmosphere-screenshots/before-building.png) | [后](atmosphere-screenshots/after-building.png) |

- [真实W键驾驶（HUD约116km/h）](atmosphere-screenshots/game-driving.png)
- 建筑近景：[ASTER](atmosphere-screenshots/building-aster.png)、[HELIX](atmosphere-screenshots/building-helix.png)、[MARINA](atmosphere-screenshots/building-marina.png)
- 路牌正面：[CP01](atmosphere-screenshots/sign-checkpoint-sign-1.png)、[分区牌](atmosphere-screenshots/sign-district-sign-0.png)、[原广告](atmosphere-screenshots/sign-original-transit-advert.png)

## 运行验证

- 77/77自动化测试通过。新增双面独立UV/法线投影测试；街区GLB有限几何、LOD、PBR与12米以下水道净空检查通过。
- TypeScript类型检查、生产构建通过；Three.js块约555.38KB仍有Vite超过500KB提示。
- 视觉整合版浏览器自动输入完成三圈72门，首圈109.4秒、总320.05秒；9次起跳/落地/奖励，峰值216km/h；AI起跳6/6/3/5、奖励5/6/2/3。虚拟时钟测试不是帧率依据；此理想路线没有自然碰撞，实体碰撞由既有专项测试覆盖。随后对牌与基座的纯视觉位置修整另做了净空/加载检查，没有再把全赛程重复测试作为必要条件。
- 相对基线检查：`src/player`、`physics`、`ai`、`race`、`config`、`controls`、Track/CityTrack/Ramps均无修改；Game仅新增装饰更新和反射准备回调，CityTrackView只改显示牌。
- 本机Edge无头1440×900、RTX4060 Laptop，开启实际模拟并持续W输入的5秒样本约240FPS，P95约4.3ms，50ms以上帧零，最多120绘制调用、约387,817三角面。仅代表预热后短样本，不保证其他设备或冷启动。
- 画质缓存预热后，反复切换六次：几何215→215、贴图43→43，未持续增长。低画质关闭阴影、大型全息屏及交通舱，低精度资产正常加载。
- 生产预览标准GLB HTTP200、W加速/S制动/重赛正常，无页面异常；触控横屏模拟默认只请求低精度街区GLB，没有先下载标准版。未做真实手机实机测试。

## 限制与验收

本轮不宣称达到《激流快艇2》成品质量。立方体反射是单点静态近似，近看会出现缺乏视差的反射轮廓；没有实时水中建筑倒影、专业烘焙AO或真实人群。远景仍有原图的简化楼宇，范围外没有重建。首次GLB/着色器/环境贴图准备有额外成本，本机短时帧率不覆盖冷启动、低配和长时性能。

请以驾驶截图和试玩的空间连续性、主建筑辨识度、色彩层次及所有路牌可读性作为本次验收标准。完成后停止，不扩展全地图、不改赛车/角色、不部署。

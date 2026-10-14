# 样板区质感强化：截图与验收记录

范围仅为原有280m Lumen Waterfront。开始前保护点 `city-material-baseline`（8821512）；没有修改赛道、检查点、驾驶/AI速度、碰撞、跳台、特技、氮气、比赛或艇/驾驶员资源。Game.ts只改曝光。

## 确认的原因与实际修改

改动前逐对象分析见 [诊断记录](material-preflight.md)。最明显的是桥拱/桥身：均匀单色的Pearl ceramic、圆管结构和少量连接细节，使其像白色玩具。高楼的问题是幕墙UV闭合接缝跨度错误、侧面投影压缩、运行时金属参数覆盖和大块蓝色。平台/护栏已有部分PBR，但缺乏接触与锚固层次。

| 对象 | 材质/结构改动 |
|---|---|
| 桥拱、桥面、建筑基座和肋条 | 替换为原创喷涂合金面板PBR，带拼缝、轻微面板色差、粗糙度变化、凹槽法线与接缝AO；涂层主体非金属，仅裸露边缘增加金属度 |
| 蓝/银/青绿幕墙 | 玻璃金属度归零；细分玻璃区域粗糙度0.16–0.26，窗框区0.55；清漆权重0.12、微法线强度0.025；256px静态城市反射经PMREM过滤，最终反射强度0.7；修复闭合UV跨整张贴图的问题 |
| 广场/建筑外侧地面 | 独立复合铺装BaseColor、Normal、ORM，粗糙度0.60–0.94、金属度0；修复立面投影UV，保留原水道平台上的Concrete034 |
| 桥梁结构 | Blender扫掠真实工字截面，增加翼缘/腹板凹槽、焊接拼缝和连接销；吊杆销孔/套头、桥墩混凝土、橡胶支座、金属顶盖分层；收小桥面/桥墩倒角 |
| 屋顶/建筑底座 | 换热器顶面百叶、接缝；基座下沉5cm消除悬空缝；挤出端面使用平面法线、倒角启用harden_normals |
| 水道护栏 | 六角锚板、连接套、紧固件；细小件采用低截面细分，避免近景细节无意义增加面数 |
| 广告/比赛屏 | 四个重要屏幕增加带倒角的金属边框；与文字正反面分离，不改变文字UV或朝向 |

新增贴图均由 `scripts/art/surface-materials.py` 原创，保留在 `assets/city-sample/textures/` 并打包到GLB/.blend：

- `coated-alloy-{basecolor,normal,orm}.png`：各512×512。
- `composite-paving-{basecolor,normal,orm}.png`：各512×512。
- ORM使用R=AO、G=Roughness、B=Metallic。AO是程序化面板接缝遮蔽，**不是光线烘焙AO**；法线与粗糙度为独立纹理通道。
- 更新原有 `original-glazing-normal.png` / `original-glazing-roughness.png` 的导出内容，仍512×1024；它们源于生成脚本，导出贴图已嵌入GLB。
- 原有ambientCG Concrete034 / Metal032继续使用CC0 1K贴图，不新增外部素材或署名义务。

## 光照和接触层次

- 半球填充光1.8 → 1.3；主日光3 → 3.25，增加结构凹处与日光的明暗对比。
- ACES Filmic保留，曝光1 → 0.95，避免浅色表面过曝。
- 静态阴影2048分辨率保留；normalBias 0.08m → 0.018m，bias −0.00012 → −0.00008，减少细杆连接处阴影脱离。
- 原128px反射探针提升到256px，只捕获一次；不使用动态SSR或实时光追。
- 建筑/桥墩/设施底部使用单一合并网格的解析接触遮蔽贴片，避开水道，低画质关闭。它是局部近似，不是SSAO；不叠加历史帧，无运动模糊。
- 反射第一轮过强，深入检查发现旧玻璃Normal/Roughness图片实际上是全黑：设置Non-Color放在写像素之后，清除了Blender生成图缓冲。修正顺序并增加像素内容测试；随后调节填充光和窗格基础色，避免修复后背光面太暗。最终截图为修正后的真实贴图。

## 同视角截图

1440×900，同一相机位置/朝向、time=0、水面状态和隐藏HUD。位置参数见 `material-screenshots/poses.json`。前图在实际修改前拍摄，不是用新场景调色模拟。

| 视角 | 修改前 | 修改后 |
|---|---|---|
| 桥梁近景 | [before-bridge](material-screenshots/before-bridge.png) | [after-bridge](material-screenshots/after-bridge.png) |
| 建筑近景 | [before-aster](material-screenshots/before-aster.png) | [after-aster](material-screenshots/after-aster.png) |
| 护栏/平台近景 | [before-platform](material-screenshots/before-platform.png) | [after-platform](material-screenshots/after-platform.png) |
| 固定驾驶高度 | [before-driving](material-screenshots/before-driving.png) | [after-driving](material-screenshots/after-driving.png) |
| 区域总览 | [before-district](material-screenshots/before-district.png) | [after-district](material-screenshots/after-district.png) |

另有实际按W、保持运行的 [驾驶HUD截图（119km/h）](material-screenshots/game-driving.png)。近景补充：[Helix](material-screenshots/building-helix.png)、[Marina](material-screenshots/building-marina.png)。

路牌正面：[CP01](material-screenshots/sign-checkpoint-sign-1.png)、[区域牌](material-screenshots/sign-district-sign-0.png)、[交通广告](material-screenshots/sign-original-transit-advert.png)。所有41个现有ReadableSign对象的82个正反面检查：FrontSide、UV从左向右、迎车面法线与路线方向点积<−0.9。记录在 `sign-audit.json`；没有为了修一张牌旋转场景。

## 成本与浏览器测试

| 指标 | 保护点版本 | 本次 |
|---|---:|---:|
| 标准GLB三角面 | 222,596 | 263,204（+18.2%） |
| 低精度GLB三角面 | 89,028 | 105,233 |
| 主体材质组/网格 | 13 | 13 |
| 标准GLB字节 | 10,167,000 | 15,709,780 |
| 低精度GLB字节 | 3,226,576 | 6,496,840 |
| 固定相机Draw calls | 165 | 168 |
| 固定相机绘制三角面 | 409,967 | 452,495 |
| 已分配几何/贴图对象 | 228 / 54 | 233 / 61 |
| 同机同相机5秒平均FPS | 240.0 | 240.0 |
| P95帧间隔 | 4.3ms | 4.3ms |

固定视角性能比较通过从Git保护点单独解压并运行旧版完成，不切换当前工作文件；1440×900、Edge headless、RTX 4060 Laptop、预热2秒、每版测5秒，**暂停模拟**以隔离视觉成本。帧率受测试环境约240Hz上限影响，不能说明GPU成本没有变化，也不能代表所有PC。

另一次实际运行（未暂停、按W驾驶）短测：平均239.4 FPS、P95 4.3ms、0帧>50ms、最多124 Draw calls / 430,601三角面。6次画质切换后几何/贴图数量稳定216/50，没有持续增加。不同视角数量不同是剔除/资源分配所致。全部JSON记录保存在截图目录。

模型下载体积确实增加，低画质仍只加载独立低精度GLB并关闭阴影、屏框、交通与接触遮蔽。真实手机未测试，冷加载/首次着色器编译还需用户确认；不以高配置机器短测宣称所有设备60FPS。

## 自动化与实际完成的检查

- `npm test`：**80/80通过**（原77项+3项针对性测试）。包括原驾驶/极速、AI三圈、碰撞、高度差、跳台/30–120帧模拟、特技奖励、氮气、检查点/捷径、粒子回收和音频状态。
- 新测试检查GLB实际AO与Roughness/Metallic共享ORM、512px图像、非金属玻璃、成本上限、幕墙闭合三角形UV跨度以及玻璃法线/粗糙度实际非黑像素。
- `npm run build`：TypeScript与生产构建通过；仍有Three.js 572.85kB分块体积提示，不是构建错误。
- Edge生产页面：所有模型HTTP200、W加速、A转向、S刹车到0、重新开始40%氮气与倒计时、无JS异常、无生产testGame接口。
- 最初生产脚本使用固定4.2秒等待，首次材质编译/倒计时未完成导致速度断言失败；改为等待实际比赛HUD状态后再测试，未修改游戏以绕过检查。
- 浏览器触控模拟844×390：触控按钮可见、默认低画质、只请求waterfront-low.glb、无页面错误。不是Android/iOS真机验收。
- 新增GLB净空仍通过，建筑/护栏不会侵入原可驾驶水道。改动文件审计未涉及player/ai/physics/race/track/config/camera/controls/audio。

主要修改文件：`scripts/art/build-city-sample.py`、新增`surface-materials.py`、可编辑`.blend`、六张新PBR图/三张更新的玻璃图、两种GLB/manifest；运行层`CitySample.ts`、`CityAtmosphere.ts`、新增`SurfaceContacts.ts`与`ScreenHousing.ts`、`Game.ts`曝光；测试新增`tests/city-materials.test.ts`。README、资产说明、许可证来源记录与本验收文档同步更新。

## 尚存的质量边界与试玩重点

此次确实替换了单色材质并补充工程结构，不只是增加建筑数量。桥梁/连接件的塑料感比保护点明显减弱，但**尚不能宣称接近或达到《激流快艇2》的最终商业美术水准**。

玻璃仍使用单点静态反射，近距离有透视近似和局部拉伸；建筑内部是暗层/窗格表现，没有完整室内。大面积接触阴影是解析近似，远景仍为已有简化模型。水面、艇、驾驶员和其余地图按本次保护范围保持原状。

请重点试玩：桥下与桥墩材质是否仍像塑料、转弯时玻璃高光是否过强、近景护栏/铺装是否足够自然、首次加载和标准/低画质切换是否流畅，以及路牌正反面可读性。人工完整三圈、真实手机、长时间性能未在本轮重新做；完整比赛回归为自动化模拟。完成本轮后停止，等待视觉验收，无部署。

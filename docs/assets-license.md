# 素材与声音来源（Phase 3–5）

第三、四阶段的船体、跳台、喷射、水花和界面均由本项目代码程序化生成；当时没有加载外部游戏模型或贴图。

第四阶段的流线艇身、驾驶员、头盔、桥梁、城市楼群、水纹、V 形泡沫均为原创程序化几何/着色器。玻璃幕墙是代码生成的 DataTexture，广告与标牌使用浏览器系统字体在 Canvas 绘制，文案为原创虚构品牌。没有使用第三方模型、图片、人物或商业游戏素材。

发动机、水流、高速破浪、氮气、离水、落水和碰撞声音全部由本项目 `src/audio/AudioController.ts` 通过 Web Audio API 原创合成，使用振荡器与程序生成的噪声，不依赖下载音频。没有使用《激流快艇2》的原版素材、声音、音乐或其他第三方音频。

新增倒计时提示音同样为原创振荡器合成；没有加入外部音乐。

Three.js、Vite 与原项目 npm 依赖继续适用各自许可证。本阶段未新增音频或物理库依赖。

## 第五阶段

`public/models/{watercraft,rider,watercraft-low,rider-low}.glb` 是本项目原创资产，由 `scripts/build-models.mjs` 中的原创截面、轮廓曲线和关节层级生成，再通过 Three.js GLTFExporter 导出。没有从游戏或素材网站提取模型，没有使用第三方人物、照片或纹理。可运行 `npm run assets:build` 重建，资产名称、体积、三角面和材质组预算记录在 `public/models/manifest.json`。这是代码曲面建模的替代工作流，并非 Blender 人工建模。

新水道控制点、捷径曲线、六区楼宇模板、码头、隧道、桥梁及广告均为本项目原创代码/文案。发动机、空中风声及 AI 声音继续通过 Web Audio 合成，无下载音频。

环境反射使用 Three.js 的 `RoomEnvironment` 生成静态 PMREM 贴图；GLTFLoader/GLTFExporter、几何工具及 RoomEnvironment 随 Three.js 适用 MIT 许可。许可证副本见 `docs/licenses/three.txt`，版本以 package-lock.json 为准。未引入新的第三方资产许可证或需单独署名的素材。原创资产的整体公开项目许可证由项目所有者决定；本说明没有自行将项目作品授权为 CC0 或其他新许可证。

## Blender 城市样板区

新增建筑、桥梁、水岸为 Blender 4.5.9 原创资产，可编辑源位于 `assets/city-sample/source/waterfront-sample.blend`，导出位于 `public/models/city-sample/`。本次引入 ambientCG Concrete034、Metal032 的免费 **CC0 1.0** 贴图，许可明确允许原文件再分发、无需署名。仍保留来源记录；没有将第三方贴图标为原创。逐项下载核验、候选排除及许可链接见 [城市样板资源清单](city-sample/resources.md)。没有采用任何未经许可的商业游戏资源，也没有购买付费模型。

质感强化新增 `coated-alloy-{basecolor,normal,orm}.png`、`composite-paving-{basecolor,normal,orm}.png`（512×512）均为本项目原创程序化贴图，源码 `scripts/art/surface-materials.py`；未使用外部纹理或商业游戏图像。玻璃图集、接触遮蔽和广告屏仍为原创。原创资产继续由项目所有者决定整体公开许可证，本说明不额外将其授权为CC0。

城市模块库`city-modules.blend`与`city-modules{,-low}.glb`为本项目原创Blender曲面/挤出几何，脚本`build-city-modules.py`；只复用以上原创材质与ambientCG CC0贴图，无新增外部模型、付费资产或商业游戏素材。城市导向屏为原创Canvas图集，使用系统字体。原第三方CC0来源记录继续适用，原创模型未自行改授权为CC0。

本轮模块库增加10种原创建筑（共18种），扩展脚本 `scripts/art/city-module-details.py`。沿用原PBR与CC0贴图，没有新增外部素材。功能广告图集为本项目Canvas原创，2048×1024；不需要新的第三方署名。

本轮另增8种原创Blender模块（总计26种），脚本为 `scripts/art/city-module-infill.py`。继续复用既有PBR与CC0纹理，无新增外部模型、贴图或署名义务；未更改原创资产的整体授权。

建筑光照与内部空间修订新增三张运行时Canvas原创贴图：1024×512八款房间图集（`src/environment/CityGlass.ts`）、512×256服务屏和256×256室内墙面（`src/environment/CityInteriors.ts`）。内容为代码绘制的虚构办公室、设备、柜台、墙板和原创文字，不含照片、下载室内素材或商业游戏图像。截图导出副本在 `docs/city-sample/interior-screenshots/atlas-*.png`，运行时不请求这些文档副本。浅层服务空间几何和静态基座遮蔽为原创代码生成，原GLB与Blender源文件未改动。没有新的第三方署名义务；原创作品仍由项目所有者决定整体授权。

## 车手、快艇与水面修订 · 2026-10-15

本轮替换此前纯原创占位快艇/车手GLB，采用Innerscene免费CC0个人水上摩托与Blender官方Human Base Meshes包内CC0真实男性基础网格，在Blender 4.5.9中改模、蒙皮、制作装备和两档LOD。素材允许修改及原文件/衍生文件公开再分发；没有使用品牌标识、付费模型或商业游戏提取资产。原始文件、实际下载SHA256、作者、许可页面、包内README和Rain Rig许可文本的区分，见 [车手快艇来源记录](../assets/racecraft/README.md)。保留Blender Foundation署名。历史阶段中“未使用第三方模型”的说明仅适用于当时版本。

新仪表、头盔/护具、竞速服256²Normal/Roughness纹理、256²水面法线谱、反射/Fresnel和尾浪着色为本项目原创代码/图像。艇身512²/低画质256²BaseColor纹理源于上述CC0模型，部分经中和色彩和缩放；原始纹理名称保留。GLB内嵌图片，不依赖远程素材。没有新音频素材或新的第三方运行库。

## 主角快艇与车手深度精修 · 2026-10-16

继续使用以上已保留的Innerscene CC0与Blender官方CC0基础资产，不新增下载、付费素材或第三方动画。快艇主要船体/船头外壳、分层侧壳、控制总成与喷泵结构为本项目Blender重建；车手使用同一真人基础网格重新塑造骑姿、制作服装装备和43骨绑定。原始来源及完整许可文本不变，保留Blender Foundation署名。

新37张贴图均由 `scripts/art/refine-hero-assets.py` 原创生成：36张2048²的BaseColor/Normal/ORM和1张1024²仪表图；包括烤漆、珍珠银、碳纤维、金属、橡胶、皮革和织物。没有品牌标识、商业游戏贴图、AI生成素材或外部照片。源文件与路径见 [模型来源和制作记录](../assets/racecraft/README.md)。本轮不改水面、环境或音效。原创部分由项目所有者决定整体公开授权。

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

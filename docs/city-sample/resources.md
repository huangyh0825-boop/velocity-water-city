# 免费资源筛选及实际来源

核验日期 2026-10-14。没有购买模型，也没有提取商业游戏素材。CC0 允许原文件公开再分发；未自行改变第三方作品许可证。

| 候选资源 | 作者/来源 | 许可及格式 | 精度/成本 | 实际可用性及决定 |
| --- | --- | --- | --- | --- |
| [Downtown City MegaKit](https://quaternius.com/packs/downtowncitymegakit.html) / [下载页](https://quaternius.itch.io/downtown-city-megakit) | Quaternius | CC0；FBX/glTF；Blend 源属于付费 Source 套餐，未购买 | 全包315模块，页面列免费 Standard ZIP 223MB；具体面数未下载检查，不估造数字 | 页面及免费 Standard 列表实际可访问。经典纽约/波士顿立面风格，不作为本次未来街区主资产；完整ZIP未下载 |
| [Modular Sci-Fi MegaKit](https://quaternius.com/packs/modularscifimegakit.html) | Quaternius | CC0；FBX/OBJ/glTF 免费部分 | 277模块（含付费部分）；面数未核实 | 官方页面可访问；偏科幻室内墙/地板，难直接构成高质量室外摩天楼，未采用/未下载 |
| [Buildings Pack](https://quaternius.com/packs/buildings.html) | Quaternius | CC0；FBX/OBJ/Blend | 9建筑，具体面数未下载核实 | 页面可访问；较早的低精度风格，不足以明显提高目标质量，未采用 |
| [Futuristic Building](https://sketchfab.com/3d-models/futuristic-building-e73f9bb9981d469c8a8ccdc1f168faad) | 3DHaupt | **CC BY-NC 4.0**；下载格式未登录检查 | API 实际报告28,060面、16,520点；中等模型成本 | 公开API HTTP200，网页403。虽然标记可下载，NC 不符合本项目候选范围，排除 |
| [Futuristic Building](https://sketchfab.com/3d-models/futuristic-building-555daf778aa245158e4b24214ccc1dbb) | Jonathan | CC BY 4.0，使用需要署名；下载格式未登录检查 | API报告1,595面、1,673点，预计成本低 | API HTTP200、标记可下载，网页403；未取得登录下载，不能仅根据面数断言美术质量，不采用/不声称已验收文件 |
| [Concrete](https://polyhaven.com/a/concrete) | Rob Tuytel / Poly Haven | CC0；JPG/PNG/EXR PBR | 1K–8K，4m材质范围；仅贴图，不是建筑模型 | 官方文件/信息API HTTP200，真实文件URL已核实；旧化条板风格与样板白色新城不匹配，未下载/采用 |
| [Concrete 034](https://ambientcg.com/view?id=Concrete034) | Lennart Demes / ambientCG | **CC0 1.0**；1K JPG PBR | 下载包约3MB，使用Base Color、NormalGL、Roughness三张1024² | 实际下载ZIP、成功解压；采用作岸台、桥墩及建筑基座。原文件保留在 assets/city-sample/textures |
| [Metal 032](https://ambientcg.com/view?id=Metal032) | Lennart Demes / ambientCG | **CC0 1.0**；1K JPG PBR | 包约3MB，使用Color、NormalGL、Roughness、Metalness四张1024² | 实际下载ZIP、成功解压；采用作栏杆、金属接缝和屋顶构件 |

ambientCG 的[官方许可说明](https://docs.ambientcg.com/license/)明确包含复制、修改、分发及将原文件放入项目，无强制署名。仍在此记录来源，不把贴图署为本项目原创。Poly Haven [FAQ](https://docs.polyhaven.com/en/faq)确认资源为CC0。Sketchfab的名称相同不代表许可证相同，采用逐个模型API核验，没有把BY-NC误写成BY。

## 实际交付的原创模型

没有合适的免费现成建筑被直接引入。模型全部使用 **Blender 4.5.9 LTS** 原创制作，免费素材用于 PBR 表面。Blender 来自[官方4.5发布目录](https://download.blender.org/release/Blender4.5/)，Windows ZIP SHA256：`41da973b9bf95bb312cbeff4d1982feb13259b43c821686b9bafea4dfe5477cf`，已匹配官方校验文件。便携运行时放在被Git忽略的 `.qa/tools/blender`，没有修改系统安装/注册表。

- 可编辑源：`assets/city-sample/source/waterfront-sample.blend`；内部含三种可复用建筑集合、桥梁、水岸与场景实例。
- 建模源：`scripts/art/build-city-sample.py`；保持曲线、截面网格、倒角、加权法线、UV、PBR节点和屋顶中庭布尔开孔。
- 游戏文件：`public/models/city-sample/waterfront.glb`、`waterfront-low.glb`；标准与低精度分别导出，按材质合并绘制。
- 原创幕墙贴图：`assets/city-sample/textures/original-curtain-wall.png`，512×1024，包含窗框、密封条、玻璃变化及遮阳层，不依赖外部商业图片。
- 外部贴图：`Concrete034_1K-JPG_{Color,NormalGL,Roughness}.jpg`、`Metal032_1K-JPG_{Color,NormalGL,Roughness,Metalness}.jpg`，1024×1024，CC0。GLB 内嵌贴图，运行无需访问外网。低精度导出缩至512²，运行关闭法线贴图和阴影。

Blender源文件打包了所用图片；外部CC0原图也独立保留便于编辑和记录。原创模型/原创幕墙图的项目发布许可由项目所有者决定，本任务没有擅自给整个项目改许可证。没有使用《激流快艇2》的任何模型、地图、音频或贴图。

后续竞速氛围修订新增原创 `original-glazing-normal.png` 和 `original-glazing-roughness.png`（512×1024），以及CityAtmosphere代码绘制的品牌、赛事、商业及全息屏幕；没有新增下载模型/贴图。三栋主建筑、低精度天际线、商业入口、维修设施、遮棚与轨道继续由同一Blender源制作。最新预算/截图以 atmosphere-validation.md 为准。

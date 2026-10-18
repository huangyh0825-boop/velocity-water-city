# 城市公共空间资产

- `public-citizens.blend`：本站静态观众的可编辑源文件。
- `../../public/models/city-sample/public-citizens.glb`：运行时资产，四个站立/观赛/行走定格/挥手姿态，每个人体主体11,638三角形，另有领口、衣缝与鞋底边线。
- 人体基础：Blender Foundation / Blender Studio / Blender Community，Human Base Meshes Asset Bundle v1.4，`GEO-body_male_realistic`。来源：https://www.blender.org/download/demo-files/#assets 。原始资产及随包CC0说明已保留在 `assets/racecraft/source/human-base-cc0.blend` 和 `human-bundle-readme.txt`。
- 许可：该人体基础依随包说明为CC0，可公开再分发。本轮改作同为CC0，不要求署名。保留来源方便审计。
- 注意：源目录另有一份关于 **Rain Rig** 的CC BY说明；本轮没有使用Rain模型或其绑定，不能将其许可误套给本次人体基础。
- 本轮修改：衣服体积与材料分区、裤装与鞋、缝线/领口、人体姿态变形、皮肤和服装颜色变体、512px布料法线。动作是烘焙静态姿态，不是NPC系统或角色动画系统。
- 生成命令：Blender后台运行 `scripts/art/build-city-public.py`。
- 植物、长椅、铺装、曲顶廊架、商业柜台、设备站、公共艺术为本项目原创程序网格，运行时共享几何和材质批次。三类树冠使用小型凸体叶片，不使用大号交叉树叶卡片。
- 增补的中小型建筑直接复用原样板区的完整 `city-modules.glb`，不使用简化盒子替换。可见室内沿用 CityGlass / CityInteriors。
- 新观众的中/远距主体分别为3,490/1,396三角形，近景保持11,638三角形。只在投影误差小于0.9物理像素时切换；主角/AI快艇、车手和建筑没有使用本轮观众LOD。
- `lod-error.json`记录Blender中实测双向顶点到表面最大/RMS误差；`scripts/art/validate-city-public.py`可重新验证。运行时使用向上留余量的误差界，不凭距离直接隐藏人物。
- 四姿态与全部细节层合计运行时GLB约78,372三角形；文件包含复用原型，不能把所有层相加当成单个人物的绘制面数。`citizens-stats.json`列出近景主体面数。
- 三类树冠保持全部叶片；叶片仅在误差小于0.6物理像素时切换支撑网格。共享实例按主视角、镜面视角和阴影分别管理，避免反射渲染覆盖主视角的实例缓冲。

# Lumen Waterfront · 280m 城市样板

游戏仅替换中央水道约155–425米附近的视觉资产。赛道、检查点、碰撞、AI、艇和角色保持原逻辑。物理水道数据没有复制到新的独立导航系统。

Blender 模块集合：

- `01_Aster_Curve_Tower`：截面连续渐缩、弯曲中轴，圆角幕墙与曲线冠部。
- `02_Helix_Split_Tower`：扭转的双椭圆翼楼、独立立柱和空中连廊。
- `03_Marina_Atrium`：退台曲面展馆、外廊护栏、真实开孔中庭与台阶。
- `04_Lumen_Bridge`：桥面倒角、曲线压拱、吊杆、桥墩基础、支座环、完整栏杆。
- `05_Curve_Quay`：沿原路线扫掠的岸台、压顶、栏杆、护舷、系缆桩、灯具和码头。
- `06_Stage_Placements`：建筑集合实例，便于在Blender中编辑和复用。

可编辑源文件：`source/waterfront-sample.blend`，贴图已打包。原始贴图位于 `textures/`。中庭布尔开孔已烘焙为拓扑，其余主要曲线和倒角/加权法线仍保留。运行导出时复制源对象、应用修改器、按材质合并，不破坏源文件。

重建方法（已配置的本机便携版本）：

```powershell
& '.qa/tools/blender/blender-4.5.9-windows-x64/blender.exe' --background --factory-startup --python scripts/art/build-city-sample.py
```

也可以把路径替换成安装版 `blender.exe`。结果写入 `public/models/city-sample/`。`route.json` 是固定现有赛道的参考采样，不改变路线；自动化测试会检查它与游戏数据仍匹配。

样板GLB为纯视觉，标准/低精度均按7个材质组合并；保留两种质量缓存，切换不会反复创建新贴图。基础细节未制作为单独动态对象，角色/比赛逻辑不依赖建筑节点。素材许可证和实际下载核验见 `docs/city-sample/resources.md`。

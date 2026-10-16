# 当前竞速视觉资产 · 2026-10-16

玩家使用 Blender 重构的 **VECTOR R8 PWC** 与 **R3 真人比例骑手**；AI及低画质继续使用原有低精度资产。来源、许可证和历史版本见 `assets/racecraft/README.md`。本目录数值以 `manifest.json` 为准。

| 文件 | 几何GLB体积 | 三角面 | 导出材质组 |
|---|---:|---:|---:|
| watercraft.glb | 102,633,960 B | 3,419,130 | 21 |
| rider.glb | 67,519,076 B | 1,437,700 | 15 |
| watercraft-low.glb | 787,168 B | 21,611 | 10 |
| rider-low.glb | 470,132 B | 9,929 | 6 |

高精度模型还依赖 **`pwc-r8/textures/`和`rider-r3/textures/`** 中各19张相对路径PNG，合计130,275,118 B。保留完整目录；仅拷贝GLB会丢失贴图。船体贴图为2048²及一张1024²仪表，骑手贴图为2048²。没有外部CDN依赖，也不需要Draco解码器。

`npm run assets:build` 通过 `scripts/build-racecraft.mjs` 依次运行 `rebuild-hero-pwc.py` 与 `rebuild-hero-rider.py`，只重新生成玩家高精度资产。需要Blender 4.5+，可设置 `BLENDER_PATH`；普通开发与构建直接使用已提交资产。

可编辑源：

- `assets/racecraft/source/hero-pwc-r8.blend`：重构的主壳、船头、收腰侧体、座椅、一体驾驶舱；保留已有完整喷泵、握把和脚槽机械件。
- `assets/racecraft/source/hero-rider-r3.blend`：CC0人体基础上的连续竞速服、新全盔/靴子/浮力背心；保留43骨骼坐姿绑定和握把IK接口。

局部+Z为船头。`RiderSeat`、`Grip_L/R`、`Foot_L/R`、`JetOutlet`挂点保持不变。新模型只替换视觉资源，不提供新的物理碰撞体。车手特技继承视觉组旋转；原有驾驶、AI、比赛与碰撞代码保持独立。

验收图、实际浏览器测试及限制见 `docs/hero-water-rebuild-validation.md`。

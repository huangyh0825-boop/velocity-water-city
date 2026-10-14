# 原创视觉资源

制作方式：`scripts/build-models.mjs` 使用原创 Catmull-Rom 截面放样、封口曲面、轮廓挤出及管线生成；静态船体按材质合并，使用 GLTFExporter 导出二进制 GLB。运行 `npm run assets:build` 可重复生成。

环境未发现可用 Blender；没有人工雕刻、外部游戏模型、照片贴图或骨骼蒙皮。这是可编辑的代码曲面资产工作流。后续可在 Blender 导入 GLB 继续手工调整。

| 文件 | 体积 | 三角面 | 材质组/绘制 |
| --- | ---: | ---: | ---: |
| watercraft.glb | 1,658,964 B | 17,224 | 5 |
| watercraft-low.glb | 926,268 B | 9,592 | 5 |
| rider.glb | 305,904 B | 11,968 | 19 |
| rider-low.glb | 164,876 B | 5,784 | 19 |

全套约 3.06 MB。玩家随画质选择标准/低精度；AI 复用低精度资源，缓存模型模板和基础几何。颜色材质按艇克隆。没有 Draco 压缩或额外解码依赖。

船体局部 +Z 为船头，静态艇体节点 `Hull`。角色节点 `Racer`、`RiderTorso`、`UpperArm_-1/1`、`Forearm_-1/1` 用于分层姿态动画。视觉旋转不会改动物理胶囊体。上身前倾/侧倾、握把及落地缓冲由 `Rider.ts` 控制，特技跟随 `Watercraft` 视觉组。

来源记录见 `docs/assets-license.md`；详细数值以同目录 manifest.json 为准。

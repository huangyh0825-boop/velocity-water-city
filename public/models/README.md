# 当前竞速视觉资产 · R8 PWC / R4车手

标准画质下，玩家与四名AI使用同一套高精度模型，只有队色区别。取消了AI固定加载旧低精度模型的路径。用户主动选择低画质时，全体使用同一回退档次。

| 文件 | GLB体积 | 三角面 | 材质组 |
|---|---:|---:|---:|
| watercraft.glb | 102,633,960 B | 3,419,130 | 21 |
| rider.glb | 71,141,176 B | 1,508,630 | 15 |
| watercraft-low.glb | 787,168 B | 21,611 | 10 |
| rider-low.glb | 470,132 B | 9,929 | 6 |

上述 GLB 是保留的原始运行资产。当前标准画质实际加载 `watercraft-packed.glb.gz` 与 `rider-packed.glb.gz`：先在 Worker 解压 gzip，再以 EXT_meshopt_compression 还原。所有顶点、索引、法线、UV、骨骼及权重逐字节相同，不简化网格或量化。37个原始PNG引用合并为31张相同像素的无损WebP，位于 runtime-textures/；原始PNG和GLB保留在本地。船体贴图以2048²为主，LCD为1024²；车手为2048²，不依赖外部CDN。发布构建自动复制实际依赖的完整资源集合。

可编辑源：assets/racecraft/source/hero-pwc-r8.blend、hero-rider-r4.blend。构建脚本scripts/build-racecraft.mjs依次运行rebuild-hero-pwc.py和rebuild-rider-r4.py，需要Blender 4.5+；正常运行、测试和生产构建直接使用提交的资产。

R4车手46骨骼，含28手指骨骼、新胸椎及双锁骨；骑姿、握把IK、前倾、侧倾、空中及落水姿态均为视觉动画。RiderSeat、Grip_L/R、Foot_L/R、JetOutlet挂点和物理碰撞体不变。AI骨骼和材质独立，几何/贴图共享；同档模型不会发生某个AI回退。

来源、CC0许可证、原创部分和历史版本见assets/racecraft/README.md。实际截图见docs/rider-ai-review/index.html；验证与已知限制见docs/rider-ai-validation.md。

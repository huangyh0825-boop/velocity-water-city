# 第 1 轮：资源与质感联合优化检查点

本机候选已经通过下列验证，用户随后要求继续第 2 轮。没有推送或部署。第 2 轮将另保留数据，避免混写轮次。

RTX 4060 Laptop / Ryzen 9 7945HX / Edge，1600×1000 DPR1，标准画质。基准版本 b17679f。原版在退出另一款游戏后重新测量，紧接着测新版。七场景每次预热 120 帧、记录 360 帧。对比解除渲染上限，生产默认 60；物理保持固定 60Hz。

|场景|原 FPS → 本轮 FPS|1% Low FPS|GPU ms|CPU 提交 ms|
|---|---:|---:|---:|---:|
|进入赛道|31.6 → 34.1|27.6 → 24.2|31.5 → 29.1|17.2 → 17.9|
|中央商务区|67.9 → 66.4|49.5 → 46.9|14.6 → 15.1|14.3 → 14.7|
|密集科技区|33.6 → 36.8|27.0 → 28.5|29.1 → 26.5|17.1 → 17.4|
|高架水道|34.4 → 37.4|27.1 → 29.0|29.6 → 27.5|18.8 → 19.2|
|高速行驶|66.1 → 69.2|33.5 → 39.1|15.0 → 14.4|13.0 → 13.2|
|五艇同屏|38.0 → 41.3|28.2 → 30.9|26.2 → 24.3|17.0 → 17.2|
|水花与氮气|38.9 → 41.8|26.3 → 29.4|25.6 → 23.7|17.7 → 17.6|

|资源|原版|本轮|
|---|---:|---:|
|纹理 API 分配估算 MiB|1095.1|410.4|
|顶点/索引等 buffer 分配 MiB|273.2|265.2|
|浏览器进程合计私有提交 MiB|4411.4|2833.6|
|浏览器私有驻留 MiB|2740.2|1861.5|
|JS Heap MiB|68.8|61.7|
|ArrayBuffer 等 backing store MiB|297.6|458.4|
|本机冷启动 ms|9848|9839|

纹理数字是 WebGL 请求的存储估算，不是游戏独占物理显存。进程私有提交与驻留分别列出，不冒充系统内存或显存。压缩 mip 数据保留在 CPU 侧，ArrayBuffer 指标升高；总进程内存下降。初次 shader 编译数量从 310 到 342；七场景稳定测量期间新增编译全部为零。本地加载耗时变化很小，不能承诺互联网下载同样改善。下载统计正在补入独立服务器侧统计，旧版 worker 未报告 raw GLB 的字节数，不能用缺失项推断网络总量。

## 实际改变

- 模型不减面、不量化：重新排列顶点缓存顺序与复用 buffer，透明三角顺序保留。原快艇 3,419,130 + 车手 1,508,630 个三角形全部保留，骨骼、UV、插槽和动作保留。
- 原尺寸完整 mip 的 UASTC/KTX2；原始图片和旧 GLB 保留为回退。GPU 压缩是高质量有损格式，没有宣称像素数据无损。城市图片去重并与几何分离，几何 buffer 字节逐项验证。
- 引用计数释放共享模型、纹理、骨骼调色板和解码工作线程；返回首页后 Source/模型引用均归零。三次重开/画质切换/返回与启动中途取消已通过。
- 未使用的自阴影颜色附件改 R8，原 2048 深度与九次采样保留。标准画质的分辨率、320 水网格、1024 倒影、2048 城市/车手阴影都保留。
- 画质高/标准/低和 60/120/不限制。实际 Game.frame 在相同 144Hz 时间序列下三档全部执行 600 次物理步，位置/速度/氮气/计圈结果完全一致。
- 船头弧边护件、颈部护领、服装肩部颜色过渡、织物与橡胶粗糙度、入口雨棚/圆角门框、随艇接触波纹、破碎水冠和喷流压力节均有更新；没有通过曝光更改冒充建模升级。

## 验证与边界

- 实时驾驶 960.1 秒，模拟 960.1 秒，玩家通过 224 个检查点。原版的实时时长也保留在 data/longBefore.json；此项没有加速模拟。
- 完整三圈与两条捷径：玩家和四 AI 全部 72 个检查点、进入完赛。此回归使用加速 QA，仅与上面的真实时长测试分开报告。
- 两真实浏览器客户端的大厅、准备、等待慢玩家、共同五秒倒计时、竞速广播、断线重连、频率上限与退出通过。
- 254 项完整 Node 测试与 13 项 Workers 测试通过；新增水面零贡献裁剪数学测试随后单独通过。最终轮次会再次跑完整测试。四套 TypeScript 检查和生产构建通过。
- 七种触控尺寸通过；原生 iPhone 手势行为没有冒充真机验收。
- 第一轮多艇场景依然约 34–42 FPS，未达到普遍 60 FPS。1% Low 在进入赛道的场景有波动，不能宣称全部场景更稳。人物面部、局部服装和单平面水反射仍有表现上限。

## 同机位图像

- boat-left-front-45：[原版](images/before-boat-left-front-45.jpg) / [本轮](images/after-boat-left-front-45.jpg)
- boat-right-rear-45：[原版](images/before-boat-right-rear-45.jpg) / [本轮](images/after-boat-right-rear-45.jpg)
- rider-riding：[原版](images/before-rider-riding.jpg) / [本轮](images/after-rider-riding.jpg)
- rider-side：[原版](images/before-rider-side.jpg) / [本轮](images/after-rider-side.jpg)
- district-cbd：[原版](images/before-district-cbd.jpg) / [本轮](images/after-district-cbd.jpg)
- district-harbor：[原版](images/before-district-harbor.jpg) / [本轮](images/after-district-harbor.jpg)
- district-tech：[原版](images/before-district-tech.jpg) / [本轮](images/after-district-tech.jpg)
- water-cruise：[原版](images/before-water-cruise.jpg) / [本轮](images/after-water-cruise.jpg)
- wake-high-speed：[原版](images/before-wake-high-speed.jpg) / [本轮](images/after-wake-high-speed.jpg)
- turn-spray：[原版](images/before-turn-spray.jpg) / [本轮](images/after-turn-spray.jpg)
- nitro：[原版](images/before-nitro.jpg) / [本轮](images/after-nitro.jpg)
- jump-landing：[原版](images/before-jump-landing.jpg) / [本轮](images/after-jump-landing.jpg)
- hud-racing：[原版](images/before-hud-racing.jpg) / [本轮](images/after-hud-racing.jpg)

完整 PNG 保留在本机 work/final-finish/resource-round1。此目录的 JPEG 只做同参数导出，没有重画或重调色。

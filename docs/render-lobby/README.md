# Render Free 新加坡大厅测试

本阶段使用独立分支 `test/render-singapore-lobby`。正式 GitHub Pages 及仓库变量 `VITE_LOBBY_URL` 继续连接 Cloudflare。没有修改游戏渲染、模型、物理、赛道、AI 或单人流程。

## 实际部署与验收状态

- 代码与本地测试：完成；公网部署和国内测试结果另见部署验收记录，不能用本地通过代替公网结果。
- Git 检查点：`checkpoint/pre-render-lobby-test-20261020` → `1d054f44228e3bed47ca17982b9461d8689633a2`。
- Render 实际域名必须从创建成功的服务页面读取，本文不预设或编造域名。
- 国内无 VPN 可达性：须由用户及朋友在真实网络实测，未确认前禁止切换正式前端。

## Node 与 Cloudflare 功能对照

| 功能 | 原 Node | Render 测试版本 | 保留的 Cloudflare |
| --- | --- | --- | --- |
| 四位房号首次创建、同号加入、退出 | HTTP | HTTP + v1 WebSocket | HTTP + v1 WebSocket |
| 准备、改名、人数同步、房主移交 | HTTP 轮询 | WebSocket 广播，保留 HTTP 兼容 | WebSocket 广播 |
| 房主开赛 | 未实现竞速 | 非房主 403；房主 501，明确尚未开放 | 同左 |
| 断线与恢复 | HTTP 存活时间 | 掉线保留约 30 秒；同设备密钥恢复成员/准备；重复页关闭码 4009 | 约 30 秒宽限及恢复 |
| 重启后的房间 | 内存丢失 | 内存丢失，自动重新入房并提示重新准备 | Durable Object 持久化与休眠恢复 |
| 单房五人、身份校验、Origin 白名单、消息限制 | HTTP 校验 | 共享 v1 校验；2 KiB 文本帧、40 条/分钟/连接 | v1 校验及 Workers 限流 |
| 玩家竞速状态、联机物理 | 无 | 无 | 无 |

Node 对同号房间同时支持当前 `WebSocketLobbyClient` 和旧 HTTP 客户端。私密设备密钥不放 URL、不广播、不写诊断报告。服务器使用 `PORT`，其次 `LOBBY_PORT`，监听 `0.0.0.0`。不信任客户端伪造的代理 IP 头；HTTP 使用会话/设备预算，WebSocket 使用连接预算。

## 免费服务配置

已在根目录提供 `render.yaml`：Web Service / Node / **Free** / **Singapore**，仅部署测试分支，关闭自动部署。

- 构建：`npm ci --include=dev && npm run build:lobby`
- 启动：`node dist-lobby/lobby.mjs`
- 健康检查：`/api/lobby/health`
- 测试页：`/` 或 `/test`
- WS：`/api/lobby/rooms/四位房号/socket`
- `NODE_VERSION=22.x`
- `LOBBY_ALLOWED_ORIGINS=https://huangyh0825-boop.github.io`；测试服务自身 Origin 也允许。

使用 Render 分配的 HTTPS `onrender.com` 地址，WebSocket 选择 WSS。不要建立付费实例、数据库、磁盘或购买域名。若账户要求付款验证，先停下告知用户，不能自行支付。

本地运行：`npm run build:lobby` 后 `node dist-lobby/lobby.mjs`。Windows 缺少 npm 时可用 `pnpm.cmd dlx npm@10 run build:lobby`。浏览器联调：`node scripts/qa/render-lobby-browser.mjs`；设置 `QA_URL` 为实际 Render HTTPS 地址可执行公网联调（不会执行远程服务器重启）。

## 用户和朋友的国内测试

1. 用实际公网测试地址打开本页，关闭 VPN、代理及网络加速器。免费服务休眠后，打开网页本身也可能先显示 Render 唤醒页面约一分钟。
2. 各自填写省/市、运营商和宽带 Wi-Fi/4G/5G 等网络类型；仅真实关闭 VPN 后勾选确认框。
3. 两台设备使用不同玩家 ID，输入相同四位房号。连接按钮会按需重试 HTTP/WSS，最多等待三分钟，可随时取消；记录首次页面响应和按钮点击至入房耗时。
4. 核对人数；双方分别准备和改名，确认立即同步。房主退出后检查另一人变为房主。
5. 一人临时断网后恢复，观察掉线标记及自动重连；超过保留时间或服务器重启会产生新席位并清除旧准备，必须重新核对。服务器重启可能清空全部房间，不能宣称永久保留房间。
6. 保持页面前台、设备不休眠，选择 5 或 10 分钟观察。报告只有实际时间达到、没有断线、且前台观察不中断才记为通过。测试中途隐藏页面或设备休眠不能记为连续通过。
7. 下载/复制 JSON 报告发给开发者。报告包含地区、网络、VPN 自行确认、HTTP/WSS 成功/错误、耗时、重连/断线次数和实际观察时长，不包含设备密钥。请注明另一玩家网络及是否切换网络。

浏览器出于安全限制，WebSocket 的 TLS/DNS 失败可能只返回通用连接错误，不能据此编造具体封锁原因。应保留时间、URL、HTTP 状态与浏览器网络错误截图。两个本机浏览器通过不能替代两台国内真实设备的无 VPN 测试。

## 唤醒、重连与限制

测试页独立处理 HTTP 503、唤醒 HTML、超时及初次 WSS 失败的重试；入房后复用正式游戏的 v1 WebSocket 客户端，保留指数退避、网络恢复及请求超时。原正式游戏 6 秒健康检查没有在本阶段修改；若国内测试通过，正式切换时必须把这里验证过的唤醒等待流程接入首页，再发布，不能只替换 URL。

[Render 官方免费说明](https://render.com/docs/free)：15 分钟没有入站流量后休眠，唤醒约一分钟；每工作区每月共享 750 免费实例小时，耗尽会暂停；出站带宽和构建分钟也受免费额度限制。没有付款方式时超限暂停服务/构建；已有付款方式可能产生额外用量账单，部署前应核对并阻止任何额外付费。免费服务可能重启，内存房间不会持久保存。未配置第三方探活，只有玩家实际连接时的协议心跳；不测试时退出并关闭网页。

## 正式切换与回退

当前不切换。国内实际网络测试通过、用户明确确认后，才把正式首页接入冷启动/重连提示，并设置 GitHub Actions 仓库变量 `VITE_LOBBY_URL` 为实际验证过的 `https://实际服务域名/api/lobby`，构建发布并核验公网脚本与 WSS。

若未来需要回退：把仓库变量恢复为 `https://velocity-water-city-lobby.huangyh0825.workers.dev/api/lobby`，重新发布 GitHub Pages 并确认公开脚本引用正确。Cloudflare Worker 和 Durable Object 均保留；不需要删除 Render 或修改竞速代码。本轮只部署测试分支，所以正式游戏当前就处于 Cloudflare，无需执行回退。

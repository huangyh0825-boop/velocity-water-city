# Cloudflare 免费公网大厅

游戏：[GitHub Pages](https://huangyh0825-boop.github.io/velocity-water-city/)

Worker 名称：`velocity-water-city-lobby`。Wrangler 返回的实际公网地址：`https://velocity-water-city-lobby.huangyh0825.workers.dev`。首个部署版本：`e27caaeb-c320-4473-b4eb-5ecbe997f66f`，启动测量 2 ms。

已从真实 GitHub Pages 来源完成公网 `/api/lobby/health` 跨域检查，返回 200 和 WebSocket 协议能力。部署和公网联调结果见 `docs/cloudflare-lobby/`，每项以实际验收记录为准。

## 架构及兼容性

Worker 只负责 HTTP 入口、Origin 白名单、连接限流和房间路由。四位字符串通过 `ROOMS.getByName(code)` 访问独立 `LobbyRoom`，没有公开房间目录，也不跨房广播。每间最多五人。

`wrangler.jsonc` 用 JSON 配置 `ROOMS` 绑定和 `v1 / new_sqlite_classes: [LobbyRoom]`。使用 SQLite-backed Durable Objects；不创建单独的 D1/KV 数据库，不设置付费订阅，不购买域名。

正式 Origin 仅为 `https://huangyh0825-boop.github.io`，不含路径和末尾斜线。本机 `--env local --local` 使用单独的本地 Origin 列表、限流命名空间和本地存储。不要将 local 环境部署到公网。

现有 `server/lobby.ts` 保留为 Node.js 回退；`npm run build:lobby` 仍生成 `dist-lobby/lobby.mjs`，以便脱离开发依赖运行原 HTTP 服务。旧 `/api/lobby/health` 检查 Node 进程，新 Worker 的同名接口返回 `transport: websocket`；前端据此选择 WebSocket 或旧 HTTP 适配器。单人会话、驾驶、物理、画面和档案存储均沿用原代码。

## 连接和协议

1. `GET /api/lobby/health` 获取传输能力，无房间扫描。
2. `GET /api/lobby/rooms/0042/socket` 升级到 WSS。身份不写入 URL或日志。
3. 十秒内通过第一条 JSON 消息加入：`{v:1,type:"join",id,identity:{deviceId,resumeKey,playerId}}`。默认沿用“首位创建、同号自动加入”。API 也接受 `mode: join`（不存在时报 404）或 `mode: create`（占用时报 409）。
4. 服务器发 `welcome`，后续发送 `room` 快照。`ready`、`rename`、`state`、`leave` 使用请求编号及 `ack/error`。成员关系、人数、顺序及房主由服务器决定。客户端不能提交这些状态。
5. 已认证连接每分钟发送一次固定 `ping`。`setWebSocketAutoResponse` 在运行时直接回应 `pong`，不调用对象消息处理器。客户端八秒未收到回包便重连。没有服务器 `setInterval`，没有每秒 HTTP 轮询。

接收 JSON 帧/HTTP 请求上限 2048 字节，拒绝二进制、无效版本/编号/名称/身份；每个连接最多 40 个业务命令/分钟，额度随附件跨休眠恢复。入口每个来源 IP、每个 Cloudflare 位置最多 20 次新连接/分钟（边缘限流是近似、非全球精确计数）。待认证连接最多十条，十秒未认证会关闭。Origin 白名单不是账号认证，也不能替代限流。

设备的重入密钥只保存 SHA256；WebSocket 的服务器附件保存成员/会话关联和限流窗口。新页面用同一设备档案加入时保留成员 ID 和准备状态、替换旧会话；旧页面收到 4009 后停止争抢重连。状态快照不包含设备标识、密钥摘要、会话 ID 或 Token。

HTTP `/join`、`/state`、`/ready`、`/rename`、`/leave` 也保留作兼容。Cloudflare HTTP Token 的四位前缀只用于定位房间，随机部分的摘要仍由房间校验；篡改前缀不能越权。新前端连接 Cloudflare 时不使用这些轮询接口。

## 休眠与清理

使用 `ctx.acceptWebSocket`、`webSocketMessage`、`webSocketClose/Error`、`serializeAttachment/deserializeAttachment`，不使用会阻止休眠的标准 `ws.accept`。需要恢复的房间成员、房主顺序、准备状态、重连截止时间保存在对象存储中，构造函数通过输入门恢复。只依赖内存的 Map 无法做到这一点。

异常断线在平台检测到后保留成员 30 秒供重连；主动离开立即删除。超时后最早加入的剩余成员接任房主。只有待认证或等待重连的成员才设置一次性 Alarm，处理到期后重新计算最近截止时间。健康、无活动的房间没有 Alarm。空房删除存储及无用 Alarm，由平台回收对象。

Hibernation 可保存健康连接，不能把持续处理高频物理/竞速计算的对象当成一直休眠。这里没有运行游戏物理。

## 开发、测试、部署

```sh
npm ci
npm run dev:lobby:cloudflare
npm run check:lobby:cloudflare
npm run test:lobby:cloudflare
npm test
npm run build:lobby:cloudflare
npm run build
```

本机 Worker 为 `http://127.0.0.1:8789/api/lobby`。前端开发时设置 `VITE_LOBBY_URL` 为该地址；使用白名单内的 5183、5185 或 5187 端口。前端不访问本地 Explorer 管理接口，生产 Worker 不含它。

本次部署时观察到本机系统 DNS 对 `workers.dev` 存在异常解析；实际 Edge 和 Chrome 已能通过有效 HTTPS/WSS 访问。没有修改系统 DNS、关闭证书校验或给正式网页写死 IP。若某台真实设备连接失败，应先核对该设备的网络和解析，再检查服务健康与免费额度，不能把本机 CLI 的解析异常直接等同于服务器故障。

```sh
npx wrangler login
npx wrangler whoami
npm run deploy:lobby:cloudflare
```

部署前确认目标账号为 Workers Free；如果提示升级、付款或新增付费订阅，应停止。成功后使用 Wrangler 返回的实际 `https://…workers.dev` 地址，访问 `/api/lobby/health` 验证。

将 GitHub 仓库的 Actions 变量 `VITE_LOBBY_URL` 设置为 `https://实际地址/api/lobby`，然后重新发布 Pages。工作流将变量注入 `npm run build`。只改本机被忽略的 `.env.production.local` 不会更新 GitHub 的构建。HTTPS 网页必须连接 HTTPS/WSS。

联调用 `QA_URL=真实游戏网址 node scripts/qa/cloudflare-lobby-browser.mjs`：两个独立浏览器检查入房、准备、改名、刷新、掉线恢复、重复页面、房主转移、房间隔离和无 HTTP 轮询。两台真实设备的外网测试需要用户验证，两个浏览器不等于两台真实设备。

## 日常维护

- 查看日志：`npx wrangler tail --config cloudflare/wrangler.jsonc --env=`；仪表盘 Workers & Pages → 对应 Worker → Logs。不要输出请求身份或 Authorization。当前只采样 10% 平台调用日志。
- 查看额度：账号 Workers & Pages 用量、Worker Metrics、Durable Objects 用量/存储；同时看请求、时长、读写行和错误，不能只看在线人数。
- 更新：跑上述测试，再 `npm run deploy:lobby:cloudflare`；有接口变化时同时更新前端并发布 Pages。
- 回滚 Worker：`npx wrangler deployments list --config cloudflare/wrangler.jsonc --env=` 找到旧版本，再 `npx wrangler rollback 版本ID --config cloudflare/wrangler.jsonc --env=`。已有 Durable Object 迁移不可随意删除/重命名；备份标签 `checkpoint/pre-cloudflare-lobby-20261020` 保留原 Node 实现。
- 临时回退：另行启动保留的 Node 服务，再修改前端地址并重新发布；不要把 localhost 作为公网回退地址。当前不依赖 Render。
- 服务器异常：先检查 health、Worker 日志和账号免费额度；排查 Origin 和客户端版本，恢复后客户端会退避重连。不要用高频探活绕过平台限制。
- Worker 部署/重启可能断开连接；成员持久化和设备档案可用于重入，不承诺连接永不断开。

## 当前免费额度与规模估算

2026-10-20 官方文档核对：

| 项目 | Workers Free 当前额度 |
|---|---|
| Worker 请求 | 100,000 / 天 |
| Durable Objects 计费请求 | 100,000 / 天，包含升级、消息折算和 Alarm |
| Durable Objects 时长 | 13,000 GB-s / 天 |
| SQLite 行读取 | 5,000,000 / 天 |
| SQLite 行写入 | 100,000 / 天，删除、Alarm 等也计入 |
| SQLite 总存储 | 5 GB / 账号，Free 单对象上限按官方限制页核对 |
| Worker CPU / 内存 | 每次 HTTP 请求 10 ms / 128 MB |
| Durable Object CPU / 内存 | 文档默认每次事件 30 s / 128 MB；这不是可持续竞速时长额度 |

Durable Object 入站 WebSocket 业务消息按官方计费规则以 20:1 折算请求；出站消息和协议级 Ping 不计请求费，应用层 auto-response 不额外计对象墙钟时长。仪表盘可能显示未经 20:1 折算的实际消息数，免费硬限还应以账号实际指标及当时文档核对，不能将计费折算视为原始消息容量保证。超额时免费服务可能拒绝请求，而不是自动获得无限资源。

先用于朋友测试，建议从 5–10 个五人大厅开始监控；这不是已经压测的并发保证。大厅等待时可休眠，房间人数与准备状态只在变化时写入。未来竞速若每房五人、每人 10Hz、持续一小时，单房入站约 `5×10×3600=180,000` 帧，约 `9,000` 次 DO 计费请求，十房已接近一天请求额度。还需另算连接/Alarm、计算时长、存储和带宽。

未来接口已预留版本、序号和 `race.batch` 数据结构，服务器目前明确拒绝竞速状态；非房主 `start` 返回 403，房主返回 501（未开发）。下一阶段才接入权威开赛、位置差量/合批、10–15Hz 上限、客户端插值、速度/顺序校验和完赛事件。不要每帧同步，不要每条位姿都写入存储。持续高频竞速需要重新测算时长与免费额度，不能沿用大厅休眠估算。

官方参考：[WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)、[DO 价格](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[Worker 限制](https://developers.cloudflare.com/workers/platform/limits/)、[DO 限制](https://developers.cloudflare.com/durable-objects/platform/limits/)。免费政策可能变化，发布前应重新核对。

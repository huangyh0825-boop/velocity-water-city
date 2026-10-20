# Cloudflare 大厅迁移验收

后台：`https://velocity-water-city-lobby.huangyh0825.workers.dev/api/lobby`。

前端：`https://huangyh0825-boop.github.io/velocity-water-city/`。

Wrangler 4.151.3 部署版本 `e27caaeb-c320-4473-b4eb-5ecbe997f66f`，SQLite Durable Object 类 `LobbyRoom`，绑定 `ROOMS`。后台 Workers & Pages 已显示每日 100,000 请求的免费额度及 `huangyh0825.workers.dev` 子域；未升级订阅、未购买域名或其他服务。部署只包含约 18 KiB 大厅代码，无模型、地图或游戏物理。

本地：194 项 Node 自动化测试、13 项真实 workerd 测试、游戏/Worker 类型检查、前端生产构建、Node 回退服务构建、Wrangler 部署预演均通过。Workers 测试覆盖并发五人上限、非法 Origin/格式/身份/跨房 Token、非房主开赛拒绝、超大与二进制帧、限流、实际 eviction 后的 WebSocket 及 SQLite 状态恢复、掉线宽限、房主转移和空房清理。

`local-browser.json` 为本机 Edge + Chrome 联调，覆盖同号入房、准备、改名、刷新、离线/恢复、重复页替换、主动离开、房主转移和房间隔离；没有 HTTP 状态轮询，也未加载 3D 模块/模型。

`game-core-unchanged.json` 比较已上线版本与迁移后生产 Game 模块，除入口脚本引用名外字节一致。单人触屏启动、加速、返回首页和记录保存也通过，实测加速至 84 km/h。

`worker-public.json` 为实际 GitHub Pages 来源发出的 HTTPS 跨域健康检查（200），不是本机代理结果。

正式游戏页面的公网房间验收将在配置并发布前端后记录到 `online-browser.json`；两台真实设备仍需用户验证，两个浏览器不能替代真实设备测试。

运行维护、免费额度、重新发布、回滚及未来竞速的资源估算见 `cloudflare/README.md`。当前实现为公网大厅，未实现玩家实时竞速。

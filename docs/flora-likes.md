# 花花小窝喜爱数据维护

- 入口 `/anutrium/data`：编辑花花／小黑总数、查看近7／30／90天点击趋势与国家／设备／浏览器统计、最近30次改数记录。
- 页面与读取接口使用 `requireUser()`；写入使用 `requireAdmin()`，校验同源与实际请求体大小，只读账号直接写入也返回403。
- 浏览器访问 `/api/data/flora-likes`；Next 服务端代理到 Anutrium Worker `/admin/floratrium/likes`。复用 `HOME_FEATURES_TOKEN`，地址默认由 `HOME_FEATURES_URL` 域名推导；可选服务端 `FLORA_LIKES_URL` 覆盖。
- 先发布 Anutrium Worker 的 `FLORA_LIKES` SQLite Durable Object 和 migration，再发布本站。没有部署时显示读取失败，不展示虚构数量。
- 修改数量必须携带读取时的版本；遇到新点击或其他管理员修改会返回409，重新读取后再保存。人工改数不改变实际点击统计。
- 访客每浏览器每天两只合计10次，北京时间零点重置。匿名身份有跨设备及清除存储的去重限制，不存储原始IP。
- 测试：`npm test`、`npm run typecheck`；`PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/flora-likes.spec.ts`。所有测试写请求均mock，不修改线上数据。

# AnuConsole

Anutrium（[anuluca.com](https://anuluca.com)）的独立管理后台。Next.js App Router、React、TypeScript；主题色 `#E23456`。

## 本地运行

```sh
npm install
npm run dev
```

打开 [http://127.0.0.1:3002](http://127.0.0.1:3002)。账号固定为 `admin`，密码通过交互式命令设置。当前机器已配置 `.env.local` 时跳过初始化。开发服务默认由用户启动并保持运行，助手仅复用该服务。

`npm run dev` 的开发环境可直接访问四个业务页面，无需登录或配置管理员。生产环境 `npm run build` / `npm run start` 仍需配置管理员并登录。开发环境保留 `/login` 供预览登录界面。

| 路由 | 页面 | 访问权限 |
| --- | --- | --- |
| `/login` | 管理员登录 | 公开，已登录时跳转首页 |
| `/` | 首页 | 开发免登录，生产 admin |
| `/monitor/ga4` | 监视器 → GA4浏览量 | 开发免登录，生产 admin |
| `/features` | 功能调整 | 开发免登录，生产 admin |
| `/data` | 数据维护 | 开发免登录，生产 admin |

首页、功能调整和数据维护保留空内容区；监视器接入网站既有 GA4 聚合报表。

界面字体使用 Adobe Typekit 项目 `vjg4wuk` 的 `alibaba-puhuiti`。右上角可选择自动、浅色或深色主题，默认按浏览器本地时间 07:00–19:00 显示浅色，其余时间显示深色；偏好保存在当前浏览器中。路由内容切换时快速闪烁两下，启用减少动态效果时关闭动画。Next.js 开发指示器已禁用。

登录标题 `DRIVEN BY CONSOLE.` 使用 R2 上的 Anton 字体，品牌标题及副标题使用 R2 上的 UnboundedSans。除右下角版权外，界面文字统一为 900 字重。登录页最大宽度 1360px，左侧为无卡片的自动代码输入动画，登录按钮紧凑且右对齐。主题下拉支持键盘操作与外部点击关闭；退出确认框使用柔和阴影与入场、退场动画。登录页与后台间有淡入过渡，菜单与面包屑均使用中文。

## 身份认证 (Authentication)

- 密码使用随机盐与 scrypt 保存为哈希，不向客户端暴露；环境文件已被 `.gitignore` 排除。
- iron-session 加密会话保存在 `HttpOnly`、`SameSite=Strict` Cookie 中，有效期 8 小时；生产环境启用 `Secure`。
- 布局及每个业务页面分别执行服务端授权。后续数据查询、接口及 Server Actions 必须调用 `requireAdmin()`。
- 登录、退出使用 Next.js Server Actions，保留框架自带的来源检查；不开放跨源登录接口。
- 每个服务进程一分钟最多接受 10 次登录尝试。多实例部署前应使用共享限流存储或在反向代理配置限流。
- 修改密码执行 `npm run setup:admin -- --force`，然后重启服务；会同时轮换会话密钥，使已有会话失效。退出会清除当前浏览器 Cookie。

## 检查

```sh
npm run typecheck
npm test
npm run build
# 复用已运行的开发服务：
npm run test:e2e
# 复用生产服务进行认证回归时，在交互式终端输入测试密码：
read -s E2E_ADMIN_PASSWORD
export E2E_ADMIN_PASSWORD
E2E_AUTH_MODE=production npm run test:e2e
unset E2E_ADMIN_PASSWORD
```

浏览器测试默认覆盖开发环境免登录、路由切换与几何稳定性、主题切换和指定文案删除；`E2E_AUTH_MODE=production` 额外校验生产环境登录、未登录拦截、会话保持与退出。

## 部署

需要 Node.js 24+ 服务端运行环境，不能作为纯静态站点导出。通过部署平台的私密环境变量配置 `ADMIN_PASSWORD_HASH` 和至少 32 字符的随机 `SESSION_SECRET`，不要将 `.env.local` 提交到仓库。

```sh
npm ci
npm run build
npm run start
```

生产环境必须通过 HTTPS 反向代理访问，默认仅监听 `127.0.0.1:3002`。Next.js 官方部署平台可使用其标准启动配置。

当前视觉参考：[路卡的自由庭院岛](https://anulucas-blog.pages.dev/)。采用纯色背景与透明玻璃层级，以半透明、磨砂、细边框和间距区分导航、主体与内容面板；不使用背景图片，强调色保留 `#E23456`。

## 监视器

“监视器”为可展开的菜单分组，子页面 `/monitor/ga4` 为“GA4浏览量”，旧地址 `/monitor` 自动跳转到子页面。子页面通过受保护的 `/api/analytics/summary?days=7|30|90` 和 `/api/analytics/realtime` 读取既有 Anutrium 统计接口。默认上游为 `https://steam-api.anuluca.com/analytics`；可通过服务端环境变量 `GA4_REPORTS_URL` 调整 HTTPS 地址，无须复制 Google 服务账号密钥。后台不加载 GA4 采集脚本。

- 默认展示近 7 天，保留近 7 / 30 / 90 天切换；移除顶部工具栏标题与说明；包含 11 项概览指标、每日趋势、23 份常规报表中的全部明细，以及实时活跃用户、国家和事件。
- 更新时间使用 Day.js RelativeTime 的简体中文默认规则，自动显示几秒、分钟、小时、天、月或年前；悬停可查看北京时间的完整日期。
- 常规数据仅含 `anuluca.com` 和 `www.anuluca.com`，实时数据按原数据流筛选，可能包含该流的其他域名访问。
- 常规统计每 10 分钟读取，实时统计每分钟读取。切到后台暂停轮询，离开页面取消旧请求，重试复用上游当前缓存。
- 没有数据、读取失败和部分报表不可用分别展示；失败不伪造零值。同一范围刷新失败时保留上次结果并提示。
- 上游数据经过服务端结构校验，接口仅接受固定报表和时间范围，所有响应使用 `private, no-store`，不向客户端暴露凭证。
- 分类报表保留隐私阈值、抽样、高基数及前若干项的提示。趋势可展开每日数据，表格支持键盘横向滚动。

检查监视器：`npm test`、`npm run typecheck` 和 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- tests/monitor.spec.ts`。浏览器界面测试使用明确的测试夹具；真实上游连通性需独立验证。

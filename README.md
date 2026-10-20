# AnuConsole

网站运维支持 Cloudflare DNS 和 Netlify 项目、部署、环境变量及项目设置，入口和凭据配置见 [网站运维文档](docs/infrastructure.md)。

Anutrium（[anuluca.com](https://anuluca.com)）与 DRRR情报屋的管理后台。Next.js App Router、React、TypeScript；项目强调色分别为 `#E23456` 与 `#f4f500`。

## 本地运行

```sh
npm install
npm run dev
```

打开 [http://127.0.0.1:3002](http://127.0.0.1:3002)。管理员账号为 `admin`，可选只读账号为 `user`，密码通过交互式命令设置。当前机器已配置 `.env.local` 时跳过管理员初始化。开发服务默认由用户启动并保持运行，助手仅复用该服务。

开发服务监听 `0.0.0.0:3002`，同一局域网的设备可通过 `http://<本机局域网 IP>:3002` 访问。修改监听地址后需手动重启开发服务才能生效。

`next.config.ts` 的 `allowedDevOrigins` 自动包含 `127.0.0.1` 和本机网卡的 IPv4 地址，允许开发热更新 WebSocket 正常连接。仅修改监听地址而未允许访问来源，可能导致 React 水合等待开发调试通道，表现为页面显示但按钮无法响应。网卡 IP 变化后重启开发服务以重新读取地址。

`npm run dev` 的开发环境可直接访问业务页面，无需登录或配置管理员。生产环境 `npm run build` / `npm run start` 仍需配置管理员并登录。开发环境保留 `/login` 供预览登录界面。

| 路由 | 页面 | 访问权限 |
| --- | --- | --- |
| `/login` | 账号登录 | 公开，已登录时跳转首页 |
| `/` | 跳转到 Anutrium 首页 | 开发免登录，生产 admin / user / guest |
| `/anutrium`、`/anutrium/about` | Anutrium 首页、关于 | 开发免登录，生产 admin / user / guest |
| `/anutrium/monitor/ga4` | Anutrium 监视器 → GA4浏览量 | 开发免登录，生产 admin / user / guest |
| `/anutrium/features`、`/anutrium/data` | Anutrium 功能调整、数据维护 | admin 可修改，user / guest 只读 |
| `/drrr`、`/drrr/about` | DRRR情报屋首页、关于 | 开发免登录，生产 admin / user / guest |

Anutrium 首页展示四项浏览量概览指标、实时活跃用户、每日趋势和路卡雕像的头疼模式开关；概览和趋势固定读取今天，不显示时间范围切换、更多指标、更新时间栏和分类报表。读取和轮询策略与监视器一致，开关权限及计数与功能调整页一致。其他项目首页及数据维护页保持空内容区；关于页介绍当前项目与控制台职能，并链接到 [AnuConsole GitHub 仓库](https://github.com/Anuluca/AnuConsole)。监视器接入网站既有 GA4 聚合报表。项目菜单与颜色在 `src/lib/projects.ts` 配置，页面 URL 包含项目名；旧业务地址不保留。

界面正文使用系统字体（Arial、PingFang SC、Microsoft YaHei），无需第三方字体加载服务。右上角可选择自动、浅色或深色主题，默认按浏览器本地时间 07:00–19:00 显示浅色，其余时间显示深色；偏好保存在当前浏览器中。路由内容切换时快速闪烁两下，启用减少动态效果时关闭动画。Next.js 开发指示器已禁用。

登录标题 `DRIVEN BY CONSOLE.` 使用 R2 上的 Anton 字体，品牌标题及副标题使用 R2 上的 UnboundedSans。除右下角版权外，界面文字统一为 900 字重。登录页最大宽度 1360px，左侧为无卡片的自动代码输入动画，登录按钮紧凑且右对齐。主题下拉支持键盘操作与外部点击关闭；退出确认框使用柔和阴影与入场、退场动画。全站不自动聚焦控件、标题或容器，弹窗关闭后也不自动恢复焦点；使用 Tab 手动选择控件。登录页与后台间有淡入过渡，菜单与面包屑均使用中文。

## 身份认证 (Authentication)

- 密码使用随机盐与 scrypt 保存为哈希，不向客户端暴露；环境文件已被 `.gitignore` 排除。
- iron-session 加密会话保存在 `HttpOnly`、`SameSite=Strict` Cookie 中，有效期 8 小时；生产环境启用 `Secure`。
- 布局、业务页面和读取接口调用 `requireUser()`；业务写入必须调用 `requireAdmin()`。user 与游客 guest 可以查看统计、页面和开关状态，但开关禁用，直接写接口返回 403；角色始终由服务端账号配置确定。
- 登录、退出使用 Next.js Server Actions，保留框架自带的来源检查；不开放跨源登录接口。
- 每个服务进程一分钟最多接受 10 次密码登录尝试。多实例部署前应使用共享限流存储或在反向代理配置限流。
- 修改密码执行 `npm run setup:admin -- --force`，然后重启服务；会同时轮换会话密钥，使已有会话失效。退出会清除当前浏览器 Cookie。

登录页默认选择“游客”，点击“游客访问”即可建立 8 小时有效的只读会话，无需账号密码或 `VIEWER_PASSWORD_HASH`。游客可以查看所有受保护的业务页面和读取接口，所有业务写入返回 403；服务端仍需配置管理员与会话密钥。切换“管理员”标签后使用账号密码登录。原 `user` 密码登录继续兼容。

### 只读账号 user

在项目根目录运行 `npm run setup:viewer`，按终端提示输入并确认独立密码。脚本仅向 `.env.local` 添加 `VIEWER_PASSWORD_HASH`，不会覆盖管理员、会话密钥和其他配置，不显示明文密码。未配置该哈希时 user 不能登录。

Netlify 上线时，再将 `.env.local` 中的 `VIEWER_PASSWORD_HASH` 同步到该项目的私密环境变量，勾选 Contains secret values，作用域包含 Functions，然后重新部署。登录账号填写 `user`，密码填写刚才设置的明文密码，不是哈希。

重置只读密码运行 `npm run setup:viewer -- --force`，只会使旧 user 会话失效；移除 `VIEWER_PASSWORD_HASH` 则禁用该账号。管理员密码重置仍会轮换共享会话密钥，使所有已有会话失效；脚本保留只读账号和业务密钥。开发环境匿名免登录保留，但已登录的 user 不会因此获得写权限。

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

`tests/responsive-reload.spec.ts` 额外验证直达、连续刷新及路由切换后的布局一致性，并由 `mobile-safari` 项目使用 WebKit 执行。首次运行需安装该浏览器：`npx playwright install webkit`。WebKit 回归用于补充 Chromium 手机模拟，不能替代真实 iPhone Safari 验证。

## 部署

### Netlify 自动部署

根目录 `netlify.toml` 已配置 Node.js 24、`npm test && npm run build` 和 `.next` 发布目录。关联 Git 仓库并选择生产分支后，Netlify 自动安装依赖，推送到该分支时执行测试和构建；Next.js 适配器自动处理服务端页面、API 与 Server Actions，无需运行 `npm run start` 或配置 3002 端口。参见 [Netlify 的 Next.js 部署说明](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)。

首次上线需要在 Netlify 完成以下设置：

1. 将本项目仓库关联到独立的 Netlify 项目，根目录作为构建目录，使用仓库内的 `netlify.toml`。
2. 在项目的私密环境变量中配置 `ADMIN_PASSWORD_HASH`、`SESSION_SECRET` 和 `HOME_FEATURES_TOKEN`，作用域必须包含 **Functions**。前两项可从本机 `.env.local` 安全迁移，`HOME_FEATURES_TOKEN` 必须与 Anutrium Worker Secret 一致；不将 `.env.local` 上传或提交到 Git。
3. 如需覆盖默认接口地址，在同一处配置 `GA4_REPORTS_URL` 或 `HOME_FEATURES_URL`，同样包含 Functions 作用域。`netlify.toml` 的构建环境变量不能替代函数运行时密钥。
4. 在域名管理中添加 `console.anuluca.com` 并设为生产主域名，按 Netlify 提供的信息配置 DNS，确认 HTTPS 证书生效。配置文件本身不会绑定域名。
5. 发布后访问 `https://console.anuluca.com`，确认未登录访问业务页面会进入登录页，再检查统计读取与功能开关。修改运行时环境变量后重新部署。

生产模式保持管理员认证；Netlify 部署不会启用本地开发免登录规则。已有的每进程登录限流不能在多个函数实例间共享，线上可在入口配置统一限流。

### 自行部署 Node.js 服务

需要 Node.js 24+ 服务端运行环境，不能作为纯静态站点导出。通过部署平台的私密环境变量配置 `ADMIN_PASSWORD_HASH` 和至少 32 字符的随机 `SESSION_SECRET`，不要将 `.env.local` 提交到仓库。

```sh
npm ci
npm run build
npm run start
```

生产环境必须通过 HTTPS 反向代理访问，默认仅监听 `127.0.0.1:3002`。Next.js 官方部署平台可使用其标准启动配置。

当前视觉参考：[路卡的自由庭院岛](https://anulucas-blog.pages.dev/)。采用纯色背景与透明玻璃层级，以半透明、磨砂、细边框和间距区分导航、主体与内容面板；不使用背景图片，强调色跟随当前项目。

## 监视器

“监视器”为 Anutrium 的可展开菜单分组，子页面 `/anutrium/monitor/ga4` 为“GA4浏览量”，`/anutrium/monitor` 自动跳转到子页面。子页面通过受保护的 `/api/analytics/summary?days=1|7|30|90` 和 `/api/analytics/realtime` 读取既有 Anutrium 统计接口。默认上游为 `https://steam-api.anuluca.com/analytics`；可通过服务端环境变量 `GA4_REPORTS_URL` 调整 HTTPS 地址，无须复制 Google 服务账号密钥。后台不加载 GA4 采集脚本。今天（`days=1`）需要上游接口支持该范围后才能正常读取。

- 默认展示今天，支持今天及近 7 / 30 / 90 天切换；移除顶部工具栏标题与说明；包含 11 项概览指标、每日趋势、23 份常规报表中的全部明细，以及实时活跃用户、国家和事件。
- 更新时间使用 Day.js RelativeTime 的简体中文默认规则，自动显示几秒、分钟、小时、天、月或年前；悬停可查看北京时间的完整日期。
- 常规数据仅含 `anuluca.com` 和 `www.anuluca.com`，实时数据按原数据流筛选，可能包含该流的其他域名访问。
- 常规统计每 10 分钟读取，实时统计每分钟读取。切到后台暂停轮询，离开页面取消旧请求，重试复用上游当前缓存。
- 没有数据、读取失败和部分报表不可用分别展示；失败不伪造零值。同一范围刷新失败时保留上次结果并提示。
- 上游数据经过服务端结构校验，接口仅接受固定报表和时间范围，所有响应使用 `private, no-store`，不向客户端暴露凭证。
- 分类报表保留隐私阈值、抽样、高基数及前若干项的提示。趋势可展开每日数据，表格支持键盘横向滚动。

检查监视器：`npm test`、`npm run typecheck` 和 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- tests/monitor.spec.ts`。浏览器界面测试使用明确的测试夹具；真实上游连通性需独立验证。

## 功能调整

密钥配置、备份与丢失后的恢复步骤见 [首页功能开关备忘](docs/home-features-memo.md)。

`/anutrium/features` 的“首页”模块提供“路卡雕像的头疼模式”开关。页面先读取真实状态；读取失败时显示状态未知并禁用开关，重试后恢复。保存期间禁用开关，收到服务端成功结果后更新；保存失败则重新读取确认状态。页面同时显示服务端返回的累计头疼次数；初始历史基数为 10，仅从关闭切换为开启时新增一次记录，关闭和重复保存不计数。记录保存在 Anutrium Worker 既有 R2 配置中。兼容尚未提供 `headacheCount` 的旧 Worker：开关仍可读取和保存，次数显示为暂不可用；旧 Worker 不支持新增发作记录。

浏览器只访问 `/api/features/home`；GET 执行 `requireUser()`，PUT 执行 `requireAdmin()`，PUT 还检查请求来源、JSON 类型、字段和请求体大小。后台使用服务端密钥代理 Worker 的 `/admin/home-features`，不向浏览器暴露密钥或上游错误详情。所有响应不缓存。

上线前在 AnuConsole 的私密服务端环境和 Anutrium Worker Secret 中设置同一个安全随机 `HOME_FEATURES_TOKEN`（至少 32 字符）。上游地址默认 `https://steam-api.anuluca.com/admin/home-features`，可通过服务端 `HOME_FEATURES_URL` 覆盖。不要将密钥加入 `NEXT_PUBLIC_` 变量或提交到 Git。未配置时页面会提示“功能开关尚未配置”。

配置保存在 Anutrium 既有 R2 桶内；新打开或刷新首页时生效，读取失败或超时默认普通模式。首次接入需部署 Worker、Anutrium 网站和 AnuConsole，后续切换无需部署。

验证：`PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- tests/features.spec.ts`。界面测试使用明确的接口夹具，不修改线上配置。

## 项目主题色

所有项目（包括新增项目）统一在 `src/lib/projects.ts` 配置颜色。`accent` 是共用强调色，`onAccent` 是强调色按钮上的文字颜色；可用 `themeColors.light`、`themeColors.dark` 分别覆盖。未配置的主题或按钮文字色沿用共用值，自动主题按实际浅色或深色状态读取。选中项的淡色背景保留共用强调色。

```ts
// 不区分主题：两种主题都使用同一颜色（Anutrium）。
accent: "#E23456",
onAccent: "#fff",

// 区分主题：浅色使用深黄，深色回退到共用亮黄（DRRR情报屋）。
accent: "#f4f500",
onAccent: "#17191b",
themeColors: { light: { accent: "#686900", onAccent: "#fff" } },
```

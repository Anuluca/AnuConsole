# 网站运维

所有项目菜单均显示“网站运维”，排序在关于页之前。各项目共用当前配置的 Cloudflare 区域和 Netlify 管理范围，页面地址保留当前项目。

| 地址 | 功能 |
| --- | --- |
| `/{project}/infrastructure/dns` | Cloudflare 的 `anuluca.com` DNS 记录列表、搜索、类型筛选、新增、修改、删除 |
| `/{project}/infrastructure/netlify` | Netlify 项目列表 |
| `/{project}/infrastructure/netlify?site=项目ID` | 指定项目的部署、环境变量和项目设置 |

`project` 当前为 `anutrium` 或 `drrr`；`/{project}/infrastructure` 跳转当前项目的 DNS 页面。新增项目时，菜单会自动加入该项目的运维地址。

## 配置凭据

在本地忽略提交的 `.env.local` 中配置以下变量。不要把值写入源码、文档或 `NEXT_PUBLIC_*` 变量。

```dotenv
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
NETLIFY_API_TOKEN=
# 可选：逗号分隔的 Netlify 项目 ID；未填写时允许访问令牌可访问的项目。
NETLIFY_SITE_IDS=
# 可选：新增项目中选择 GitHub 仓库时必需，只授予仓库 Metadata 只读权限。
GITHUB_API_TOKEN=
```

### Cloudflare

1. 打开 [API Tokens](https://dash.cloudflare.com/profile/api-tokens)。
2. 创建令牌，选择 **Edit zone DNS** 模板。
3. 权限选择 **Zone → DNS → Edit**。
4. 区域资源选择 **Include → Specific zone → anuluca.com**。
5. 创建后将令牌填入 `CLOUDFLARE_API_TOKEN`。
6. 进入 `anuluca.com` 概述页，复制区域 ID（Zone ID），填入 `CLOUDFLARE_ZONE_ID`。

不需要 Global API Key，也不需要账号级管理权限。DNS 编辑模板同时允许记录读取。应用固定管理 `anuluca.com`，不接受浏览器传入 Zone ID。

### Netlify

1. 进入用户设置 → **Applications → Personal access tokens → New access token**。
2. 设置名称 `AnuConsole` 和有效期，生成令牌。
3. 将令牌填入 `NETLIFY_API_TOKEN`。
4. 如需限制管理范围，将各项目 **Project configuration → General → Project information** 中的 Project ID 填入 `NETLIFY_SITE_IDS`，多个 ID 用逗号分隔。

应用根据选中项目的服务端响应解析团队 ID，不需要单独配置 `NETLIFY_ACCOUNT_ID`。

### GitHub 仓库选择

1. 打开 [细粒度个人访问令牌创建页](https://github.com/settings/personal-access-tokens/new)，设置名称和有效期。
2. Resource owner 选择仓库所属账号，Repository access 选择需要用于部署的仓库。
3. 保留 **Metadata → Read-only** 权限即可，无需仓库内容或写权限。
4. 将令牌保存为 `GITHUB_API_TOKEN`。部署管理新增项目时，勾选关联 Git 仓库，即可搜索、分页选择该令牌可读取的公开和私有仓库。

选择仓库会自动填入默认分支，并复用已有 Netlify 项目中可读取的构建配置；仓库 ID、可见性和可识别的 Netlify GitHub App 关联由服务端处理。服务端在创建前重新读取仓库身份，防止浏览器提交错误 ID 或可见性。

GitHub 读取授权和 Netlify 的部署授权各自生效。新增或私有仓库还需在 [GitHub App 安装设置](https://github.com/settings/installations) 中授予 Netlify 访问权限；能列出仓库并不表示 Netlify 已获得部署授权。同一 GitHub 所有者的已有 Netlify App 安装标识可自动复用，最终权限由 Netlify 校验。

生产部署时，在 AnuConsole 的 Netlify 私密环境变量中配置同名变量，作用域须包含 **Functions**，然后重新部署。环境变量变更不会自动更新已经运行的生产部署。

保存本地配置后运行 `npm run check:infrastructure` 可执行只读连通检查；附加 `-- --list-sites` 可列出首批项目名称和 ID，便于填写允许列表。脚本不输出令牌、DNS 内容或变量明文。

## 能力范围

- DNS：常见记录使用表单；SRV、CAA、HTTPS 等结构化记录可在“高级记录字段”中填写 `data`。支持 Cloudflare 公开记录 API 的类型、TTL、代理、备注、标签和记录设置，最终约束由 Cloudflare 校验。
- 部署：列表分页、触发构建、指定分支、清理构建缓存、恢复已有成功部署；构建中每 15 秒刷新状态。
- 新增项目：管理员可从部署管理列表创建 Netlify 项目，选择令牌可访问的团队、设置名称和可选域名，支持从列表选择 GitHub 仓库及初始构建配置。成功后进入当前项目路径下的详情页；创建不自动修改 DNS。关联仓库可能触发首次构建。启用 `NETLIFY_SITE_IDS` 时禁止创建，以免生成允许列表之外、无法继续管理的新项目；需要先调整该服务端限制。
- 环境变量：新增变量、修改或添加单个上下文、删除单个上下文、重设全部配置、删除变量。支持作用域、密钥标记及指定分支。单个上下文使用 PATCH，不替换其他上下文；重设配置使用 PUT，明确替换全部值。
- 项目设置：官方 `siteSetup` 中的可配置字段，包括名称、域名与别名、分支及预览域名、通知邮箱、SSL、DNS 托管、部署限制、函数区域、构建镜像、预渲染、访问密码，以及 `repoInfo` 构建和仓库配置、HTML pretty URLs。高级编辑只接收明确允许的字段，拒绝账号 ID、访问令牌等响应字段；环境变量通过独立接口管理。
- 实际可用字段和权限由 Netlify API、账号权限及套餐决定。仓库中的 `netlify.toml` 对相应构建字段具有更高优先级。已通过 Git 提供方授权的仓库才可用于持续部署。

## 权限与数据处理

- 业务页面、读取接口使用 `requireUser()`；写接口使用 `requireAdmin()`。`user` 无法通过直接请求绕过只读限制。
- 写接口检查同源 Origin、内容类型、请求体大小与字段格式。
- 上游仅为固定 Cloudflare / Netlify HTTPS 地址，禁止跟随重定向；令牌仅通过服务端请求头发送。
- Netlify 环境变量的明文在服务端去除，包括普通变量和本地开发上下文；站点密码、Git 环境变量、部署钩子令牌等也不会返回浏览器。
- 写请求不自动重试。失败后重新读取记录或提示刷新核对，避免重复提交。
- 恢复部署只恢复部署产物，不回滚环境变量、数据库或其他外部资源。

## 验证

```bash
npm test
npm run typecheck
PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/infrastructure.spec.ts
npm run build
```

界面测试拦截本地管理 API，单元测试替换上游 fetch；不会修改真实 DNS、环境变量或触发真实构建。已有的本地服务继续使用端口 3002。

官方参考：[Cloudflare DNS API](https://developers.cloudflare.com/api/resources/dns/subresources/records/)、[Cloudflare API 令牌](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)、[Netlify API](https://open-api.netlify.com/)、[Netlify API 入门](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/)。

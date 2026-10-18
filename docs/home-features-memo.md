# 首页功能开关：密钥配置与恢复备忘

## 用途与生效范围

- 控制入口：AnuConsole → 功能调整 → 首页 → 路卡雕像的头疼模式。
- 配置密钥名：`HOME_FEATURES_TOKEN`，AnuConsole 服务端与 Anutrium Worker 必须使用相同值。
- 模式保存在 Anutrium 既有 R2 桶的 `config/home-features.json`，与密钥分开存储。
- 保存后，新打开或刷新 Anutrium 首页时生效；首页读取失败、超时或配置不存在时使用普通模式。
- 本备忘只记录配置方法，不记录真实密钥，可提交到 Git。

## 配置位置

| 位置 | 配置方式 | 是否提交 Git |
| --- | --- | --- |
| 本地 AnuConsole | 项目根目录 `.env.local` 中的 `HOME_FEATURES_TOKEN` | 否，文件已被忽略 |
| 线上 AnuConsole（如有） | 部署平台或服务器的私密服务端环境变量 | 否 |
| Anutrium Worker | Cloudflare Worker 的 `HOME_FEATURES_TOKEN` Secret | 否 |
| 密钥备份 | 密码管理器中的独立条目 | 否 |

`.env.local` 是本地配置文件，不是部署目标；不会随 Git 推送自动上传到服务器或 Worker。不要覆盖文件中已有的管理员密码哈希、会话密钥等配置，也不要为此密钥添加 `NEXT_PUBLIC_` 或 `VITE_` 前缀。

## 首次配置

1. 在本机终端生成一次随机密钥，将结果保存到密码管理器：

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

2. 在 AnuConsole 的 `.env.local` 中追加，下面的值是占位说明，必须替换：

   ```dotenv
   HOME_FEATURES_TOKEN=替换为生成的密钥
   ```

   `HOME_FEATURES_URL` 默认指向 `https://steam-api.anuluca.com/admin/home-features`，通常无需设置。

3. 在 Anutrium 项目的 `worker` 目录配置同一个密钥：

   ```bash
   npx wrangler secret put HOME_FEATURES_TOKEN
   ```

   按交互提示粘贴密钥，不将密钥写进命令参数。该命令会创建并部署 Worker 版本；本地 `.dev.vars` 不会自动上传。

4. 在该目录部署新增的 Worker 接口代码：

   ```bash
   npm run deploy
   ```

5. 发布 Anutrium 的前端改动，包括首页配置读取逻辑和 Netlify 转发规则。若 AnuConsole 部署在线上，在其服务端配置相同密钥并发布新增代码；根据运行方式重新加载环境变量。

部署 Worker 前确认当前目录中的其他代码修改也属于本次上线范围。无需手动创建 R2 配置文件，首次成功保存开关会自动写入。

## 本地文件丢失后的影响

- **AnuConsole 在线上运行**：只要线上环境变量仍在，丢失本地 `.env.local` 不影响线上控制。
- **AnuConsole 只在本机运行**：丢失 `.env.local` 后，需恢复密钥才能继续读写管理接口；R2 中已保存的模式不会被删除。
- **整个 `.env.local` 丢失**：除了功能密钥，还需恢复或重新配置管理员认证所需的 `ADMIN_PASSWORD_HASH` 与 `SESSION_SECRET`。
- **首页实际读取失败**：按当前实现回退普通模式；这与本地文件是否丢失是两个独立条件。

## 恢复与轮换

### 有密钥备份

1. 从密码管理器取回密钥。
2. 补回需要使用的 AnuConsole 环境变量；已有其他配置不要覆盖。
3. 让 AnuConsole 服务端重新加载环境变量，打开功能调整页点击“重试”。
4. 密钥与 Worker 一致时，无需更改 Worker 或 R2 配置。

### 原密钥完全丢失或需要更换

1. 按首次配置的方法生成一把新密钥并备份。
2. 将 Worker 的 `HOME_FEATURES_TOKEN` Secret 更新为新值。
3. 将所有需要继续控制网站的 AnuConsole 实例更新为相同值，并重新加载环境变量。
4. 验证管理页恢复读取，再进行开关操作。

两端更新之间可能短暂无法控制；R2 中的模式保持原值，无需重建配置。Cloudflare 中已保存的 Secret 不能依赖控制台取回明文，因此应独立备份密钥。

## 验证与相关入口

- 管理页：进入“功能调整 → 首页”，应显示实际状态；出错时右侧显示错误信息及“重试”。
- 保存后刷新 Anutrium 首页，检查模型模式是否对应。
- 不将密钥粘贴到聊天、截图、日志或源码中。
- [Anutrium 首页](https://anuluca.com/)
- [Cloudflare 控制台](https://dash.cloudflare.com/)
- [Netlify 项目概览](https://app.netlify.com/projects/anutrium/overview)
- [Cloudflare Secret 配置说明](https://developers.cloudflare.com/workers/configuration/secrets/)

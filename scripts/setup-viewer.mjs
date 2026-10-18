import { randomBytes, scryptSync } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { upsertEnvValues } from "./lib/env-values.mjs";
import { hiddenPrompt } from "./lib/password-prompt.mjs";

const target = fileURLToPath(new URL("../.env.local", import.meta.url));
if (!existsSync(target)) {
  console.error("请先运行 npm run setup:admin 配置管理员和会话密钥。");
  process.exit(1);
}
const source = readFileSync(target, "utf8");
if (/^\s*(?:export\s+)?VIEWER_PASSWORD_HASH\s*=\s*\S+/m.test(source) && !process.argv.includes("--force")) {
  console.error("viewer 已配置；确认需要重置密码时运行 npm run setup:viewer -- --force。");
  process.exit(1);
}
if (!process.stdin.isTTY) {
  console.error("请在交互式终端运行，密码不会显示或写入命令历史。");
  process.exit(1);
}
const password = await hiddenPrompt("viewer 密码（至少 8 位）: ");
if (password.length < 8 || password.length > 256) { console.error("密码必须为 8–256 位。"); process.exit(1); }
if (password !== await hiddenPrompt("再次输入密码: ")) { console.error("两次输入不一致，未修改配置。"); process.exit(1); }
const salt = randomBytes(16).toString("hex");
const digest = scryptSync(password, salt, 64).toString("hex");
writeFileSync(target, upsertEnvValues(source, { VIEWER_PASSWORD_HASH: `scrypt:${salt}:${digest}` }), { mode: 0o600 });
chmodSync(target, 0o600);
console.log("已配置只读账号 viewer。请让服务重新载入环境变量；Netlify 需同步 VIEWER_PASSWORD_HASH 后重新部署。");

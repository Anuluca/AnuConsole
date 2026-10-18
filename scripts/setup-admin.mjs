import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(new URL("../.env.local", import.meta.url));
const force = process.argv.includes("--force");
if (existsSync(target) && !force) {
  console.error(".env.local 已存在；确认需要重置时运行 npm run setup:admin -- --force。");
  process.exit(1);
}
if (!process.stdin.isTTY) {
  console.error("请在交互式终端运行，密码不会显示或写入命令历史。");
  process.exit(1);
}

function hiddenPrompt(message) {
  return new Promise(resolve => {
    process.stdout.write(message);
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    const handler = chunk => {
      for (const char of chunk) {
        if (char === "\u0003") { process.stdout.write("\n"); process.exit(130); }
        if (char === "\r" || char === "\n") {
          process.stdin.off("data", handler);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    process.stdin.on("data", handler);
  });
}

const password = await hiddenPrompt("admin 密码（至少 8 位）: ");
if (password.length < 8 || password.length > 256) { console.error("密码必须为 8–256 位。"); process.exit(1); }
const confirmation = await hiddenPrompt("再次输入密码: ");
if (password !== confirmation) { console.error("两次输入不一致，未修改配置。"); process.exit(1); }
const salt = randomBytes(16).toString("hex");
const digest = scryptSync(password, salt, 64).toString("hex");
writeFileSync(target, `ADMIN_PASSWORD_HASH=scrypt:${salt}:${digest}\nSESSION_SECRET=${randomBytes(48).toString("base64url")}\n`, { mode: 0o600 });
console.log(`已配置 admin：${resolve(target)}。请重启服务以载入配置。`);

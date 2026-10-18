import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, digest, extra] = encoded.split(":");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt ?? "") ||
      !/^[a-f0-9]{128}$/.test(digest ?? "") || extra !== undefined) return false;
  if (password.length > 256) return false;
  const key = await deriveKey(password, salt, 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(digest, "hex"));
}

// 单管理员使用进程内的固定窗口限流；不信任可伪造的代理 IP 请求头。
// 部署为多个实例时，应将计数移至共享存储，并在入口配置登录限流。
export class LoginLimiter {
  private startedAt = 0;
  private attempts = 0;
  private readonly limit: number;
  private readonly windowMs: number;
  constructor(limit = 10, windowMs = 60_000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  consume(now = Date.now()): boolean {
    if (!this.startedAt || now - this.startedAt >= this.windowMs) {
      this.startedAt = now;
      this.attempts = 0;
    }
    if (this.attempts >= this.limit) return false;
    this.attempts += 1;
    return true;
  }
}

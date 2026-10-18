import { createHash } from "node:crypto";
import { verifyPassword } from "./security.ts";

export type UserIdentity = { username: "admin" | "viewer"; role: "admin" | "viewer" };
type Credentials = Record<string, string | undefined>;
type Account = UserIdentity & { passwordHash: string };
export type UserSession = { username?: string; expiresAt?: number; credentialVersion?: string };

export function validPasswordHash(value: string | undefined): value is string {
  return /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value ?? "");
}

export function getAccount(username: unknown, credentials: Credentials = process.env): Account | null {
  if (username !== "admin" && username !== "viewer") return null;
  const passwordHash = username === "admin" ? credentials.ADMIN_PASSWORD_HASH : credentials.VIEWER_PASSWORD_HASH;
  return validPasswordHash(passwordHash) ? { username, role: username, passwordHash } : null;
}

export function accountVersion(account: Account): string {
  return createHash("sha256").update(account.passwordHash).digest("hex");
}

export function sessionIdentity(session: UserSession, credentials: Credentials = process.env, now = Date.now()): UserIdentity | null {
  const account = getAccount(session.username, credentials);
  if (!account || !Number.isFinite(session.expiresAt) || (session.expiresAt ?? 0) <= now ||
    session.credentialVersion !== accountVersion(account)) return null;
  // 权限始终由服务端账号配置推导，不信任 Cookie 中自报的角色。
  return { username: account.username, role: account.role };
}

export async function authenticateAccount(username: unknown, password: string, credentials: Credentials = process.env): Promise<UserIdentity | null> {
  const account = getAccount(username, credentials);
  // 未知或未启用的账号也执行同成本密码派生，避免快速失败泄露账号配置。
  const valid = await verifyPassword(password, account?.passwordHash ?? credentials.ADMIN_PASSWORD_HASH ?? "");
  return account && valid ? { username: account.username, role: account.role } : null;
}

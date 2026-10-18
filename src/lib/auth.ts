import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { developmentAuthBypass } from "./auth-policy";

export const SESSION_TTL = 60 * 60 * 8;
type AdminSession = { username?: "admin"; expiresAt?: number; credentialVersion?: string };

export function authConfigured(): boolean {
  return /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.ADMIN_PASSWORD_HASH ?? "") &&
    (process.env.SESSION_SECRET?.length ?? 0) >= 32;
}

function credentialVersion(): string {
  return createHash("sha256").update(process.env.ADMIN_PASSWORD_HASH ?? "").digest("hex");
}

export async function getSession() {
  if (!authConfigured()) throw new Error("管理员配置缺失，请运行 npm run setup:admin");
  return getIronSession<AdminSession>(await cookies(), {
    password: process.env.SESSION_SECRET!,
    cookieName: "anuconsole_session",
    ttl: SESSION_TTL,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_TTL
    }
  });
}

export async function isAuthenticated(): Promise<boolean> {
  if (!authConfigured()) return false;
  const session = await getSession();
  return session.username === "admin" && (session.expiresAt ?? 0) > Date.now() &&
    session.credentialVersion === credentialVersion();
}

export async function requireAdmin() {
  if (developmentAuthBypass()) return;
  if (!(await isAuthenticated())) redirect("/login");
}

export async function createAdminSession() {
  const session = await getSession();
  session.username = "admin";
  session.expiresAt = Date.now() + SESSION_TTL * 1000;
  // 修改密码后旧会话即失效，无需等待原 Cookie 到期。
  session.credentialVersion = credentialVersion();
  await session.save();
}

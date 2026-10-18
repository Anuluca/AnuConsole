import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { developmentAuthBypass } from "./auth-policy.ts";
import { accountVersion, getAccount, sessionIdentity, validPasswordHash, type UserSession } from "./accounts.ts";

export const SESSION_TTL = 60 * 60 * 8;

export function authConfigured(): boolean {
  return validPasswordHash(process.env.ADMIN_PASSWORD_HASH) &&
    (process.env.SESSION_SECRET?.length ?? 0) >= 32;
}

export async function getSession() {
  if (!authConfigured()) throw new Error("管理员配置缺失，请运行 npm run setup:admin");
  return getIronSession<UserSession>(await cookies(), {
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
  return (await getAuthenticatedUser()) !== null;
}

export async function getAuthenticatedUser() {
  if (!authConfigured()) return null;
  return sessionIdentity(await getSession());
}

export async function requireUser() {
  const user = await getAuthenticatedUser();
  if (user) return user;
  // 开发环境的匿名免登录保留，但已登录的只读账号仍受权限限制。
  if (developmentAuthBypass()) return { username: "admin", role: "admin" } as const;
  redirect("/login");
}

export class ForbiddenError extends Error {
  constructor() { super("forbidden"); }
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new ForbiddenError();
  return user;
}

export async function createUserSession(username: "admin" | "viewer") {
  const account = getAccount(username);
  if (!account) throw new Error("账号未配置");
  const session = await getSession();
  session.username = account.username;
  session.expiresAt = Date.now() + SESSION_TTL * 1000;
  // 修改密码后旧会话即失效，无需等待原 Cookie 到期。
  session.credentialVersion = accountVersion(account);
  await session.save();
}

"use server";

import { redirect } from "next/navigation";
import { authConfigured, createAdminSession, getSession } from "@/lib/auth";
import { LoginLimiter, verifyPassword } from "@/lib/security";

const globalAuth = globalThis as typeof globalThis & { anuLoginLimiter?: LoginLimiter };
const limiter = globalAuth.anuLoginLimiter ??= new LoginLimiter();
export type LoginState = { error: string };

export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  if (!authConfigured()) return { error: "管理员尚未配置，请先在服务端运行 npm run setup:admin。" };
  if (!limiter.consume()) return { error: "登录尝试过于频繁，请在一分钟后重试。" };
  const username = form.get("username");
  const password = form.get("password");
  if (typeof username !== "string" || typeof password !== "string" || !password || password.length > 256) {
    return { error: "请输入有效的管理员账号与密码。" };
  }
  // 即使账号错误也执行密码派生，避免以响应时长判断账号是否存在。
  const validPassword = await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH!);
  if (username !== "admin" || !validPassword) return { error: "账号或密码错误，请重试。" };
  await createAdminSession();
  redirect("/");
}

export async function logout() {
  if (authConfigured()) (await getSession()).destroy();
  redirect("/login");
}

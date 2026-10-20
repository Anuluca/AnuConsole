"use server";

import { redirect } from "next/navigation";
import { authConfigured, createUserSession, getSession } from "@/lib/auth";
import { authenticateAccount } from "@/lib/accounts";
import { LoginLimiter } from "@/lib/security";

const globalAuth = globalThis as typeof globalThis & { anuLoginLimiter?: LoginLimiter };
const limiter = globalAuth.anuLoginLimiter ??= new LoginLimiter();
export type LoginState = { error: string };

export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  if (!authConfigured()) return { error: "管理员尚未配置，请先在服务端运行 npm run setup:admin。" };
  if (!limiter.consume()) return { error: "登录尝试过于频繁，请在一分钟后重试。" };
  const username = form.get("username");
  const password = form.get("password");
  if (typeof username !== "string" || typeof password !== "string" || !password || password.length > 256) {
    return { error: "请输入有效的账号与密码。" };
  }
  const user = await authenticateAccount(username, password);
  if (!user) return { error: "账号或密码错误，请重试。" };
  await createUserSession(user.username);
  redirect("/");
}

// 游客入口不读取客户端提交的账号或角色，也不占用管理员密码尝试额度。
export async function guestLogin(_state: LoginState, _form: FormData): Promise<LoginState> {
  if (!authConfigured()) return { error: "管理员尚未配置，请先在服务端运行 npm run setup:admin。" };
  await createUserSession("guest");
  redirect("/");
}

export async function logout() {
  if (authConfigured()) (await getSession()).destroy();
  redirect("/login");
}

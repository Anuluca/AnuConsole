import { requireUser } from "@/lib/auth";

export async function EmptyPage({ label }: { label: string }) {
  // 每个页面单独执行授权，客户端路由切换时也不能绕过布局检查。
  await requireUser();
  return <section className="empty-workspace" aria-label={`${label}内容区`} />;
}

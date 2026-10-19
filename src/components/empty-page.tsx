import { requireUser } from "@/lib/auth";

export async function EmptyPage({ label }: { label: string }) {
  // 每个页面单独执行授权，客户端路由切换时也不能绕过布局检查。
  await requireUser();
  return <section className="empty-workspace" aria-label={`${label}内容区`}>
    <div className="empty-workspace-message">
      <span className="empty-workspace-code">404</span>
      <svg className="empty-workspace-caption" viewBox="0 0 100 20" preserveAspectRatio="none" role="img" aria-label="SIGNAL LOST">
        <text x="0" y="16" textLength="100" lengthAdjust="spacingAndGlyphs">SIGNAL LOST</text>
      </svg>
    </div>
  </section>;
}

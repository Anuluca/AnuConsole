import { requireAdmin } from "@/lib/auth";
import { ANALYTICS_RANGES, isAnalyticsPayload } from "@/lib/analytics";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  await requireAdmin();
  const { kind } = await context.params;
  if (kind !== "summary" && kind !== "realtime") return Response.json({ error: "invalid_report" }, { status: 404, headers });
  const rawDays = new URL(request.url).searchParams.get("days") ?? "30";
  const days = Number(rawDays);
  if (kind === "summary" && !(ANALYTICS_RANGES as readonly number[]).includes(days)) {
    return Response.json({ error: "invalid_range" }, { status: 400, headers });
  }
  try {
    // 复用网站既有的只读汇总接口。地址仅由服务端配置，客户端不能指定资源或 Google 查询。
    const base = (process.env.GA4_REPORTS_URL || "https://steam-api.anuluca.com/analytics").replace(/\/$/, "");
    const url = new URL(`${base}/${kind}${kind === "summary" ? `?days=${days}` : ""}`);
    if (url.protocol !== "https:") throw new Error("invalid_upstream");
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(45000) });
    if (!response.ok) return Response.json({ error: response.status === 503 ? "analytics_not_configured" : "analytics_unavailable" }, { status: response.status === 503 ? 503 : 502, headers });
    const payload: unknown = await response.json();
    if (!isAnalyticsPayload(payload, kind, days)) throw new Error("invalid_payload");
    return Response.json(payload, { headers });
  } catch {
    return Response.json({ error: "analytics_unavailable" }, { status: 502, headers });
  }
}

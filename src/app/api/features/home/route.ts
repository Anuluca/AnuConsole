import { ForbiddenError, requireAdmin, requireUser } from "../../../../lib/auth.ts";
import { parseHomeFeatures } from "../../../../lib/home-features.ts";

const headers = { "Cache-Control": "private, no-store" };
const respond = (body: unknown, status = 200) => Response.json(body, { status, headers });

async function upstream(update?: { lucarioHeadache: boolean }) {
  const token = process.env.HOME_FEATURES_TOKEN;
  if (!token || token.length < 32) return respond({ error: "home_features_not_configured" }, 503);
  try {
    // 地址和密钥只从服务端配置读取，浏览器不能指定目标或获取写入凭据。
    const endpoint = process.env.HOME_FEATURES_URL || "https://steam-api.anuluca.com/admin/home-features";
    const response = await fetch(endpoint, {
      method: update ? "PUT" : "GET",
      headers: { Authorization: `Bearer ${token}`, ...(update ? { "Content-Type": "application/json" } : {}) },
      body: update ? JSON.stringify(update) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return respond({ error: "home_features_unavailable" }, 502);
    const config = parseHomeFeatures(await response.json());
    if (!config) return respond({ error: "home_features_unavailable" }, 502);
    return respond({ lucarioHeadache: config.lucarioHeadache, headacheCount: config.headacheCount, updatedAt: config.updatedAt });
  } catch {
    return respond({ error: "home_features_unavailable" }, 502);
  }
}

export async function GET() {
  await requireUser();
  return upstream();
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) return respond({ error: "forbidden" }, 403);
    throw error;
  }
  // 写请求必须来自后台同源页面，开发免登录规则也不绕过来源校验。
  const origin = request.headers.get("Origin");
  let sameOrigin = false;
  try {
    const source = new URL(origin ?? "");
    // Next.js 的内部 URL 可能使用 localhost；浏览器实际访问的主机以 Host 为准。
    sameOrigin = source.origin === origin && ["http:", "https:"].includes(source.protocol) &&
      source.host === (request.headers.get("Host") || new URL(request.url).host);
  } catch { /* 缺失或无效的 Origin 一律拒绝。 */ }
  if (!sameOrigin || request.headers.get("Sec-Fetch-Site") === "cross-site")
    return respond({ error: "forbidden_origin" }, 403);
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json")
    return respond({ error: "invalid_content_type" }, 415);

  // 流式限制实际字节数，避免未经检查的大请求被完整缓冲。
  const reader = request.body?.getReader();
  if (!reader) return respond({ error: "invalid_update" }, 400);
  let text = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return respond({ error: "invalid_update" }, 400);
      }
      text += decoder.decode(value, { stream: true });
    }
    const update: unknown = JSON.parse(text + decoder.decode());
    if (!update || typeof update !== "object" || Object.keys(update).length !== 1 ||
      !("lucarioHeadache" in update) || typeof update.lucarioHeadache !== "boolean")
      return respond({ error: "invalid_update" }, 400);
    return upstream({ lucarioHeadache: update.lucarioHeadache });
  } catch {
    return respond({ error: "invalid_update" }, 400);
  } finally {
    reader.releaseLock();
  }
}

import "server-only";
import { ForbiddenError, requireAdmin, requireUser } from "./auth.ts";
import { InfrastructureError } from "./infrastructure-contract.ts";

export function infrastructureResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/** 所有入口共享同一权限检查，先授权再读取参数或调用外部平台。 */
export async function infrastructureRoute(request: Request, write: boolean, action: () => Promise<unknown>) {
  try {
    if (write) {
      await requireAdmin();
      let sameOrigin = false;
      try {
        const origin = request.headers.get("Origin");
        const source = new URL(origin ?? "");
        sameOrigin = source.origin === origin && ["http:", "https:"].includes(source.protocol) &&
          source.host === (request.headers.get("Host") || new URL(request.url).host);
      } catch { /* 缺失或无效的 Origin 不允许写入。 */ }
      if (!sameOrigin || request.headers.get("Sec-Fetch-Site") === "cross-site") throw new InfrastructureError("forbidden_origin", 403);
    } else await requireUser();
    return infrastructureResponse(await action());
  } catch (error) {
    if (error instanceof ForbiddenError) return infrastructureResponse({ error: "forbidden" }, 403);
    if (error instanceof InfrastructureError) return infrastructureResponse({ error: error.code }, error.status);
    // Next.js 的登录重定向必须继续交给框架处理，不能变成普通 JSON 成功响应。
    throw error;
  }
}

export async function infrastructureJson(request: Request): Promise<unknown> {
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") throw new InfrastructureError("invalid_content_type", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new InfrastructureError("invalid_input");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 131072) {
        await reader.cancel();
        throw new InfrastructureError("body_too_large", 413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof InfrastructureError) throw error;
    throw new InfrastructureError("invalid_input");
  } finally { reader.releaseLock(); }
}

export function pageNumber(request: Request) {
  const value = new URL(request.url).searchParams.get("page") ?? "1";
  if (!/^\d{1,5}$/.test(value) || Number(value) < 1) throw new InfrastructureError("invalid_input");
  return Number(value);
}

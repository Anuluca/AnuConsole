import { ForbiddenError, requireAdmin, requireUser } from './auth.ts';

const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export const validMonkeyId = (id: string) => /^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
export async function monkeyUpstream(suffix: string, method = 'GET', etag?: string) {
  const token = process.env.HOME_FEATURES_TOKEN;
  if (!token || token.length < 32) return response({ error: '未配置档案管理密钥 HOME_FEATURES_TOKEN。' }, 503);
  try {
    const url = new URL(`/admin/monkey-articles${suffix}`, process.env.HOME_FEATURES_URL || 'https://steam-api.anuluca.com');
    const upstream = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(etag ? { 'If-Match': etag } : {}) }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!upstream.ok) {
      const messages: Record<number, string> = { 400: '分页参数无效，请刷新列表。', 404: '文章已被删除，请刷新列表。', 412: '文章版本冲突，请重新读取后再操作。' };
      return response({ error: messages[upstream.status] || '档案服务不可用，请检查 Worker 部署和管理密钥。' }, messages[upstream.status] ? upstream.status : 502);
    }
    const version = upstream.headers.get('X-Article-Version') || upstream.headers.get('ETag');
    return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', ...(version ? { ETag: version } : {}) } });
  } catch { return response({ error: '档案服务连接失败，请稍后重试。' }, 502); }
}
export async function readMonkeyArticles(request: Request) {
  await requireUser();
  const cursor = new URL(request.url).searchParams.get('cursor');
  if (cursor && cursor.length > 2048) return response({ error: '分页参数无效' }, 400);
  return monkeyUpstream(cursor ? `?cursor=${encodeURIComponent(cursor)}` : '');
}
export async function readMonkeyArticle(id: string) {
  await requireUser();
  return validMonkeyId(id) ? monkeyUpstream(`/${id}`) : response({ error: '未找到文章' }, 404);
}
export async function deleteMonkeyArticle(request: Request, id: string) {
  try { await requireAdmin(); }
  catch (error) { if (error instanceof ForbiddenError) return response({ error: '只读账号不能删除文章。' }, 403); throw error; }
  const origin = request.headers.get('Origin');
  let sameOrigin = false;
  try { const source = new URL(origin || ''); sameOrigin = source.origin === origin && ['http:', 'https:'].includes(source.protocol) && source.host === (request.headers.get('Host') || new URL(request.url).host); } catch { /* 缺失来源时拒绝写入。 */ }
  if (!sameOrigin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return response({ error: '请求来源不允许。' }, 403);
  if (!validMonkeyId(id)) return response({ error: '无效文章标识' }, 400);
  const etag = request.headers.get('If-Match');
  if (!etag || !/^"[^"\r\n]{1,128}"$/.test(etag)) return response({ error: '缺少文章版本，请重新读取。' }, 428);
  return monkeyUpstream(`/${id}`, 'DELETE', etag);
}

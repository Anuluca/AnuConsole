import { ForbiddenError, requireAdmin, requireUser } from './auth.ts';
import { MAX_NOTE_BYTES, parseNoteDocument } from './note-document.ts';

export const noteResponse = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export const validNoteId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);

export async function notesUpstream(suffix: string, source?: string, method = source === undefined ? 'GET' : 'PUT', etag?: string) {
  const token = process.env.HOME_FEATURES_TOKEN;
  if (!token || token.length < 32) return noteResponse({ error: '未配置笔记管理密钥 HOME_FEATURES_TOKEN。' }, 503);
  try {
    const base = process.env.HOME_FEATURES_URL || 'https://steam-api.anuluca.com/admin/home-features';
    const endpoint = new URL(`/admin/notes${suffix}`, base);
    const response = await fetch(endpoint, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(source === undefined ? {} : { 'Content-Type': 'text/markdown' }), ...(etag ? { 'If-Match': etag } : {}) },
      body: source, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: '笔记文件格式错误。', 404: '未找到笔记，可能已被删除。',
        405: '当前 Worker 尚未支持此操作，请先更新 Worker。',
        409: '笔记标识冲突，请刷新后重试。',
        412: '笔记已被其他窗口修改，请查看服务器最新内容后重新操作，当前编辑已保留。',
        413: '笔记不能超过 256 KB。', 428: '缺少笔记版本，请重新读取后再操作。',
      };
      return noteResponse({ error: messages[response.status] || '笔记服务暂时不可用，请检查 Worker 部署与管理密钥。' }, messages[response.status] ? response.status : 502);
    }
    const version = response.headers.get('X-Note-Version') || response.headers.get('ETag');
    return new Response(response.body, { status: response.status, headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      ...(version ? { ETag: version, 'X-Note-Version': version } : {}),
    } });
  } catch {
    return noteResponse({ error: '笔记服务连接失败，请稍后重试。' }, 502);
  }
}
export async function readNotes(request: Request) {
  await requireUser();
  const cursor = new URL(request.url).searchParams.get('cursor');
  if (cursor && cursor.length > 2048) return noteResponse({ error: '无效分页参数' }, 400);
  return notesUpstream(cursor ? `?cursor=${encodeURIComponent(cursor)}` : '');
}
async function authorizeNoteMutation(request: Request, id: string) {
  try { await requireAdmin(); }
  catch (error) { if (error instanceof ForbiddenError) return noteResponse({ error: 'forbidden' }, 403); throw error; }
  if (!validNoteId(id)) return noteResponse({ error: '无效笔记标识' }, 400);
  const origin = request.headers.get('Origin');
  let sameOrigin = false;
  try {
    const source = new URL(origin || '');
    sameOrigin = source.origin === origin && ['http:', 'https:'].includes(source.protocol) && source.host === (request.headers.get('Host') || new URL(request.url).host);
  } catch { /* 无来源的写请求不允许执行。 */ }
  if (!sameOrigin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return noteResponse({ error: 'forbidden_origin' }, 403);
  return null;
}
export async function publishNote(request: Request, id: string, method: 'PUT' | 'PATCH' = 'PUT') {
  const denied = await authorizeNoteMutation(request, id);
  if (denied) return denied;
  const etag = request.headers.get('If-Match');
  if (method === 'PATCH' && (!etag || !/^"[^"\r\n]{1,128}"$/.test(etag))) return noteResponse({ error: '缺少笔记版本，请重新读取后再操作。' }, 428);
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'text/markdown') return noteResponse({ error: '仅支持 Markdown 文件' }, 415);
  const reader = request.body?.getReader();
  if (!reader) return noteResponse({ error: '正文不能为空' }, 400);
  let source = '';
  let size = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_NOTE_BYTES) { await reader.cancel(); return noteResponse({ error: '笔记不能超过 256 KB' }, 413); }
      source += decoder.decode(value, { stream: true });
    }
    source += decoder.decode();
    parseNoteDocument(source);
  } catch (error) {
    return noteResponse({ error: error instanceof Error ? error.message : '文件格式错误' }, 400);
  } finally { reader.releaseLock(); }
  return notesUpstream(`/${id}`, source, method, method === 'PATCH' ? etag! : undefined);
}

export async function deleteNote(request: Request, id: string) {
  const denied = await authorizeNoteMutation(request, id);
  if (denied) return denied;
  const etag = request.headers.get('If-Match');
  if (!etag || !/^"[^"\r\n]{1,128}"$/.test(etag)) return noteResponse({ error: '缺少笔记版本，请重新读取后再删除。' }, 428);
  return notesUpstream(`/${id}`, undefined, 'DELETE', etag);
}

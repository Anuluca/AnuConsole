'use client';

import { useCallback, useEffect, useState } from 'react';
import { ManagementButton } from './infrastructure/management-button';
import { ManagementModal, Pagination, displayDate } from './infrastructure/ui';
import './monkey-articles-manager.css';

interface Summary { id: string; title: string; createdAt: string; words: number; characters: number; preview: string }
interface Article extends Summary { content: string }
interface Page { articles: Summary[]; nextCursor: string | null }
async function request<T>(suffix = '', init?: RequestInit): Promise<{ data: T; etag: string }> {
  const response = await fetch(`/api/monkey-articles${suffix}`, { ...init, cache: 'no-store', signal: init?.signal || AbortSignal.timeout(15000) });
  if (response.redirected && new URL(response.url).pathname === '/login') { window.location.assign('/login'); throw new Error('请重新登录。'); }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作未完成，请稍后重试。');
  return { data, etag: response.headers.get('ETag') || '' };
}
export function MonkeyArticlesManager({ canEdit }: { canEdit: boolean }) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ data: Article; etag: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const cursor = cursors[page - 1];
  const refresh = useCallback(() => { setPage(1); setCursors([null]); setRevision(value => value + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => { controller.abort(); if (active) { setError('读取超时，请刷新重试。'); setLoading(false); } }, 15000);
    setLoading(true); setError(''); setData(null);
    request<Page>(cursor ? `?cursor=${encodeURIComponent(cursor)}` : '', { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setData(result.data);
    }).catch(() => { if (!controller.signal.aborted) setError('读取失败，请刷新重试。'); else if (controller.signal.reason?.name === 'AbortError') setError('读取超时，请刷新重试。'); })
      .finally(() => { clearTimeout(timeout); if (!controller.signal.aborted) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort('unmounted'); };
  }, [cursor, revision]);
  async function read(id: string) {
    setBusy(true); setError('');
    try { setSelected(await request<Article>(`/${id}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '读取失败，请重试。'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      await request(`/${selected.data.id}`, { method: 'DELETE', headers: { 'If-Match': selected.etag } });
      setDeleted(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '删除失败，请重试。'); }
    finally { setBusy(false); }
  }
  return <section className="monkey-manager infra-section">
    <div className="infra-toolbar"><div><h2>巴别图书馆</h2><p className="infra-muted">所有访客主动保存的手稿，可包含手动编辑内容。已存档正文保留原版本。</p></div><ManagementButton icon="refresh" type="button" disabled={loading || busy} onClick={refresh}>刷新列表</ManagementButton></div>
    {error && <p role="alert" className="infra-notice infra-error">{error}</p>}
    {loading ? <p role="status">正在读取档案…</p> : data?.articles.length === 0 ? <p className="infra-muted">暂无文章。</p> : <div className="monkey-records">{data?.articles.map(item => <article key={item.id} className="monkey-record"><div><h3 lang="en">{item.title}</h3><p lang="en">{item.preview}</p><small>{displayDate(item.createdAt)} · {item.words} 词 · {item.characters} 字符</small></div><ManagementButton icon="details" type="button" disabled={busy} onClick={() => void read(item.id)}>查看全文</ManagementButton></article>)}</div>}
    <Pagination page={page} hasNext={!!data?.nextCursor} disabled={loading || busy} onChange={next => { if (next > page) setCursors(previous => [...previous.slice(0, page), data!.nextCursor]); setPage(next); }} />
    {selected && <ManagementModal title={selected.data.title} onClose={() => setSelected(null)} footer={canEdit && <ManagementButton icon="delete" type="button" className="button-danger" onClick={() => { setDeleted(false); setDeleting(true); }}>删除文章</ManagementButton>}><p className="infra-muted">{displayDate(selected.data.createdAt)} · {selected.data.words} 词</p><pre className="monkey-fulltext" lang="en">{selected.data.content}</pre></ManagementModal>}
    {deleting && selected && <ManagementModal title="删除文章" danger busy={busy} closeRequested={deleted} onClose={() => { setDeleting(false); if (deleted) { setSelected(null); refresh(); } }} description="删除后公开图书馆将无法再读取这篇文章。" footer={<><ManagementButton icon="close" type="button" disabled={busy} data-close-modal>取消</ManagementButton><ManagementButton icon="delete" type="button" className="button-danger" disabled={busy || deleted} onClick={() => void remove()}>确认删除</ManagementButton></>}>{error && <p role="alert" className="infra-error">{error}</p>}<p>{selected.data.title}</p></ManagementModal>}
  </section>;
}

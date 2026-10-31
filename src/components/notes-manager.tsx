"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownIt from 'markdown-it';
import { MAX_NOTE_BYTES, parseNoteDocument, type NoteCategory, type NoteSummary } from '@/lib/note-document';
import { NOTE_CATEGORIES, NOTE_CATEGORY_OPTIONS, DEFAULT_NOTE_CATEGORY, isNoteCategory } from '@/lib/note-categories';
import { ManagementButton } from './infrastructure/management-button';
import { ManagementModal, ManagementSelect } from './infrastructure/ui';
import { RouteHeaderRefresh } from './route-header-refresh';
import './notes-manager.css';

const markdown = new MarkdownIt({ html: false, linkify: true });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const DRAFT_KEY = 'anuconsole.notes.draft.v1';
type NoteForm = { title: string; category: NoteCategory; date: string; cover: string; body: string };
type EditingNote = { id: string; etag: string };
type LoadedNote = ReturnType<typeof parseNoteDocument> & { id: string; etag: string; source: string };
const emptyForm = (): NoteForm => ({ title: '', category: DEFAULT_NOTE_CATEGORY, date: today(), cover: '', body: '' });
const serialize = (form: NoteForm) => `---\ntitle: ${JSON.stringify(form.title)}\ndate: ${JSON.stringify(form.date)}\ncategory: ${form.category}\n${form.cover ? `cover: ${JSON.stringify(form.cover)}\n` : ''}---\n\n${form.body}\n`;
const fromDocument = (note: ReturnType<typeof parseNoteDocument>): NoteForm => ({ title: note.metadata.title, category: note.metadata.type, date: note.metadata.time, cover: note.metadata.image || '', body: note.body });
const message = (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : fallback;
async function responseError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || '操作失败，请重试。';
}

export function NotesManager({ canEdit }: { canEdit: boolean }) {
  const [form, setForm] = useState<NoteForm>(emptyForm);
  const [baseline, setBaseline] = useState(() => serialize(emptyForm()));
  const [editing, setEditing] = useState<EditingNote | null>(null);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const [viewer, setViewer] = useState<LoadedNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoteSummary | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteDone, setDeleteDone] = useState(false);
  const [switchRequest, setSwitchRequest] = useState<{ run: () => void } | null>(null);
  const [discardApproved, setDiscardApproved] = useState(false);
  const publishId = useRef<string | null>(null);
  const sending = useRef(false);
  const attemptedSource = useRef('');
  const detailController = useRef<AbortController | null>(null);
  const source = useMemo(() => serialize(form), [form]);
  const dirty = source !== baseline;
  const preview = useMemo(() => markdown.render(form.body), [form.body]);
  const visibleNotes = useMemo(() => notes.filter(note => (filter === 'all' || note.type === filter) && note.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [notes, query, filter]);
  const patchForm = (update: Partial<NoteForm>) => setForm(previous => ({ ...previous, ...update }));

  useEffect(() => {
    if (canEdit) {
      try {
        const stored = localStorage.getItem(DRAFT_KEY);
        if (stored) {
          const draft = JSON.parse(stored);
          if (typeof draft.title === 'string' && typeof draft.body === 'string') {
            const restored: NoteForm = { title: draft.title, body: draft.body, category: isNoteCategory(draft.category) ? draft.category : draft.category === 'other' ? 'daily' : DEFAULT_NOTE_CATEGORY, date: typeof draft.date === 'string' ? draft.date : today(), cover: typeof draft.cover === 'string' ? draft.cover : '' };
            setForm(restored);
            if (draft.editing && typeof draft.editing.id === 'string' && typeof draft.editing.etag === 'string') setEditing(draft.editing);
            if (typeof draft.baseline === 'string') setBaseline(draft.baseline);
            setNotice('已恢复本地草稿。');
          }
        }
      } catch { /* 禁用本地存储不影响在线操作。 */ }
    }
    setReady(true);
    return () => detailController.current?.abort();
  }, [canEdit]);
  useEffect(() => {
    if (!ready || !canEdit) return;
    const timer = setTimeout(() => {
      try {
        // 编辑草稿保存原文件 ID 和读取版本，刷新后也不能绕过并发校验。
        if (dirty) localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, editing, baseline }));
        else localStorage.removeItem(DRAFT_KEY);
      } catch { /* 本地存储不可用时保留当前页面内容。 */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [ready, canEdit, form, editing, baseline, dirty]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setListError('');
    (async () => {
      try {
        const result: NoteSummary[] = [];
        let cursor: string | null = null;
        const seen = new Set<string>();
        do {
          const response: Response = await fetch(`/api/notes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { cache: 'no-store', signal: controller.signal });
          const data: { notes?: NoteSummary[]; nextCursor: string | null; error?: string } = await response.json();
          if (!response.ok || !Array.isArray(data.notes)) throw new Error(data.error || '笔记列表读取失败。');
          result.push(...data.notes); cursor = data.nextCursor;
          if (cursor !== null && (typeof cursor !== 'string' || seen.has(cursor))) throw new Error('无效分页数据');
          if (cursor) seen.add(cursor);
        } while (cursor);
        setNotes(result.sort((a, b) => b.time.localeCompare(a.time)));
      } catch (reason) { if (!controller.signal.aborted) setListError(message(reason, '笔记读取失败。')); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [revision]);

  function replaceEditor(next: NoteForm, target: EditingNote | null = null) {
    setForm(next); setBaseline(serialize(next)); setEditing(target); publishId.current = null;
  }
  function requestSwitch(run: () => void) {
    if (dirty) { setDiscardApproved(false); setSwitchRequest({ run }); }
    else run();
  }
  async function readNote(id: string): Promise<LoadedNote> {
    detailController.current?.abort();
    const controller = new AbortController(); detailController.current = controller;
    const response = await fetch(`/api/notes/${id}`, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(await responseError(response));
    const text = await response.text();
    return { ...parseNoteDocument(text), id, source: text, etag: response.headers.get('X-Note-Version') || response.headers.get('ETag') || '' };
  }
  async function openNote(id: string, edit = false) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const note = await readNote(id);
      if (edit) {
        if (!note.etag) throw new Error('服务器未返回笔记版本，请先更新 Worker。');
        replaceEditor(fromDocument(note), { id, etag: note.etag });
        setNotice('正在编辑已发布笔记，保存后更新原文章。');
      } else setViewer(note);
    } catch (reason) { setError(message(reason, '笔记读取失败。')); }
    finally { sending.current = false; setBusy(false); }
  }
  async function importFile(file: File) {
    setError(''); setNotice('');
    if (!/\.md$/i.test(file.name)) { setError('请选择 .md 文件。'); return; }
    if (file.size > MAX_NOTE_BYTES) { setError('笔记不能超过 256 KB。'); return; }
    sending.current = true; setBusy(true);
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      const hasMetadata = /^\uFEFF?---\r?\n/.test(text) || text.startsWith('---\n') || text.startsWith('---\r\n');
      const next = hasMetadata ? fromDocument(parseNoteDocument(text)) : { ...emptyForm(), title: file.name.replace(/\.md$/i, ''), body: text };
      // 导入到编辑模式时仍保存到当前文章，不创建另一篇笔记。
      setForm(next); publishId.current = null;
      setNotice(`已导入 ${file.name}，确认内容后${editing ? '保存修改' : '发布'}。`);
    } catch (reason) { setError(message(reason, '文件读取失败。')); }
    finally { sending.current = false; setBusy(false); }
  }
  async function publish() {
    if (sending.current) return;
    setError(''); setNotice('');
    try { parseNoteDocument(source); } catch (reason) { setError(message(reason, '内容格式错误。')); return; }
    sending.current = true; setBusy(true);
    if (attemptedSource.current !== source) publishId.current = null;
    publishId.current ??= crypto.randomUUID(); attemptedSource.current = source;
    const id = editing?.id || publishId.current;
    try {
      const response = await fetch(`/api/notes/${id}`, { method: editing ? 'PATCH' : 'PUT', headers: { 'Content-Type': 'text/markdown', ...(editing ? { 'If-Match': editing.etag } : {}) }, body: source });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json();
      if (editing) {
        const etag = response.headers.get('X-Note-Version') || data.etag || response.headers.get('ETag');
        if (typeof etag !== 'string' || !etag) throw new Error('已提交修改，但未收到新版本，请查看服务器内容确认。');
        setEditing({ id, etag }); setBaseline(source);
      } else replaceEditor(emptyForm());
      setNotice(editing ? '修改已保存，前台刷新后可见。' : '笔记已发布，前台刷新后可见。');
      setRevision(value => value + 1);
    } catch (reason) { setError(message(reason, '操作失败，当前内容已保留，可重试。')); }
    finally { sending.current = false; setBusy(false); }
  }
  async function removeNote() {
    if (!deleteTarget || sending.current) return;
    if (!deleteTarget.etag) { setDeleteError('缺少笔记版本，请先更新 Worker 并刷新列表。'); return; }
    sending.current = true; setBusy(true); setDeleteError('');
    try {
      const response = await fetch(`/api/notes/${deleteTarget.id}`, { method: 'DELETE', headers: { 'If-Match': deleteTarget.etag } });
      if (!response.ok) throw new Error(await responseError(response));
      setNotes(previous => previous.filter(note => note.id !== deleteTarget.id));
      if (editing?.id === deleteTarget.id) replaceEditor(emptyForm());
      setNotice('笔记已删除。'); setDeleteDone(true); setRevision(value => value + 1);
    } catch (reason) { setDeleteError(message(reason, '删除失败，请重试。')); }
    finally { sending.current = false; setBusy(false); }
  }

  return <section className="notes-manager" aria-label="笔记管理">
    <RouteHeaderRefresh disabled={busy || loading} onRefresh={() => { setError(''); setRevision(value => value + 1); }} />
    <p className="notes-hint">所有笔记均以 Markdown 文件保存在 R2，前台与后台读取同一份服务器数据。</p>
    {error && <p role="alert" className="notes-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {canEdit ? <>
      <div className="notes-actions">
        <h2>{editing ? '编辑笔记' : '新建笔记'}</h2>
        {editing && <><ManagementButton icon="details" disabled={busy} onClick={() => void openNote(editing.id)}>查看服务器版本</ManagementButton><ManagementButton icon="refresh" disabled={busy} onClick={() => requestSwitch(() => void openNote(editing.id, true))}>重新载入</ManagementButton></>}
        <ManagementButton icon="edit" disabled={busy} onClick={() => requestSwitch(() => { replaceEditor(emptyForm()); setNotice(''); setError(''); })}>新建笔记</ManagementButton>
        <label className="notes-import">导入 .md<input aria-label="导入 Markdown 文件" type="file" accept=".md,text/markdown" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) requestSwitch(() => void importFile(file)); }} /></label>
      </div>
      <fieldset disabled={busy} className="notes-fields">
        <label>标题<input value={form.title} maxLength={160} onChange={event => patchForm({ title: event.target.value })} /></label>
        <div className="notes-category-field">标签<span className="notes-categories" role="group" aria-label="标签">{NOTE_CATEGORY_OPTIONS.map(option => <label key={option.value}><input type="radio" name="note-category" checked={form.category === option.value} onChange={() => patchForm({ category: option.value })} />{option.label}</label>)}</span></div>
        <label>日期<input type="date" value={form.date} onChange={event => patchForm({ date: event.target.value })} /></label>
        <label>封面链接（可选）<input type="url" value={form.cover} placeholder="https://assets.anuluca.com/…" onChange={event => patchForm({ cover: event.target.value })} /></label>
      </fieldset>
      <div className="notes-editor-grid">
        <label className="notes-editor">Markdown 正文<textarea disabled={busy} value={form.body} spellCheck={false} onChange={event => patchForm({ body: event.target.value })} placeholder="## 开始记录" /></label>
        <section className="notes-preview" aria-label="Markdown 预览"><h2>预览</h2><h3>{form.title || '笔记标题'}</h3><div dangerouslySetInnerHTML={{ __html: preview }} /></section>
      </div>
      <div className="notes-actions"><ManagementButton icon={editing ? 'check' : 'deploy'} className="button-primary" disabled={busy || !form.body.trim() || !form.title.trim() || (!!editing && !dirty)} onClick={() => void publish()}>{busy ? '正在处理…' : editing ? '保存修改' : '发布笔记'}</ManagementButton><span>{dirty ? '有未保存的修改 · ' : ''}本地自动保存草稿 · 最大 256 KB</span></div>
    </> : <p>当前账号仅可查看已发布笔记。</p>}
    <section className="notes-published">
      <h2>已发布笔记</h2>
      <div className="notes-search"><label>搜索标题<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="输入笔记标题" /></label><ManagementSelect label="筛选笔记标签" value={filter} options={[{ value: 'all', label: '全部标签' }, ...NOTE_CATEGORY_OPTIONS]} onChange={setFilter} /><span>{visibleNotes.length} / {notes.length} 篇</span></div>
      {listError && <p role="alert" className="notes-error">{listError}</p>}
      {loading && <p role="status">正在读取在线笔记…</p>}
      {visibleNotes.map(note => <div className="notes-row" key={note.id}>
        <div className="notes-row__copy"><a href={`https://anuluca.com/atrium/notes?note=${note.id}`} target="_blank" rel="noreferrer">{note.title}</a><span>{NOTE_CATEGORIES[note.type]?.label.zhCn || '未分类'} · {note.time}</span></div>
        <div className="notes-actions"><ManagementButton icon="details" disabled={busy} onClick={() => void openNote(note.id)}>查看</ManagementButton>{canEdit && <><ManagementButton icon="edit" disabled={busy} onClick={() => requestSwitch(() => void openNote(note.id, true))}>编辑</ManagementButton><ManagementButton icon="delete" className="button-secondary button-danger" disabled={busy} onClick={() => { setDeleteError(''); setDeleteDone(false); setDeleteTarget(note); }}>删除</ManagementButton></>}</div>
      </div>)}
      {!loading && !visibleNotes.length && !listError && <p>{notes.length ? '没有匹配的笔记。' : '暂无在线发布的笔记。'}</p>}
    </section>
    {viewer && <ManagementModal title={viewer.metadata.title} onClose={() => setViewer(null)} footer={<ManagementButton icon="close" data-close-modal>关闭</ManagementButton>}>
      <p className="notes-hint">{NOTE_CATEGORIES[viewer.metadata.type].label.zhCn} · {viewer.metadata.time}</p>
      <div className="notes-preview notes-viewer" dangerouslySetInnerHTML={{ __html: markdown.render(viewer.body) }} />
      <details className="notes-source"><summary>Markdown 原文</summary><pre>{viewer.source}</pre></details>
    </ManagementModal>}
    {deleteTarget && <ManagementModal title="删除笔记" danger busy={busy} closeRequested={deleteDone} onClose={() => { setDeleteTarget(null); setDeleteDone(false); }} description={`确定删除「${deleteTarget.title}」？删除后无法恢复${editing?.id === deleteTarget.id ? '，当前文章的本地编辑也会清空' : ''}。`} footer={<><ManagementButton icon="close" data-close-modal disabled={busy}>取消</ManagementButton><ManagementButton icon="delete" className="button-primary button-danger" disabled={busy} onClick={() => void removeNote()}>{busy ? '正在删除…' : '确认删除'}</ManagementButton></>}>
      {deleteError && <p role="alert" className="notes-error">{deleteError}</p>}
    </ManagementModal>}
    {switchRequest && <ManagementModal title="放弃未保存的修改" closeRequested={discardApproved} onClose={() => { const action = switchRequest.run; setSwitchRequest(null); if (discardApproved) action(); setDiscardApproved(false); }} description="当前编辑有未保存的修改，继续操作会替换当前草稿。" footer={<><ManagementButton icon="close" data-close-modal>保留编辑</ManagementButton><ManagementButton icon="check" onClick={() => setDiscardApproved(true)}>放弃并继续</ManagementButton></>}><p>请先确认需要保留的内容已保存。</p></ManagementModal>}
  </section>;
}

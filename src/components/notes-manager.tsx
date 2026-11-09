"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { FeatureSwitch } from './feature-switch';
import { NotePreview } from './note-preview';
import { NoteBlockInserter } from './note-block-inserter';
import { MAX_NOTE_BYTES, NOTE_ASSET_BASE, parseNoteDocument, setNoteHidden, type NoteCategory, type NoteSummary } from '@/lib/note-document';
import { NOTE_CATEGORIES, NOTE_CATEGORY_OPTIONS, DEFAULT_NOTE_CATEGORY } from '@/lib/note-categories';
import { ManagementButton } from './infrastructure/management-button';
import { ManagementModal, ManagementSelect } from './infrastructure/ui';
import { RouteHeaderRefresh } from './route-header-refresh';
import './notes-manager.css';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
type NoteForm = { title: string; category: NoteCategory; date: string; cover: string; body: string; hidden: boolean };
type EditingNote = { id: string; etag: string };
type LoadedNote = ReturnType<typeof parseNoteDocument> & { id: string; etag: string; source: string };
const emptyForm = (): NoteForm => ({ title: '', category: DEFAULT_NOTE_CATEGORY, date: today(), cover: '', body: '', hidden: false });
const serialize = (form: NoteForm) => `---\ntitle: ${JSON.stringify(form.title)}\ndate: ${JSON.stringify(form.date)}\ncategory: ${form.category}\n${form.hidden ? 'hidden: true\n' : ''}${form.cover ? `cover: ${JSON.stringify(NOTE_ASSET_BASE + form.cover.trim().replace(/^\/+/, ''))}\n` : ''}---\n\n${form.body}\n`;
const fromDocument = (note: ReturnType<typeof parseNoteDocument>): NoteForm => ({ title: note.metadata.title, category: note.metadata.type, date: note.metadata.time, cover: note.metadata.image?.slice(NOTE_ASSET_BASE.length) || '', body: note.body, hidden: note.metadata.hidden === true });
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
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewer, setViewer] = useState<LoadedNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoteSummary | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteDone, setDeleteDone] = useState(false);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const publishId = useRef<string | null>(null);
  const sending = useRef(false);
  const attemptedSource = useRef('');
  const detailController = useRef<AbortController | null>(null);
  const source = useMemo(() => serialize(form), [form]);
  const dirty = source !== baseline;
  const visibleNotes = useMemo(() => notes.filter(note => (filter === 'all' || note.type === filter) && note.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [notes, query, filter]);
  const patchForm = (update: Partial<NoteForm>) => setForm(previous => ({ ...previous, ...update }));

  useEffect(() => {
    // 移除旧版遗留草稿，不再恢复或保存本地编辑内容。
    try { localStorage.removeItem('anuconsole.notes.draft.v1'); } catch { /* 存储不可用不影响管理。 */ }
    return () => detailController.current?.abort();
  }, []);
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
  function closeEditor() {
    setEditorOpen(false); replaceEditor(emptyForm()); setError(''); setNotice('');
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
        setEditorOpen(true);
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
    if (form.cover && /(?:^[a-z][\w+.-]*:|^\/\/|\\|(?:^|\/)\.\.?(?:\/|$)|\s)/i.test(form.cover)) { setError('封面只需填写 R2 相对路径，不包含域名、空格或上级目录。'); return; }
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
  async function toggleHidden(target: NoteSummary, hidden: boolean) {
    if (!canEdit || sending.current) return;
    sending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const note = await readNote(target.id);
      // 列表加载后若已有其他写入，要求刷新，避免覆盖尚未查看的修改。
      if (!note.etag || note.etag !== target.etag) throw new Error('笔记版本已变化，请刷新列表后重新操作。');
      const response = await fetch(`/api/notes/${target.id}`, { method: 'PATCH', headers: { 'Content-Type': 'text/markdown', 'If-Match': note.etag }, body: setNoteHidden(note.source, hidden) });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json();
      const etag = response.headers.get('X-Note-Version') || data.etag || response.headers.get('ETag');
      if (!etag) throw new Error('已提交修改，但未收到新版本，请刷新列表确认。');
      setNotes(previous => previous.map(item => item.id === target.id ? { ...item, hidden, etag } : item));
      setNotice(hidden ? '笔记已隐藏，Anutrium 刷新后不再显示。' : '笔记已恢复显示，Anutrium 刷新后可见。');
    } catch (reason) { setError(message(reason, '修改显示状态失败，请重试。')); }
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

  const publishButton = <ManagementButton icon={editing ? 'check' : 'deploy'} className="button-primary" disabled={busy || !form.body.trim() || !form.title.trim() || (!!editing && !dirty)} onClick={() => void publish()}>{busy ? '正在处理…' : editing ? '保存修改' : '发布笔记'}</ManagementButton>;

  return <section className="notes-manager" aria-label="笔记管理">
    <RouteHeaderRefresh disabled={busy || loading} onRefresh={() => { setError(''); setRevision(value => value + 1); }} />
    {!editorOpen && error && <p role="alert" className="notes-error">{error}</p>}
    {!editorOpen && notice && <p role="status">{notice}</p>}
    {canEdit ? <>
      {editorOpen && <ManagementModal title={editing ? '编辑笔记' : '新建笔记'} className="notes-editor-modal" busy={busy} onClose={closeEditor} footer={<>{publishButton}<ManagementButton icon="close" disabled={busy} data-close-modal>关闭</ManagementButton></>}>
      {error && <p role="alert" className="notes-error">{error}</p>}
      <div className="notes-editor-status">{notice ? <p role="status">{notice}</p> : <span />}<span className="notes-hint">最大 256 KB</span></div>
      <div className="notes-editor-tools">
        <NoteBlockInserter disabled={busy} onInsert={block => {
          const input = bodyInput.current;
          const start = input?.selectionStart ?? form.body.length;
          const end = input?.selectionEnd ?? start;
          patchForm({ body: form.body.slice(0, start) + block + form.body.slice(end) });
        }} />
        <label className="notes-import"><span>导入 .md</span><input aria-label="导入 Markdown 文件" type="file" accept=".md,text/markdown" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file); }} /></label>
        <div className="notes-actions">{editing && <><ManagementButton icon="details" disabled={busy} onClick={() => void openNote(editing.id)}>预览线上版本</ManagementButton><ManagementButton icon="refresh" disabled={busy} onClick={() => void openNote(editing.id, true)}>重新载入</ManagementButton></>}</div>
      </div>
      <fieldset disabled={busy} className="notes-fields">
        <label>标题<input value={form.title} maxLength={160} onChange={event => patchForm({ title: event.target.value })} /></label>
        <div className="notes-category-field">标签<span className="notes-categories" role="group" aria-label="标签">{NOTE_CATEGORY_OPTIONS.map(option => <label key={option.value}><input type="radio" name="note-category" checked={form.category === option.value} onChange={() => patchForm({ category: option.value })} />{option.label}</label>)}</span></div>
        <label>日期<input type="date" value={form.date} onChange={event => patchForm({ date: event.target.value })} /></label>
        <label>封面路径（可选）<input type="text" value={form.cover} placeholder="note-assets/cover.jpg" onChange={event => patchForm({ cover: event.target.value.replace(NOTE_ASSET_BASE, '') })} /></label>
        <div className="notes-visibility"><span>隐藏笔记</span><FeatureSwitch label="隐藏笔记" checked={form.hidden} disabled={busy} onChange={hidden => patchForm({ hidden })} /><span className="notes-hint">隐藏后不在 Anutrium 显示</span></div>
      </fieldset>
      <div className="notes-editor-grid">
        <label className="notes-editor">Markdown 正文<textarea aria-label="Markdown 正文" ref={bodyInput} disabled={busy} value={form.body} spellCheck={false} onChange={event => patchForm({ body: event.target.value })} placeholder="## 开始记录" /></label>
        <section className="notes-preview-column" aria-label="Markdown 预览"><h2 className="notes-preview-heading">预览</h2><div className="notes-preview notes-reader-shell"><NotePreview cover={form.cover ? NOTE_ASSET_BASE + form.cover.trim().replace(/^\/+/, '') : undefined} title={form.title} category={form.category} date={form.date} body={form.body} /></div></section>
      </div>
      </ManagementModal>}
    </> : <p>当前账号仅可查看已发布笔记。</p>}
    <section className="notes-published">
      <div className="notes-toolbar">
        <form className="notes-search" onSubmit={event => { event.preventDefault(); setQuery(searchInput); }}>
          <input aria-label="搜索标题" type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="输入笔记标题" />
          <ManagementButton icon="search" type="submit">搜索</ManagementButton>
          <ManagementSelect label="筛选笔记标签" value={filter} options={[{ value: 'all', label: '全部标签' }, ...NOTE_CATEGORY_OPTIONS]} onChange={setFilter} />
          <span>{visibleNotes.length} / {notes.length} 篇</span>
        </form>
        {canEdit && <ManagementButton icon="edit" disabled={busy} onClick={() => { replaceEditor(emptyForm()); setNotice(''); setError(''); setEditorOpen(true); }}>新建笔记</ManagementButton>}
      </div>
      <div className="notes-list" role="region" aria-label="笔记列表" tabIndex={0}>
      {listError && <p role="alert" className="notes-error">{listError}</p>}
      {loading && <p role="status">正在读取在线笔记…</p>}
      {visibleNotes.map(note => <div className="notes-row" key={note.id}>
        <div className="notes-row__copy"><a href={`https://anuluca.com/atrium/notes?note=${note.id}`} target="_blank" rel="noreferrer">{note.title}</a><span>{NOTE_CATEGORIES[note.type]?.label.zhCn || '未分类'} · {note.time}{note.hidden ? ' · 已隐藏' : ''}</span></div>
        <div className="notes-actions">{canEdit && <div className="notes-visibility"><span>隐藏</span><FeatureSwitch label={`隐藏笔记：${note.title}`} checked={note.hidden === true} disabled={busy || loading} onChange={hidden => void toggleHidden(note, hidden)} /></div>}<ManagementButton icon="details" disabled={busy} onClick={() => void openNote(note.id)}>查看</ManagementButton>{canEdit && <><ManagementButton icon="edit" disabled={busy} onClick={() => void openNote(note.id, true)}>编辑</ManagementButton><ManagementButton icon="delete" className="button-secondary button-danger" disabled={busy} onClick={() => { setDeleteError(''); setDeleteDone(false); setDeleteTarget(note); }}>删除</ManagementButton></>}</div>
      </div>)}
      {!loading && !visibleNotes.length && !listError && <p>{notes.length ? '没有匹配的笔记。' : '暂无在线发布的笔记。'}</p>}
      </div>
    </section>
    {viewer && <ManagementModal className="notes-viewer-modal notes-reader-shell" title={viewer.metadata.title} onClose={() => setViewer(null)} footer={<ManagementButton icon="close" data-close-modal>关闭</ManagementButton>}>
      <div className="notes-viewer"><NotePreview cover={viewer.metadata.image} entrance title={viewer.metadata.title} category={viewer.metadata.type} date={viewer.metadata.time} body={viewer.body} /></div>
      <details className="notes-source"><summary>Markdown 原文</summary><pre>{viewer.source}</pre></details>
    </ManagementModal>}
    {deleteTarget && <ManagementModal title="删除笔记" danger busy={busy} closeRequested={deleteDone} onClose={() => { setDeleteTarget(null); setDeleteDone(false); }} description={`确定删除「${deleteTarget.title}」？删除后无法恢复${editing?.id === deleteTarget.id ? '，当前文章的本地编辑也会清空' : ''}。`} footer={<><ManagementButton icon="close" data-close-modal disabled={busy}>取消</ManagementButton><ManagementButton icon="delete" className="button-primary button-danger" disabled={busy} onClick={() => void removeNote()}>{busy ? '正在删除…' : '确认删除'}</ManagementButton></>}>
      {deleteError && <p role="alert" className="notes-error">{deleteError}</p>}
    </ManagementModal>}

  </section>;
}

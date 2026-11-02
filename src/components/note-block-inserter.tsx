"use client";

import { useState } from 'react';
import { ManagementButton } from './infrastructure/management-button';

type BlockType = 'gallery' | 'tool-card' | 'tabs';
const base = 'https://assets.anuluca.com/';
const text = (value: string) => value.replace(/[\[\]<>\\\r\n]/g, ' ').trim();

/** 插入只生成 Markdown；保存继续使用原有版本校验与发布链路。 */
export function NoteBlockInserter({ disabled, onInsert }: { disabled: boolean; onInsert: (source: string) => void }) {
  const [type, setType] = useState<BlockType>('gallery');
  const [images, setImages] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [groups, setGroups] = useState('');
  const [error, setError] = useState('');
  function insert() {
    let block = '';
    if (type === 'gallery') {
      const rows = images.split('\n').filter(row => row.trim()).map(row => {
        const [path, ...caption] = row.split('|');
        const source = path.trim().startsWith('https://') ? path.trim() : base + path.trim().replace(/^\/+/, '');
        const image = new URL(source);
        if (image.origin !== new URL(base).origin) throw new Error('图片需要使用线上 R2 地址或路径。');
        return `![${text(caption.join('|'))}](${image.href.replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
      });
      if (!rows.length) throw new Error('请至少填写一张图片。');
      block = `::: gallery\n${rows.join('\n')}\n:::`;
    } else if (type === 'tool-card') {
      const link = new URL(url);
      if (!['https:', 'http:'].includes(link.protocol) || !text(title)) throw new Error('请填写标题和有效的 HTTP(S) 链接。');
      block = `::: tool-card\n[${text(title)}](${link.href.replace(/\(/g, '%28').replace(/\)/g, '%29')})\n\n${description}\n:::`;
    } else {
      const titles = groups.split('\n').map(text).filter(Boolean);
      if (!titles.length) throw new Error('请至少填写一个分组。');
      block = `::::: tabs\n${titles.map(label => `\n:::: tab ${label}\n\n在这里填写正文或插入图片列表。\n\n::::`).join('\n')}\n\n:::::`;
    }
    setError(''); onInsert(`\n\n${block}\n\n`);
  }
  return <details className="notes-block-inserter">
    <summary>插入内容块</summary>
    <div className="notes-block-inserter__panel">
      <div className="notes-actions" role="group" aria-label="内容块类型">{([['gallery', '图片列表'], ['tool-card', '工具卡'], ['tabs', '分组标签页']] as const).map(([value, label]) => <button key={value} type="button" disabled={disabled} aria-pressed={type === value} onClick={() => { setType(value); setError(''); }}>{label}</button>)}</div>
      {type === 'gallery' && <label>图片路径与说明<textarea value={images} disabled={disabled} onChange={event => setImages(event.target.value)} placeholder={'每行一张：R2 路径 | 图片说明\nIsland/notes/example.jpg | 示例'} /></label>}
      {type === 'tool-card' && <><label>工具名称<input value={title} disabled={disabled} onChange={event => setTitle(event.target.value)} /></label><label>工具链接<input type="url" value={url} disabled={disabled} onChange={event => setUrl(event.target.value)} /></label><label>工具说明<textarea value={description} disabled={disabled} onChange={event => setDescription(event.target.value)} /></label></>}
      {type === 'tabs' && <label>分组名称（每行一个）<textarea value={groups} disabled={disabled} onChange={event => setGroups(event.target.value)} placeholder={'BW\nBW2\nXY'} /></label>}
      {error && <p role="alert">{error}</p>}
      <ManagementButton icon="edit" disabled={disabled} onClick={() => { try { insert(); } catch (reason) { setError(reason instanceof Error ? reason.message : '内容格式错误。'); } }}>插入正文</ManagementButton>
    </div>
  </details>;
}

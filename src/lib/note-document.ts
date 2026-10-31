import { parseDocument } from 'yaml'

import { isNoteCategory, NOTE_CATEGORY_OPTIONS, type NoteCategory } from './note-categories.ts'

export type { NoteCategory } from './note-categories.ts'
export interface NoteMetadata {
  title: string
  time: string
  type: NoteCategory
  image?: string
}
export interface NoteSummary extends NoteMetadata {
  id: string
  path: string
  etag?: string
}
export const MAX_NOTE_BYTES = 256 * 1024

// 元信息与正文保存在同一个 Markdown 文件中；R2 元数据只是列表索引。
export function parseNoteDocument(source: string): {
  metadata: NoteMetadata
  body: string
} {
  if (new TextEncoder().encode(source).byteLength > MAX_NOTE_BYTES)
    throw new Error('笔记不能超过 256 KB')
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)
  if (match && match[1].length > 4096) throw new Error('元信息不能超过 4 KB')
  if (!match)
    throw new Error('文件需要包含 title、date、category 的 YAML 元信息')
  const document = parseDocument(match[1], {
    schema: 'failsafe',
    uniqueKeys: true,
  })
  if (document.errors.length) throw new Error('YAML 元信息格式错误')
  const data = document.toJS({ maxAliasCount: 0 })
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('元信息格式错误')
  if (
    Object.keys(data).some(
      (key) => !['title', 'date', 'category', 'cover'].includes(key)
    )
  )
    throw new Error('元信息仅支持 title、date、category、cover')
  if (
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    data.title.trim().length > 160
  )
    throw new Error('标题应为 1–160 个字符')
  if (
    typeof data.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
    !Number.isFinite(Date.parse(data.date)) ||
    new Date(data.date).toISOString().slice(0, 10) !== data.date
  )
    throw new Error('日期需要是有效的 YYYY-MM-DD')
  if (!isNoteCategory(data.category))
    throw new Error(`标签需要是 ${NOTE_CATEGORY_OPTIONS.map(option => option.label).join('、')}`)
  if (
    data.cover !== undefined &&
    (typeof data.cover !== 'string' ||
      !/^https:\/\/assets\.anuluca\.com\/[^\s]+$/.test(data.cover))
  )
    throw new Error('封面需要使用线上 R2 图片链接')
  const body = normalized.slice(match[0].length).trim()
  if (!body) throw new Error('笔记正文不能为空')
  return {
    metadata: {
      title: data.title.trim(),
      time: data.date,
      type: data.category,
      ...(data.cover ? { image: data.cover } : {}),
    },
    body,
  }
}

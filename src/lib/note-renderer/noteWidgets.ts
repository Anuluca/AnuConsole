import type MarkdownIt from 'markdown-it'

import { getCardMobileThumbnailUrl, getCardThumbnailUrl } from './imageVariant'

export type NoteWidget =
  | { type: 'social-links'; caption?: string }
  | {
      type: 'gallery'
      items: { url: string; title: string }[]
      columns?: number
    }
  | { type: 'tabs'; pages: { title: string; body: string }[] }
export interface NoteWidgetEnvironment {
  noteWidgets?: NoteWidget[]
  noteWidgetDepth?: number
}

/** 块边界由冒号数量确定；代码围栏中的结束标记不参与匹配。 */
export function noteWidgets(
  markdown: MarkdownIt,
  contacts: { links: { type: string; href?: string }[]; wechatId: string }
) {
  const escape = markdown.utils.escapeHtml
  markdown.block.ruler.before(
    'fence',
    'note_widget',
    (state, start, end, silent) => {
      const lineAt = (line: number) =>
        state.src.slice(
          state.bMarks[line] + state.tShift[line],
          state.eMarks[line]
        )
      const opening = lineAt(start).match(
        /^(:{3,})\s+(gallery|tool-card|tabs|tab|social-links)(?:\s+(.+?))?\s*$/
      )
      if (!opening || state.sCount[start] - state.blkIndent >= 4) return false
      let last = start + 1
      let codeFence = ''
      for (; last < end; last++) {
        const line = lineAt(last)
        const fence = line.match(/^\s*(`{3,}|~{3,})/)
        if (fence) {
          if (!codeFence) codeFence = fence[1]
          else if (
            fence[1][0] === codeFence[0] &&
            fence[1].length >= codeFence.length &&
            /^\s*(`+|~+)\s*$/.test(line)
          )
            codeFence = ''
        }
        if (
          !codeFence &&
          new RegExp(`^:{${opening[1].length},}\\s*$`).test(line)
        )
          break
      }
      if (last === end) return false
      if (silent) return true
      const token = state.push('note_widget', '', 0)
      token.block = true
      token.map = [start, last + 1]
      token.meta = { type: opening[2], title: opening[3] || '' }
      token.content = state.getLines(start + 1, last, state.blkIndent, false)
      state.line = last + 1
      return true
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] }
  )

  markdown.renderer.rules.note_widget = (
    tokens,
    index,
    _options,
    environment: NoteWidgetEnvironment
  ) => {
    const token = tokens[index]
    const depth = environment.noteWidgetDepth || 0
    if (depth >= 8) return `<pre>${escape(token.content)}</pre>`
    const env = { ...environment, noteWidgetDepth: depth + 1 }
    const renderBody = () => markdown.render(token.content, env)
    const placeholder = (widget: NoteWidget) => {
      const id = environment.noteWidgets!.push(widget) - 1
      return `<div class="note-widget note-widget--${widget.type}" data-note-widget="${id}"></div>\n`
    }
    if (token.meta.type === 'social-links') {
      if (token.content.trim()) return renderBody()
      if (environment.noteWidgets)
        return placeholder({ type: 'social-links', caption: token.meta.title })
      const labels: Record<string, string> = {
        WECHAT: '微信',
        MAIL: '邮箱',
        WEIBO: '微博',
        BILIBILI: 'B站',
      }
      return `<div class="note-social-links">${
        token.meta.title
          ? `<span class="note-social-links__caption">${escape(
              token.meta.title
            )}</span>`
          : ''
      }<nav class="note-social-links-preview" aria-label="社交平台">${[
        'WECHAT',
        'MAIL',
        'WEIBO',
        'BILIBILI',
      ]
        .map((type) => {
          const link = contacts.links.find((item) => item.type === type)
          return type === 'WECHAT'
            ? `<span>微信：${escape(contacts.wechatId)}</span>`
            : `<a href="${escape(link?.href || '')}"${
                type === 'MAIL'
                  ? ''
                  : ' target="_blank" rel="noopener noreferrer"'
              }>${labels[type]}</a>`
        })
        .join('')}</nav></div>\n`
    }
    if (token.meta.type === 'gallery') {
      const parsed = markdown.parse(token.content, {})
      const inline = parsed.filter((part) => part.type === 'inline')
      // 只接受独立图片；混入正文时保留原文，避免静默丢失内容。
      if (
        parsed.some(
          (part) =>
            !['paragraph_open', 'inline', 'paragraph_close'].includes(part.type)
        ) ||
        inline.some((part) =>
          part.children?.some(
            (child) => !['image', 'softbreak', 'hardbreak'].includes(child.type)
          )
        )
      )
        return renderBody()
      const items = inline.flatMap((part) =>
        (part.children || [])
          .filter((child) => child.type === 'image')
          .map((image) => ({
            url: image.attrGet('src') || '',
            title: image.content,
          }))
      )
      if (
        !items.length ||
        items.some(
          (item) => !/^https:\/\/assets\.anuluca\.com\//.test(item.url)
        )
      )
        return renderBody()
      const columnOption = /^columns=([1-6])$/.exec(token.meta.title)
      const columns = columnOption ? Number(columnOption[1]) : undefined
      if (environment.noteWidgets)
        return placeholder({
          type: 'gallery',
          items,
          ...(columns ? { columns } : {}),
        })
      const layout = columns
        ? ` style="grid-template-columns:repeat(${columns},minmax(0,1fr))"`
        : ''
      return `<div class="note-widget-gallery"${layout}>${items
        .map(
          (item) =>
            `<figure><picture><source media="(max-width: 768px)" srcset="${escape(
              getCardMobileThumbnailUrl(item.url)
            )}"><img src="${escape(
              getCardThumbnailUrl(item.url)
            )}" data-note-original="${escape(item.url)}" alt="${escape(
              item.title
            )}" loading="lazy" decoding="async" tabindex="0" role="button"></picture><figcaption>${escape(
              item.title
            )}</figcaption></figure>`
        )
        .join('')}</div>\n`
    }
    if (token.meta.type === 'tabs') {
      const parsed = markdown.parse(token.content, {})
      if (
        !parsed.length ||
        parsed.some(
          (part) =>
            part.type !== 'note_widget' ||
            part.meta.type !== 'tab' ||
            !part.meta.title
        )
      )
        return renderBody()
      const pages = parsed.map((part) => ({
        title: part.meta.title as string,
        body: part.content,
      }))
      if (environment.noteWidgets) return placeholder({ type: 'tabs', pages })
      return `<section class="note-widget-tabs"><nav class="note-widget-tab-rail" aria-label="内容分组">${pages
        .map(
          (page, i) =>
            `<button type="button" data-note-tab="${i}" aria-pressed="${
              i === 0
            }">${escape(page.title)}</button>`
        )
        .join('')}</nav>${pages
        .map(
          (page, i) =>
            `<section data-note-panel="${i}" aria-label="${escape(
              page.title
            )}"${i ? ' hidden' : ''}>${markdown.render(
              page.body,
              env
            )}</section>`
        )
        .join('')}</section>\n`
    }
    if (token.meta.type === 'tool-card')
      return `<aside class="note-widget-tool-card">${renderBody()}</aside>\n`
    return `<section aria-label="${escape(
      token.meta.title
    )}">${renderBody()}</section>\n`
  }
}

/** 后台使用静态 HTML 预览；只处理渲染器生成的分组按钮。 */
export function selectNoteWidgetTab(target: HTMLElement): boolean {
  const button = target.closest<HTMLButtonElement>('button[data-note-tab]')
  const group = button?.closest<HTMLElement>('.note-widget-tabs')
  if (!button || !group) return false
  for (const child of Array.from(group.children)) {
    if (child.matches('[data-note-panel]'))
      (child as HTMLElement).hidden =
        child.getAttribute('data-note-panel') !== button.dataset.noteTab
  }
  for (const sibling of Array.from(button.parentElement!.children))
    sibling.setAttribute('aria-pressed', String(sibling === button))
  return true
}

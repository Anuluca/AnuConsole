import hljs from 'highlight.js/lib/core'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import katex from 'katex'
import MarkdownIt from 'markdown-it'
import abbr from 'markdown-it-abbr'
import anchor from 'markdown-it-anchor'
import container from 'markdown-it-container'
import deflist from 'markdown-it-deflist'
import { full as emoji } from 'markdown-it-emoji'
import footnote from 'markdown-it-footnote'
import ins from 'markdown-it-ins'
import mark from 'markdown-it-mark'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import taskLists from 'markdown-it-task-lists'
import texmath from 'markdown-it-texmath'

import contactLinks, { WECHAT_ID } from './contactLinks'
import { renderNoteCodeLines, wrapNoteCodeFrame } from './noteCodeLines'
import { noteHexoTags } from './noteHexoTags'
import { type NoteWidget, noteWidgets } from './noteWidgets'

Object.entries({ javascript, xml, css, json, typescript }).forEach(
  ([name, language]) => hljs.registerLanguage(name, language)
)

// 保留原始 HTML 禁用与协议校验，仅由受控插件生成必要的展示标签。
const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
  quotes: '“”‘’',
  highlight: (source, language) =>
    hljs.getLanguage(language)
      ? hljs.highlight(source, { language }).value
      : '',
})
  .use(abbr)
  .use(anchor, { tabIndex: false })
  .use(deflist)
  .use(emoji)
  .use(footnote)
  .use(ins)
  .use(mark)
  .use(sub)
  .use(sup)
  .use(taskLists)
  .use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: {
      trust: false,
      throwOnError: false,
      maxExpand: 1000,
      maxSize: 20,
    },
  })
  .use(noteHexoTags)
  .use(noteWidgets, { links: contactLinks, wechatId: WECHAT_ID })

for (const name of ['note', 'tip', 'attention', 'warning'])
  markdown.use(container, name)

// 保留分割线来源标记，使演示中的下划线、连字符和星号呈现不同粗细。
markdown.renderer.rules.hr = (tokens, index, options, _env, renderer) => {
  tokens[index].attrSet('data-note-rule', tokens[index].markup[0])
  return renderer.renderToken(tokens, index, options)
}

// 摘要分隔符只在块级语法中生效；代码块中的同名注释仍作为代码显示。
markdown.block.ruler.before(
  'paragraph',
  'note_excerpt',
  (state, start, _end, silent) => {
    const line = state.src.slice(
      state.bMarks[start] + state.tShift[start],
      state.eMarks[start]
    )
    if (!/^<!--\s*more\s*-->/i.test(line) || state.sCount[start] >= 4)
      return false
    if (!silent) state.line = state.lineMax
    return true
  },
  { alt: ['paragraph', 'reference', 'blockquote', 'list'] }
)

markdown.renderer.rules.link_open = (
  tokens,
  index,
  options,
  _env,
  renderer
) => {
  // 脚注及文内锚点继续在阅读器中定位，其余正文链接统一新窗口打开。
  if (!tokens[index].attrGet('href')?.startsWith('#')) {
    tokens[index].attrSet('target', '_blank')
    tokens[index].attrSet('rel', 'noopener noreferrer')
  }
  return renderer.renderToken(tokens, index, options)
}

for (const rule of ['fence', 'code_block']) {
  const renderCode = markdown.renderer.rules[rule]!
  markdown.renderer.rules[rule] = (tokens, index, options, env, renderer) =>
    wrapNoteCodeFrame(
      renderCode(tokens, index, options, env, renderer).replace(
        /(<code\b[^>]*>)([\s\S]*?)(<\/code>)/,
        (_match, opening, content, closing) =>
          opening + renderNoteCodeLines(content) + closing
      ),
      tokens[index].content
    )
}

// 元素测试需要的 HTML 仅允许这组无交互标签；事件、样式、脚本和任意属性仍会转义。
markdown.inline.ruler.before(
  'html_inline',
  'note_safe_elements',
  (state, silent) => {
    const match = state.src
      .slice(state.pos)
      .match(
        /^<(\/?)(u|dl|dt|dd|sup|sub|cite|acronym|abbr)(?:\s+title=("[^"]*"|'[^']*'))?\s*>/i
      )
    if (!match || (match[1] && match[3])) return false
    if (!silent) {
      const token = state.push('html_inline', '', 0)
      const title = match[3]
        ? ` title="${markdown.utils.escapeHtml(
            markdown.utils.unescapeAll(match[3].slice(1, -1))
          )}"`
        : ''
      const tag = match[2].toLowerCase()
      // 自定义说明不依赖浏览器 title 提示延迟，同时提供键盘与屏幕阅读器描述。
      const attributes =
        /^(abbr|acronym)$/.test(tag) && match[3]
          ? ` data-note-title="${markdown.utils.escapeHtml(
              markdown.utils.unescapeAll(match[3].slice(1, -1))
            )}" tabindex="0" aria-label="${markdown.utils.escapeHtml(
              markdown.utils.unescapeAll(match[3].slice(1, -1))
            )}"`
          : title
      token.content = `<${match[1]}${tag}${attributes}>`
    }
    state.pos += match[0].length
    return true
  }
)

markdown.renderer.rules.abbr_open = (
  tokens,
  index,
  options,
  _env,
  renderer
) => {
  const token = tokens[index]
  const title = token.attrGet('title')
  if (title) {
    token.attrs!.splice(token.attrIndex('title'), 1)
    token.attrSet('data-note-title', title)
    token.attrSet('tabindex', '0')
    token.attrSet('aria-label', title)
  }
  return renderer.renderToken(tokens, index, options)
}

// 图片表格沿用标准 Markdown；空表头只负责分列，不占用展示高度。
markdown.renderer.rules.table_open = (
  tokens,
  index,
  options,
  _env,
  renderer
) => {
  let hasImage = false
  let imageOnly = true
  for (
    let i = index + 1;
    i < tokens.length && tokens[i].type !== 'table_close';
    i++
  ) {
    const token = tokens[i]
    if (token.type !== 'inline') continue
    const containsImage =
      token.children?.some((child) => child.type === 'image') || false
    hasImage ||= containsImage
    if (token.content.trim() && !containsImage) imageOnly = false
  }
  if (hasImage && imageOnly) {
    tokens[index].attrJoin('class', 'note-image-table')
  }
  return renderer.renderToken(tokens, index, options)
}

const renderImage = markdown.renderer.rules.image!
markdown.renderer.rules.image = (tokens, index, options, env, renderer) => {
  const previous = tokens[index - 1]
  if (
    previous?.type === 'html_inline' &&
    /^<abbr data-note-title=/.test(previous.content)
  ) {
    const token = tokens[index]
    token.attrSet('loading', 'lazy')
    token.attrSet('decoding', 'async')
    token.attrSet('width', '64')
    token.attrSet('height', '64')
    return `${renderImage(
      tokens,
      index,
      options,
      env,
      renderer
    )}<span class="note-image-label">${markdown.utils.escapeHtml(
      token.content
    )}</span>`
  }
  tokens[index].attrSet('loading', 'lazy')
  tokens[index].attrSet('decoding', 'async')
  tokens[index].attrSet('role', 'button')
  tokens[index].attrSet('tabindex', '0')
  tokens[index].attrSet(
    'aria-label',
    `查看大图：${tokens[index].content || '图片'}`
  )
  const image = `<span class="note-image-hover">${renderImage(
    tokens,
    index,
    options,
    env,
    renderer
  )}</span>`
  const caption = renderer.renderInlineAsText(
    tokens[index].children || [],
    options,
    env
  )
  return caption
    ? `${image}<span class="note-image-caption">${markdown.utils.escapeHtml(
        caption
      )}</span>`
    : image
}

const renderFootnoteRef = markdown.renderer.rules.footnote_ref!
markdown.renderer.rules.footnote_ref = (
  tokens,
  index,
  options,
  env,
  renderer
) => {
  const definition = env.footnotes?.list[tokens[index].meta.id]
  const text =
    definition?.content ||
    definition?.tokens
      ?.filter(
        (token: { type: string; content: string }) => token.type === 'inline'
      )
      .map((token: { type: string; content: string }) => token.content)
      .join('\n') ||
    ''
  return `<span class="note-footnote" title="${markdown.utils.escapeHtml(
    text
  )}">${renderFootnoteRef(tokens, index, options, env, renderer)}</span>`
}

export const renderNoteMarkdown = (body: string) => markdown.render(body)

// Vue 阅读器只挂载白名单组件；Markdown 始终不作为 Vue 模板执行。
export const renderNoteContent = (body: string, depth = 0) => {
  const env = { noteWidgets: [] as NoteWidget[], noteWidgetDepth: depth }
  return { html: markdown.render(body, env), widgets: env.noteWidgets }
}

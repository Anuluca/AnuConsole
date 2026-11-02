import type MarkdownIt from 'markdown-it'

import { renderNoteCodeLines, wrapNoteCodeFrame } from './noteCodeLines'

/** 仅解释测试集中的 Hexo 标签，不执行模板代码，也不接受任意嵌入地址。 */
export function noteHexoTags(markdown: MarkdownIt) {
  const escape = markdown.utils.escapeHtml
  const safeLink = (source: string, label: string) => {
    const url = markdown.normalizeLink(source)
    return markdown.validateLink(url) && /^https?:\/\//i.test(url)
      ? `<a href="${escape(
          url
        )}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`
      : escape(label)
  }
  const citation = (args: string) => {
    const match = args.match(/^(.*?)\s+(https?:\/\/\S+)(?:\s+([\s\S]+))?$/)
    if (match)
      return `<strong>${markdown.renderInline(
        match[1]
      )}</strong> <cite>${safeLink(match[2], match[3] || match[2])}</cite>`
    const book = args.match(/^(.*?)[,，]\s*([\s\S]+)$/)
    if (book)
      return `<strong>${markdown.renderInline(
        book[1]
      )}</strong>，<cite>${markdown.renderInline(book[2])}</cite>`
    return markdown.renderInline(args)
  }
  const codeCaption = (caption: string) => {
    const parts = caption.match(/^(.*?)\s+(https?:\/\/\S+)(?:\s+([\s\S]+))?$/)
    return `<figcaption><span class="note-code-caption-title">${escape(
      parts ? parts[1] : caption
    )}</span>${
      parts
        ? `<span class="note-code-caption-link">${safeLink(
            parts[2],
            parts[3] || parts[2]
          )}</span>`
        : ''
    }</figcaption>`
  }
  const iframe = (
    source: string,
    title: string,
    referrerPolicy = 'no-referrer'
  ) =>
    `<div class="note-embed${
      title === 'YouTube' || title === 'Bilibili' ? ' native-cursor' : ''
    }"><iframe src="${escape(source)}" title="${escape(
      title
    )}" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" referrerpolicy="${referrerPolicy}" allowfullscreen></iframe></div>\n`

  markdown.block.ruler.before(
    'fence',
    'note_hexo_tags',
    (state, start, end, silent) => {
      const line = state.src.slice(
        state.bMarks[start] + state.tShift[start],
        state.eMarks[start]
      )
      const match = line.match(
        /^{%\s*(blockquote|pullquote|codeblock|youtube|vimeo|bilibili|gist|jsfiddle)\s*(.*?)\s*%}\s*$/
      )
      if (!match || state.sCount[start] - state.blkIndent >= 4) return false
      const [, type, args] = match
      let last = start
      if (['blockquote', 'pullquote', 'codeblock'].includes(type)) {
        for (last = start + 1; last < end; last++) {
          const closing = state.src.slice(
            state.bMarks[last] + state.tShift[last],
            state.eMarks[last]
          )
          if (closing.trim() === `{% end${type} %}`) break
        }
        if (last === end) return false
      }
      if (silent) return true
      const token = state.push('note_hexo', '', 0)
      token.block = true
      token.map = [start, last + 1]
      token.meta = { type, args }
      token.content =
        last > start
          ? state.getLines(start + 1, last, state.blkIndent, false)
          : ''
      state.line = last + 1
      return true
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] }
  )

  markdown.renderer.rules.note_hexo = (tokens, index, options, env) => {
    const token = tokens[index]
    const { type, args } = token.meta
    if (type === 'blockquote' || type === 'pullquote') {
      // 再次解析内层 Markdown，但限制自定义块递归，避免恶意嵌套耗尽调用栈。
      const depth = env.noteHexoDepth || 0
      if (depth >= 16) return `<pre>${escape(token.content)}</pre>`
      const content = markdown.render(token.content, {
        ...env,
        noteHexoDepth: depth + 1,
      })
      const direction = type === 'pullquote' && args === 'right' ? ' right' : ''
      return `<blockquote class="note-quote${direction}">${content}${
        type === 'blockquote' && args
          ? `<footer>${citation(args)}</footer>`
          : ''
      }</blockquote>\n`
    }
    if (type === 'codeblock') {
      const language = args.match(/(?:^|\s)lang:([\w+-]+)/)?.[1] || ''
      const marked = args.match(/(?:^|\s)mark:([\d,-]+)/)?.[1] || ''
      const caption = args.replace(/(?:^|\s)(?:lang|mark):\S+/g, '').trim()
      const content = renderNoteCodeLines(
        options.highlight?.(token.content, language, '') ||
          escape(token.content),
        marked
      )
      return `<figure class="note-code-block">${
        caption ? codeCaption(caption) : ''
      }${wrapNoteCodeFrame(
        `<pre><code class="language-${escape(
          language
        )}">${content}</code></pre>`,
        token.content
      )}</figure>\n`
    }
    const id = args.split(/\s+/)[0]
    if (type === 'bilibili' && /^BV[1-9A-HJ-NP-Za-km-z]{10}$/.test(id))
      return iframe(
        `https://player.bilibili.com/player.html?bvid=${id}&autoplay=0`,
        'Bilibili',
        'strict-origin-when-cross-origin'
      )
    if (type === 'youtube' && /^[\w-]{11}$/.test(id))
      // YouTube 用 Referer 验证嵌入来源；隐藏来源会触发播放器错误 153。
      return iframe(
        `https://www.youtube-nocookie.com/embed/${id}`,
        'YouTube',
        'strict-origin-when-cross-origin'
      )
    if (type === 'vimeo' && /^\d+$/.test(id))
      return iframe(`https://player.vimeo.com/video/${id}`, 'Vimeo')
    if (type === 'jsfiddle' && /^[\w-]+$/.test(id))
      return iframe(`https://jsfiddle.net/${id}/embedded/`, 'JSFiddle')
    if (type === 'gist' && /^[a-f\d]+$/i.test(id))
      return iframe(`https://gist.github.com/${id}.pibb`, 'GitHub Gist')
    return `<p>${escape(`{% ${type} ${args} %}`)}</p>\n`
  }
}

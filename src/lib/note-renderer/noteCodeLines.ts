/** 高亮结果只包含转义文本与 span；跨行补齐 span，保留多行注释和字符串的高亮。 */
export function renderNoteCodeLines(html: string, marked = '') {
  const ranges = marked.split(',').map((range) => range.split('-').map(Number))
  const openSpans: string[] = []
  const lines = html.replace(/\n$/, '').split('\n')
  return lines
    .map((line, index) => {
      const prefix = openSpans.join('')
      for (const tag of line.match(/<span\b[^>]*>|<\/span>/g) || []) {
        if (tag === '</span>') openSpans.pop()
        else openSpans.push(tag)
      }
      const isMarked = ranges.some(
        ([first, last = first]) => index + 1 >= first && index + 1 <= last
      )
      return `<span class="note-code-line${
        isMarked ? ' is-marked' : ''
      }" data-line="${index + 1}">${prefix}${line}${'</span>'.repeat(
        openSpans.length
      )}</span>`
    })
    .join('\n')
}

/** 行号放在滚动区域之外，代码横向滚动时不移动，也不进入复制结果。 */
export function wrapNoteCodeFrame(pre: string, source: string) {
  const count = source.replace(/\n$/, '').split('\n').length
  const gutter = Array.from(
    { length: count },
    (_, index) => `<span>${index + 1}</span>`
  ).join('')
  return `<div class="note-code-frame"><div class="note-code-gutter" aria-hidden="true">${gutter}</div>${pre}</div>\n`
}

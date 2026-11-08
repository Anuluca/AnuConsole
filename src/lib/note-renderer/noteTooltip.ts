const selector = 'abbr[data-note-title], acronym[data-note-title]'

// 委托事件保留退场节点，直到公共 CRT 关机动画完成；重新进入可中断退场。
export function handleNoteTooltipEnter(event: Event) {
  if (event instanceof PointerEvent && event.pointerType === 'touch') return
  const target = (event.target as Element).closest(selector)
  if (!target) return
  if (target.closest('.note-image-table')) {
    showTableTooltip(target as HTMLElement)
    return
  }
  target.classList.remove('is-tooltip-closing')
  target.classList.add('is-tooltip-open')
}

export function handleNoteTooltipLeave(event: Event) {
  const target = (event.target as Element).closest(selector)
  if (!target) return
  if (target.closest('.note-image-table')) {
    const related = (event as FocusEvent | PointerEvent).relatedTarget
    if (!(related instanceof Node && target.contains(related)))
      closeTableTooltip()
    return
  }
  if (!target.classList.contains('is-tooltip-open')) return
  const related = (event as FocusEvent | PointerEvent).relatedTarget
  if (related instanceof Node && target.contains(related)) return
  if (event.type === 'pointerout' && target.matches(':focus-visible')) return
  if (event.type === 'focusout' && target.matches(':hover')) return
  target.classList.remove('is-tooltip-open')
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    target.classList.add('is-tooltip-closing')
}

export function handleNoteTooltipAnimationEnd(event: AnimationEvent) {
  if (event.animationName === 'anutriumCrtOff')
    (event.target as Element)
      .closest(selector)
      ?.classList.remove('is-tooltip-closing')
}

let tableTooltip: {
  target: HTMLElement
  element: HTMLElement
  close: () => void
} | null = null

function closeTableTooltip() {
  tableTooltip?.close()
}

// 放入顶层以避开表格与正文滚动容器的裁切；滚动时关闭，不进行高频布局测量。
function showTableTooltip(target: HTMLElement) {
  if (tableTooltip?.target === target) return
  closeTableTooltip()
  const element = document.createElement('div')
  element.className = 'note-table-tooltip no-rem'
  element.id = 'note-table-tooltip'
  element.setAttribute('role', 'tooltip')
  element.setAttribute('popover', 'manual')
  element.textContent = target.dataset.noteTitle || ''
  const reader = target.closest('.note-reader')
  const supportsPopover = 'showPopover' in element
  ;(supportsPopover ? reader || document.body : document.body).append(element)
  if (supportsPopover)
    (element as HTMLElement & { showPopover?: () => void }).showPopover?.()
  const rect = target.getBoundingClientRect()
  const width = element.offsetWidth
  const height = element.offsetHeight
  element.style.left = `${Math.max(
    8,
    Math.min(
      rect.left + rect.width / 2 - width / 2,
      window.innerWidth - width - 8
    )
  )}px`
  element.style.top = `${Math.max(
    8,
    rect.bottom + height + 8 < window.innerHeight
      ? rect.bottom + 6
      : rect.top - height - 6
  )}px`
  target.setAttribute('aria-describedby', element.id)
  const close = () => {
    if (tableTooltip?.element === element) tableTooltip = null
    target.removeAttribute('aria-describedby')
    document.removeEventListener('scroll', close, true)
    window.removeEventListener('resize', close)
    observer.disconnect()
    element.removeAttribute('id')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      element.remove()
    else {
      element.classList.add('is-tooltip-closing')
      element.addEventListener('animationend', () => element.remove(), {
        once: true,
      })
      window.setTimeout(() => element.remove(), 500)
    }
  }
  const observer = new MutationObserver(() => {
    if (!target.isConnected) close()
  })
  observer.observe(reader?.parentElement || document.body, {
    childList: true,
    subtree: true,
  })
  document.addEventListener('scroll', close, { capture: true, passive: true })
  window.addEventListener('resize', close, { passive: true })
  tableTooltip = { target, element, close }
}

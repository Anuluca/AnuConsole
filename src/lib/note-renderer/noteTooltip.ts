const selector = 'abbr[data-note-title], acronym[data-note-title]'

// 委托事件保留退场节点，直到公共 CRT 关机动画完成；重新进入可中断退场。
export function handleNoteTooltipEnter(event: Event) {
  if (event instanceof PointerEvent && event.pointerType === 'touch') return
  const target = (event.target as Element).closest(selector)
  if (!target) return
  target.classList.remove('is-tooltip-closing')
  target.classList.add('is-tooltip-open')
}

export function handleNoteTooltipLeave(event: Event) {
  const target = (event.target as Element).closest(selector)
  if (!target || !target.classList.contains('is-tooltip-open')) return
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

import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

/** 阅读器入场共用于 Vue 和 React；正文仅对首屏语义块做入场，不改变 Markdown 节点结构。 */
export function createNoteEntrance(
  reader: HTMLElement,
  options?: { scroll: HTMLElement; viewport: HTMLElement }
) {
  const header = reader.querySelector<HTMLElement>('.note-reader__header')!
  const title = header.querySelector<HTMLElement>('h1')!
  const meta = header.querySelector<HTMLElement>('.note-reader__meta')!
  const category = meta.querySelector<HTMLElement>('.note-reader__category')!
  const date = meta.querySelector<HTMLElement>('time')!
  const body = reader.querySelector<HTMLElement>('.note-markdown')!
  const scroll =
    options?.scroll ??
    reader.closest<HTMLElement>('.modal-scroll-region, .infra-modal-content')!
  const frame = options?.viewport ?? scroll
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let disposed = false
  let settled = false
  let resize: ResizeObserver | undefined
  let fontTimer: ReturnType<typeof setTimeout> | undefined
  const pending = new Set<HTMLElement>()
  const context = gsap.context(() => {}, reader)

  const finish = () => {
    resize?.disconnect()
    context.revert()
    for (const block of pending) delete block.dataset.noteReveal
    pending.clear()
    if (fontTimer) clearTimeout(fontTimer)
    reader.dataset.noteEnter = 'ready'
    settled = true
  }
  const interrupt = () => {
    if (!['body', 'ready'].includes(reader.dataset.noteEnter || '')) finish()
  }
  const interruptKey = (event: KeyboardEvent) => {
    if (
      [
        'ArrowDown',
        'ArrowUp',
        'PageDown',
        'PageUp',
        'Home',
        'End',
        ' ',
      ].includes(event.key)
    )
      interrupt()
  }
  const reduce = () => {
    if (motion.matches) finish()
  }
  reader.dataset.noteEnter = 'pending'

  const start = async () => {
    if (!scroll || motion.matches) {
      finish()
      return
    }
    scroll.addEventListener('wheel', interrupt, { passive: true })
    scroll.addEventListener('touchstart', interrupt, { passive: true })
    scroll.addEventListener('keydown', interruptKey)
    motion.addEventListener('change', reduce)
    const fonts = Promise.allSettled([
      document.fonts.load('900 78px AnutriumNoteSans', title.textContent || ''),
      document.fonts.load(
        '600 20px AnutriumNoteSans',
        body.textContent?.slice(0, 80) || ''
      ),
    ])
    // 保留 ModalWrapper 的电视机入场，等它结束后再测量标题位置。
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (disposed || settled) return
    const dialog = reader.closest('.modal-wrapper-dialog, .infra-modal')
    const opening =
      dialog
        ?.getAnimations()
        .map((animation) => animation.finished.catch(() => {})) || []
    await Promise.race([
      Promise.all([fonts, ...opening]),
      new Promise<void>((resolve) => {
        fontTimer = setTimeout(resolve, 1800)
      }),
    ])
    if (fontTimer) clearTimeout(fontTimer)
    if (disposed || settled || !reader.isConnected) return
    if (!frame.clientWidth || !frame.clientHeight) {
      finish()
      return
    }
    // 开窗后再记录尺寸，避免隐藏容器从 0 恢复时被误判为用户缩放而取消动画。
    const size = { width: frame.clientWidth, height: frame.clientHeight }
    resize = new ResizeObserver(() => {
      // 标题位移基于当前版心；尺寸改变时立即恢复自然排版。
      if (
        Math.abs(frame.clientWidth - size.width) > 1 ||
        Math.abs(frame.clientHeight - size.height) > 1
      )
        finish()
    })
    resize.observe(frame)
    gsap.registerPlugin(CustomEase)
    const titleEase = CustomEase.create(
      'note-title-reveal',
      'M0,0 C0.496,0.004 0,1 1,1'
    )

    const revealBody = () => {
      const viewport = scroll.getBoundingClientRect()
      const blocks: HTMLElement[] = []
      // 直接使用顶层语义块，引用、列表、表格、代码和公式均保持完整。
      // 文档按自然流排列，遇到首屏下方的块即可停止测量，长文不会逐段拆分或等待。
      for (const node of Array.from(body.children)) {
        if (!(node instanceof HTMLElement)) continue
        const bounds = node.getBoundingClientRect()
        if (bounds.top >= viewport.bottom) break
        if (bounds.bottom > viewport.top && bounds.width && bounds.height)
          blocks.push(node)
      }
      if (!blocks.length) {
        reader.dataset.noteEnter = 'ready'
        return
      }
      context.add(() => {
        blocks.forEach((block) => {
          block.dataset.noteReveal = 'active'
          pending.add(block)
        })
        gsap.set(blocks, { opacity: 0, y: 8 })
        reader.dataset.noteEnter = 'ready'
        gsap.to(blocks, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power2.out',
          stagger: { amount: Math.min(0.4, (blocks.length - 1) * 0.08) },
          onComplete: () => {
            gsap.set(blocks, { clearProps: 'opacity,transform' })
            blocks.forEach((block) => {
              delete block.dataset.noteReveal
              pending.delete(block)
            })
          },
        })
      })
    }

    const bounds = header.getBoundingClientRect()
    const viewport = frame.getBoundingClientRect()
    // 长标题优先完整容纳在视口内；常规标题以 2.2 倍从中央缩回原始排版。
    const titleRange = document.createRange()
    titleRange.selectNodeContents(title)
    const metaBounds = Array.from(meta.children).map((child) =>
      child.getBoundingClientRect()
    )
    const textWidth = Math.max(
      titleRange.getBoundingClientRect().width,
      Math.max(...metaBounds.map((rect) => rect.right)) -
        Math.min(...metaBounds.map((rect) => rect.left))
    )
    const scale = Math.min(
      2.2,
      (frame.clientWidth - 32) / Math.max(1, textWidth),
      (frame.clientHeight - 32) / bounds.height
    )
    const titleBounds = title.getBoundingClientRect()
    const metadataBounds = meta.getBoundingClientRect()
    const contentCenter =
      (Math.min(titleBounds.top, metadataBounds.top) +
        Math.max(titleBounds.bottom, metadataBounds.bottom)) /
      2
    const headerCenter = bounds.top + bounds.height / 2
    // 以标题和元信息的实际可见范围居中，兼容固定标题区的对称内边距。
    const y =
      viewport.top +
      frame.clientHeight / 2 -
      headerCenter -
      (contentCenter - headerCenter) * scale
    // 对应参考页 4% 高度的 smoothstep 柔边；通过遮罩保留原始可选中文字。
    const mask = `linear-gradient(to top, ${Array.from(
      { length: 17 },
      (_, index) => {
        const t = index / 16
        const alpha = 1 - t * t * (3 - 2 * t)
        return `rgba(0,0,0,${alpha}) calc(var(--note-title-reveal) - ${
          (1 - t) * 4
        }%)`
      }
    ).join(',')})`
    context.add(() => {
      gsap.set(header, { y, scale, transformOrigin: '50% 50%' })
      gsap.set(title, {
        maskImage: mask,
        webkitMaskImage: mask,
        '--note-title-reveal': '0%',
      })
      gsap.set([category, date], { opacity: 0 })
      reader.dataset.noteEnter = 'title'
      gsap
        .timeline()
        .to(
          title,
          {
            '--note-title-reveal': '104%',
            duration: 1.8,
            ease: titleEase,
          },
          0
        )
        .set(title, {
          clearProps: 'maskImage,webkitMaskImage,--note-title-reveal',
        })
        // 在擦入可见阶段同步闪烁两次，不等待遮罩擦入结束。
        .set(title, { opacity: 1 }, 0.42)
        .set(title, { opacity: 0 }, 0.48)
        .set(title, { opacity: 1 }, 0.54)
        .set(title, { opacity: 0 }, 0.6)
        .set(title, { clearProps: 'opacity' }, 0.66)
        // 擦入的缓动尾段已几乎没有视觉变化，让元信息在收尾时衔接出现。
        .addLabel('meta', 1.08)
        .call(
          () => {
            reader.dataset.noteEnter = 'meta'
          },
          [],
          'meta'
        )
        // 标签先闪烁两次，再播放日期；全部显示后开始计算居中停顿。
        .set(category, { opacity: 1 }, 'meta')
        .set(category, { opacity: 0 }, 'meta+=0.07')
        .set(category, { opacity: 1 }, 'meta+=0.14')
        .set(category, { opacity: 0 }, 'meta+=0.21')
        .set(category, { clearProps: 'opacity' }, 'meta+=0.28')
        .set(date, { opacity: 1 }, 'meta+=0.28')
        .set(date, { opacity: 0 }, 'meta+=0.35')
        .set(date, { opacity: 1 }, 'meta+=0.42')
        .set(date, { opacity: 0 }, 'meta+=0.49')
        .set(date, { clearProps: 'opacity' }, 'meta+=0.56')
        .addLabel('hold', 'meta+=0.56')
        .call(
          () => {
            reader.dataset.noteEnter = 'hold'
          },
          [],
          'hold'
        )
        .addLabel('moving', 'hold+=0.4')
        .call(
          () => {
            reader.dataset.noteEnter = 'moving'
          },
          [],
          'moving'
        )
        .to(
          header,
          { y: 0, scale: 1, duration: 1.6, ease: 'power3.inOut' },
          'moving'
        )
        .set(header, { clearProps: 'transform,transformOrigin' })
        .call(revealBody)
    })
  }
  void start().catch(() => {
    if (!disposed) finish()
  })
  return {
    destroy() {
      disposed = true
      finish()
      scroll?.removeEventListener('wheel', interrupt)
      scroll?.removeEventListener('touchstart', interrupt)
      scroll?.removeEventListener('keydown', interruptKey)
      motion.removeEventListener('change', reduce)
      delete reader.dataset.noteEnter
    },
  }
}

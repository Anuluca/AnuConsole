import { gsap } from 'gsap'

const HOVER_MEDIA =
  '(min-width: 769px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
const FULL_CLIP = 'inset(0%)'
const CLOSED_CLIP = 'inset(50%)'
/** 按参考站 Fx5 的双背景图层和时间线实现 Cinco。 */
export function createImageCincoHover({
  glowStrength = 1,
}: { glowStrength?: number } = {}) {
  const glowFilter = `brightness(${100 + 300 * glowStrength}%) saturate(${
    100 + 100 * glowStrength
  }%)`
  let mediaQuery: MediaQueryList | undefined
  let active: {
    button: HTMLElement
    surface: HTMLDivElement
    bottom: HTMLDivElement
    top: HTMLDivElement
    width: number
    height: number
  } | null = null
  let timeline: gsap.core.Timeline | undefined
  let resizeObserver: ResizeObserver | undefined

  const stop = () => {
    timeline?.kill()
    timeline = undefined
    resizeObserver?.disconnect()
    active?.surface.remove()
    active = null
  }

  const enter = () => {
    if (!active) return
    const { bottom, top } = active
    timeline?.kill()
    // 四边按相同比例向中心收拢，裁切矩形始终保持图片自身的宽高比。
    timeline = gsap
      .timeline({ defaults: { duration: 0.5, ease: 'power2' } })
      .set(bottom, { willChange: 'filter' })
      .set(top, { willChange: 'clip-path' })
      .fromTo(top, { clipPath: FULL_CLIP }, { clipPath: CLOSED_CLIP }, 0)
      .fromTo(
        bottom,
        {
          scale: 1.5,
          filter: glowFilter,
        },
        {
          scale: 1,
          filter: 'brightness(100%) saturate(100%)',
        },
        0
      )
  }

  const leave = () => {
    if (!active) return
    const { bottom, top } = active
    timeline?.kill()
    timeline = gsap
      .timeline({
        defaults: { duration: 0.5, ease: 'power2.inOut' },
        onComplete: stop,
      })
      .set(bottom, { willChange: 'filter' })
      .set(top, { willChange: 'clip-path' })
      .to(top, { clipPath: FULL_CLIP }, 0)
      .to(
        bottom,
        {
          scale: 1.5,
          filter: glowFilter,
        },
        0
      )
  }

  const start = (event: PointerEvent, target?: HTMLElement) => {
    if (!mediaQuery?.matches || event.pointerType === 'touch') return
    const button = target || event.currentTarget
    if (!(button instanceof HTMLElement)) return
    const image = button.querySelector('img')
    if (
      !image?.complete ||
      !image.naturalWidth ||
      button.closest('.is-loading')
    )
      return
    if (active?.button === button) {
      enter()
      return
    }
    stop()
    const width = button.clientWidth
    const height = button.clientHeight
    const fit = Math.min(
      width / image.naturalWidth,
      height / image.naturalHeight
    )
    const imageWidth = image.naturalWidth * fit
    const imageHeight = image.naturalHeight * fit
    if (!imageWidth || !imageHeight) return

    const surface = document.createElement('div')
    surface.className = 'media-gallery__cinco-surface'
    surface.setAttribute('aria-hidden', 'true')
    Object.assign(surface.style, {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      left: `${(width - imageWidth) / 2}px`,
      top: `${(height - imageHeight) / 2}px`,
    })
    const createLayer = () => {
      const layer = document.createElement('div')
      layer.className = 'media-gallery__cinco-layer'
      // 直接复用当前响应式线上缩略图；与参考站相同，使用居中 cover 背景。
      layer.style.backgroundImage = `url(${JSON.stringify(
        image.currentSrc || image.src
      )})`
      surface.append(layer)
      return layer
    }
    active = {
      button,
      surface,
      bottom: createLayer(),
      top: createLayer(),
      width,
      height,
    }
    button.append(surface)
    enter()
    resizeObserver ??= new ResizeObserver(() => {
      if (
        active &&
        (active.button.clientWidth !== active.width ||
          active.button.clientHeight !== active.height)
      )
        stop()
    })
    resizeObserver.observe(button)
  }

  const onVisibilityChange = () => {
    if (document.hidden) stop()
  }
  const mount = () => {
    mediaQuery = window.matchMedia(HOVER_MEDIA)
    mediaQuery.addEventListener('change', stop)
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
  const destroy = () => {
    stop()
    mediaQuery?.removeEventListener('change', stop)
    window.removeEventListener('blur', stop)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
  return { start, leave, stop, mount, destroy }
}

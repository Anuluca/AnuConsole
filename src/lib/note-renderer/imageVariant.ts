const R2_ASSET_ORIGIN = 'https://assets.anuluca.com'

export type ImageVariant = 'home-thumb' | 'card-thumb' | 'card-mobile'

/**
 * 标记由 Cloudflare Images 转换流处理的 R2 缩略图。
 * 原图继续保留在 R2；非本站资源保持原样，避免影响外部图片。
 */
const getImageVariantUrl = (source: string, variant: ImageVariant) => {
  try {
    const url = new URL(source)
    if (url.origin !== R2_ASSET_ORIGIN) return source

    url.searchParams.set('image', variant)
    return url.toString()
  } catch {
    return source
  }
}

export const getHomeThumbnailUrl = (source: string) =>
  getImageVariantUrl(source, 'home-thumb')

export const getCardThumbnailUrl = (source: string) =>
  getImageVariantUrl(source, 'card-thumb')

export const getCardMobileThumbnailUrl = (source: string) =>
  getImageVariantUrl(source, 'card-mobile')

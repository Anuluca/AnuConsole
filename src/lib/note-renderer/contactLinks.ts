type ContactType =
  | 'TWITTER'
  | 'WEIBO'
  | 'BILIBILI'
  | 'GITHUB'
  | 'WECHAT'
  | 'MAIL'

interface ContactLink {
  type: ContactType
  label: string
  href?: string
}

export const FOOTER_SOCIAL_ORDER = [
  'TWITTER',
  'WEIBO',
  'BILIBILI',
  'GITHUB',
  'WECHAT',
  'MAIL',
] as const

export type FooterSocialType = (typeof FOOTER_SOCIAL_ORDER)[number]

export const WECHAT_ID = 'anugamine'

export const WEIBO_WIDGET_URL =
  'https://widget.weibo.com/weiboshow/index.php?language=&width=0&height=520&fansRow=1&ptype=1&speed=0&skin=10&isTitle=1&noborder=1&isWeibo=1&isFans=1&uid=8248788427&verifier=4357a699&dpc=1'

export const NINTENDO_FRIEND_URL =
  'https://lounge.nintendo.com/friendcode/8028-6615-7213/DKT8GWxQWQ'

export const NINTENDO_FRIEND_CODE = 'SW-8028-6615-7213'

export const NINTENDO_PROFILE_IMAGE_URL =
  'https://assets.anuluca.com/other/IMG_5544(20260810-095343).png'

const contactLinks: ContactLink[] = [
  {
    type: 'GITHUB',
    label: 'GITHUB',
    href: 'https://github.com/Anuluca',
  },
  {
    type: 'WEIBO',
    label: 'WEIBO',
    href: 'https://weibo.com/u/8248788427',
  },
  {
    type: 'TWITTER',
    label: 'TWITTER',
    href: 'https://twitter.com/TILucario',
  },
  {
    type: 'BILIBILI',
    label: 'BILIBILI',
    href: 'https://space.bilibili.com/128735968',
  },
  {
    type: 'WECHAT',
    label: 'WECHAT',
  },
  {
    type: 'MAIL',
    label: 'MAIL',
    href: 'mailto:tilucario@outlook.com',
  },
]

export default contactLinks

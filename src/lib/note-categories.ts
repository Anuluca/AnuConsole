// 标签入口：新增条目后，前台文案、后台选项与文件校验自动使用同一份定义。
export const NOTE_CATEGORIES = {
  technology: { label: { zhCn: '技术', en: 'TECHNOLOGY' } },
  pokemon: { label: { zhCn: '宝可梦', en: 'POKÉMON' } },
  daily: { label: { zhCn: '日常', en: 'DAILY' } },
  test: { label: { zhCn: '测试', en: 'TEST' }, excludeFromAll: true },
} as const

export type NoteCategory = keyof typeof NOTE_CATEGORIES
export const DEFAULT_NOTE_CATEGORY: NoteCategory = 'technology'
export const NOTE_CATEGORY_OPTIONS = Object.entries(NOTE_CATEGORIES).map(
  ([value, category]) => ({
    value: value as NoteCategory,
    label: category.label.zhCn,
  })
)
export const isNoteCategory = (value: unknown): value is NoteCategory =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(NOTE_CATEGORIES, value)

export const isNoteCategoryIncludedInAll = (category: NoteCategory) => {
  const config = NOTE_CATEGORIES[category]
  return !('excludeFromAll' in config && config.excludeFromAll)
}

declare module 'markdown-it-*' {
  import type { PluginWithOptions } from 'markdown-it'

  const plugin: PluginWithOptions<Record<string, unknown>>
  export default plugin
  export const full: typeof plugin
}

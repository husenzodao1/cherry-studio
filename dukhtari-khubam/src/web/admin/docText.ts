import { fromRich, toRich } from './ui'

/**
 * Plain-text editing for document pages (about, privacy, terms). One block per paragraph:
 *   # Heading          ## Smaller heading
 *   - bullet item      1. numbered item
 *   > quote            ---  (a dividing line)
 * Any other lines form a paragraph; an empty line ends it. **bold** and *italic* work inside text.
 */
export interface DocBlock { type: string; props: Record<string, unknown>; content: Record<string, unknown> }

export function textToBlocks(text: string): DocBlock[] {
  const blocks: DocBlock[] = []
  let para: string[] = []
  let list: { type: 'bullet_list' | 'ordered_list'; items: string[] } | null = null
  const flush = () => {
    if (para.length) blocks.push({ type: 'paragraph', props: {}, content: toRich(para.join(' ')) })
    if (list) blocks.push({ type: list.type, props: {}, content: { items: list.items.map(toRich) } })
    para = []
    list = null
  }
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    let m: RegExpMatchArray | null
    if (!line) flush()
    else if ((m = line.match(/^(#{1,2})\s+(.+)$/))) {
      flush()
      blocks.push({ type: 'heading', props: { level: m[1].length === 1 ? 2 : 3 }, content: toRich(m[2]) })
    } else if (/^-{3,}$/.test(line)) {
      flush()
      blocks.push({ type: 'divider', props: {}, content: {} })
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flush()
      blocks.push({ type: 'quote', props: { style: 'elegant' }, content: { text: toRich(m[1]) } })
    } else if ((m = line.match(/^(?:[-•*]\s+|(\d+)[.)]\s+)(.+)$/))) {
      const type = m[1] ? 'ordered_list' : 'bullet_list'
      if (para.length || (list && list.type !== type)) flush()
      list = list ?? { type, items: [] }
      list.items.push(m[2])
    } else {
      if (list) flush()
      para.push(line)
    }
  }
  flush()
  return blocks
}

export function blocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return ''
  return (blocks as DocBlock[]).map((b) => {
    const c = b.content ?? {}
    switch (b.type) {
      case 'heading': return `${b.props?.level === 3 ? '##' : '#'} ${fromRich(c)}`
      case 'divider': return '---'
      case 'quote': return `> ${fromRich(c.text)}`
      case 'bullet_list': return ((c.items as unknown[]) ?? []).map((r) => `- ${fromRich(r)}`).join('\n')
      case 'ordered_list': return ((c.items as unknown[]) ?? []).map((r, i) => `${i + 1}. ${fromRich(r)}`).join('\n')
      default: return fromRich(c)
    }
  }).join('\n\n')
}

import { describe, expect, it } from 'vitest'

import { validateBlocks } from '@/lib/blocks'

const uuid = '0b5c2c1e-6f6a-4d7e-9a3b-2d8f1c4e5a6b'

describe('content block schema v1', () => {
  it('accepts every editor block in any order, image between paragraphs', () => {
    const result = validateBlocks([
      { type: 'heading', props: { level: 1 }, content: { tg: { spans: [{ text: 'Сарлавҳа' }] } } },
      { type: 'paragraph', content: { tg: { spans: [{ text: 'Матн', marks: ['bold'], color: 'plum' }] }, ru: null } },
      { type: 'image', props: { asset_id: uuid }, content: { tg: { caption: 'Тавзеҳ' } } },
      { type: 'callout', props: { variant: 'important', accent: 'champagne' }, content: { tg: { title: 'Муҳим', body: { spans: [] } } } },
      { type: 'video', props: { asset_id: uuid } },
      { type: 'quiz', props: { quiz_id: uuid } },
      { type: 'divider' }
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.blocks[2].props).toEqual({ asset_id: uuid, layout: 'inline', size: 'l' })
      expect(result.blocks[1].content.ru).toBeNull()
    }
  })

  it('rejects HTML-style payloads, script links and unknown styling', () => {
    const result = validateBlocks([
      { type: 'paragraph', content: { tg: { html: '<script>alert(1)</script>' } } },
      { type: 'paragraph', content: { tg: { spans: [{ text: 'x', href: 'javascript:alert(1)' }] } } },
      { type: 'paragraph', content: { tg: { spans: [{ text: 'x', color: '#ff0000' }] } } },
      { type: 'paragraph', content: { tg: { spans: [{ text: 'x', href: '//evil.example' }] } } },
      { type: 'image', props: { asset_id: 'not-a-uuid' } },
      { type: 'marquee' }
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(new Set(result.issues.map((i) => i.index))).toEqual(new Set([0, 1, 2, 3, 4, 5]))
  })

  it('strips control characters and requires a source for attributed quotes', () => {
    const ok = validateBlocks([{ type: 'paragraph', content: { tg: { spans: [{ text: 'a\u0000b\u0007c' }] } } }])
    expect(ok.ok && (ok.blocks[0].content.tg as any).spans[0].text).toBe('abc')
    const quote = validateBlocks([{ type: 'quote', content: { tg: { text: { spans: [{ text: 'q' }] }, author: 'Шахс' } } }])
    expect(quote.ok).toBe(false)
  })

  it('does not accept text content on blocks that have none', () => {
    const result = validateBlocks([{ type: 'divider', content: { tg: { spans: [] } } }])
    expect(result.ok).toBe(false)
  })
})

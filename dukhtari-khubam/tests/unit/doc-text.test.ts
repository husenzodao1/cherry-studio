import { describe, expect, it } from 'vitest'

import { blocksToText, textToBlocks } from '@/web/admin/docText'

describe('document text for pages', () => {
  const text = [
    '# Дар бораи барнома',
    'Сархати аввал бо **ғафс**',
    'ва давомаш.',
    '',
    '## Имкониятҳо',
    '- банди якум',
    '- банди дуюм',
    '',
    '1. қадами якум',
    '2. қадами дуюм',
    '',
    '> иқтибос',
    '---',
    'Охир.'
  ].join('\n')

  it('turns plain text into document blocks', () => {
    const blocks = textToBlocks(text)
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'heading', 'bullet_list', 'ordered_list', 'quote', 'divider', 'paragraph'])
    expect(blocks[0].props.level).toBe(2)
    expect(blocks[2].props.level).toBe(3)
    expect(blocks[1].content).toEqual({ spans: [{ text: 'Сархати аввал бо ' }, { text: 'ғафс', marks: ['bold'] }, { text: ' ва давомаш.' }] })
    expect((blocks[3].content.items as unknown[]).length).toBe(2)
  })

  it('reads the blocks back as the same text', () => {
    const again = blocksToText(textToBlocks(text))
    expect(textToBlocks(again)).toEqual(textToBlocks(text))
  })
})

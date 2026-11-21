import { describe, expect, it } from 'vitest'

import { emojiName } from '@/web/components/Emoji'

describe('the chat\'s own emoji (Fluent 3D)', () => {
  it('finds the picture of an emoji: plain, with its variation mark, skin-toned (its base colour), joined, a flag, a keycap', () => {
    expect(emojiName('😀')).toBe('1f600')
    expect(emojiName('❤️')).toBe('2764-fe0f')
    expect(emojiName('❤')).toBe('2764-fe0f')
    expect(emojiName('👍🏽')).toBe('1f44d')
    expect(emojiName('❤️‍🔥')).toBe('2764-fe0f-200d-1f525')
    expect(emojiName('🇹🇯')).toBe('1f1f9-1f1ef')
    expect(emojiName('1️⃣')).toMatch(/^31-fe0f-20e3$|^0031-fe0f-20e3$/)
    expect(emojiName('a')).toBeNull()
  })
})

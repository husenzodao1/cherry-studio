import { describe, expect, it } from 'vitest'

import { emptyProgress, mergeProgress, ProgressData } from '@/lib/progress'
import { learnerNote } from '@/server/mahliyo'
import { DEFAULT_STRINGS } from '@/web/i18n'
import { BOY_STRINGS } from '@/web/locales/boy'
import { girlyChanged, type AiTurn } from '@/web/offline/mahliyo'

describe("boys' mode", () => {
  it('has a boy word only for texts that exist, with the same placeholders', () => {
    const tg = DEFAULT_STRINGS.tg as Record<string, string>
    const holes = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join()
    for (const [locale, words] of Object.entries(BOY_STRINGS)) {
      for (const [key, value] of Object.entries(words)) {
        expect(tg[key], `${locale} ${key}`).toBeTruthy()
        expect(holes(value!), `${locale} ${key}`).toBe(holes(tg[key]))
      }
    }
    expect(BOY_STRINGS.tg['home.seven_schools']).toBe('7 мактаби писар')
  })

  it('no girl-only words in the boys texts of Tajik, Russian and English', () => {
    for (const locale of ['tg', 'ru', 'en'] as const) {
      // (the share text names the app as for boys and girls)
      for (const [key, v] of Object.entries(BOY_STRINGS[locale]).filter(([k]) => k !== 'share.text')) expect(v, key).not.toMatch(/дугона|духтар(?!она)|малика|подруг|девуш|girl(?!s\b)|🌸|💕|🎀|💖|🌷|💐/i)
    }
  })

  it('keeps the gender with the profile, and merges it', () => {
    const boy = ProgressData.parse({ ...emptyProgress(), gender: 'boy' })
    expect(boy.gender).toBe('boy')
    expect(mergeProgress(emptyProgress(), boy).gender).toBe('boy')
    expect(() => ProgressData.parse({ ...emptyProgress(), gender: 'other' })).toThrow()
  })

  it('tells Mahliyo to speak to a boy as a young man (and keeps the girls\' mode warm for him)', () => {
    expect(learnerNote({ gender: 'boy' })).toMatch(/THE LEARNER IS A BOY/)
    expect(learnerNote({ gender: 'boy' })).not.toMatch(/GIRLY/)
    const girly = learnerNote({ gender: 'boy', mode: 'girly' })
    expect(girly).toMatch(/turned on the warm "girly"/)
    expect(learnerNote({})).not.toMatch(/BOY/)
  })

  it('marks where the girls\' mode was turned on and off in a chat', () => {
    const q = (girly?: boolean): AiTurn => ({ role: 'user', content: 'q', at: '', ...(girly ? { girly } : {}) })
    const a: AiTurn = { role: 'assistant', content: 'a', at: '' }
    const turns = [q(), a, q(true), a, q(true), a, q(), a]
    expect(turns.map((_, i) => (turns[i].role === 'user' ? girlyChanged(turns, i) : 'x'))).toEqual([null, 'x', true, 'x', null, 'x', false, 'x'])
    expect(girlyChanged([q(true)], 0)).toBe(true)
  })
})

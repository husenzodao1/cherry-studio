import { describe, expect, it } from 'vitest'

import { BRAVO, INTRO, spokenBy, wordsAt } from '@/lib/intro'

const words = ['Салом, дӯсти азиз!', 'Ман омӯзгори шумо ҳастам.', 'Дар ин ҷо шумо метавонед худро беҳтар ҳис кунед ва чизҳои нав омӯзед!', 'Омодаед оғоз кунем?']
  .map((s) => s.split(' '))

describe('her words come as she says them', () => {
  it('nothing before she speaks; the first word with her first sound; all of it at the end', () => {
    expect(wordsAt(words, 0.5, INTRO)).toEqual({ shown: [0, 0, 0, 0], now: null, speaking: false })
    const first = wordsAt(words, 1.05, INTRO)
    expect(first.shown).toEqual([1, 0, 0, 0])
    expect(first.now).toEqual([0, 0])
    expect(wordsAt(words, spokenBy(INTRO), INTRO).shown).toEqual(words.map((w) => w.length))
    expect(wordsAt(words, 99, INTRO)).toEqual({ shown: words.map((w) => w.length), now: null, speaking: false })
  })

  it('a sentence split by her pause waits in the pause: "…ҳис кунед" before it, "ва чизҳои нав омӯзед!" after', () => {
    const pause = wordsAt(words, 6.9, INTRO)
    expect(words[2].slice(0, pause.shown[2]).join(' ')).toBe('Дар ин ҷо шумо метавонед худро беҳтар ҳис кунед')
    expect(pause.speaking).toBe(false)
    expect(wordsAt(words, 7.15, INTRO).shown[2]).toBe(pause.shown[2] + 1)
  })

  it('only grows with time, and "now" is always a shown word', () => {
    let last = 0
    for (let t = 0; t <= 10.5; t += 0.02) {
      const said = wordsAt(words, t, INTRO)
      const n = said.shown.reduce((a, b) => a + b, 0)
      expect(n).toBeGreaterThanOrEqual(last)
      last = n
      if (said.now) expect(said.now[1]).toBeLessThan(said.shown[said.now[0]])
    }
  })

  it('after "Бале" she has said all three by five seconds', () => {
    const bravo = ['Офарин!', 'Пас, рафтем!', 'Шуморо чизҳои нав интизоранд!'].map((s) => s.split(' '))
    expect(spokenBy(BRAVO)).toBeLessThanOrEqual(5.5)
    expect(wordsAt(bravo, 1.0, BRAVO).shown).toEqual([0, 0, 0])
    expect(wordsAt(bravo, 5.3, BRAVO).shown).toEqual([1, 2, 4])
  })
})

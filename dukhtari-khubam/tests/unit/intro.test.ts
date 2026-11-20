import { describe, expect, it } from 'vitest'

import { SPEECH, SPOKEN_BY, typedAt } from '@/lib/intro'

describe('the introduction is written as she speaks', () => {
  const lengths = [14, 27, 80, 19]

  it('nothing before she speaks, each sentence inside its own stretch, all of it at the end', () => {
    expect(typedAt(lengths, 0)).toEqual([0, 0, 0, 0])
    expect(typedAt(lengths, (SPEECH[0][0] + SPEECH[0][1]) / 2)).toEqual([7, 0, 0, 0])
    expect(typedAt(lengths, SPEECH[1][1])).toEqual([14, 27, 0, 0])
    expect(typedAt(lengths, SPOKEN_BY)).toEqual(lengths)
    expect(typedAt(lengths, 30)).toEqual(lengths)
  })

  it('only grows with time', () => {
    let last = 0
    for (let t = 0; t <= 10; t += 0.05) {
      const n = typedAt(lengths, t).reduce((a, b) => a + b, 0)
      expect(n).toBeGreaterThanOrEqual(last)
      last = n
    }
  })
})

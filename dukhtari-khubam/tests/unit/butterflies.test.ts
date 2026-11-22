import { describe, expect, it } from 'vitest'

import { planFor } from '@/web/components/Butterfly'

describe('butterflies per page', () => {
  it('home: a lilac one on the motto and a pink one flying in', () => {
    const plan = planFor('/')
    expect(plan.map((p) => [p.species, p.role, p.start])).toEqual([
      ['lilac', 'stay', { at: '.bf-anchor' }],
      ['rose', 'stay', 'arrive']
    ])
  })

  it('lists: three different colours on the boxes, taking off in turn; the last one stays', () => {
    for (const path of ['/schools', '/school', '/course/', '/garden', '/profile', '/saved']) {
      const plan = planFor(path)
      expect(plan).toHaveLength(3)
      expect(new Set(plan.map((p) => p.species)).size).toBe(3)
      expect(plan.every((p) => p.start === 'box')).toBe(true)
      expect(plan.map((p) => p.role)).toEqual(['flee', 'flee', 'stay'])
      expect(plan[0].delay).toBeLessThan(plan[1].delay)
      expect(plan[1].delay).toBeLessThan(plan[2].delay)
    }
  })

  it('reading, quizzes, review, forms and the panel stay calm', () => {
    for (const path of ['/lesson', '/quiz', '/review', '/start', '/support', '/admin', '/settings', '/search']) {
      expect(planFor(path)).toEqual([])
    }
  })
})

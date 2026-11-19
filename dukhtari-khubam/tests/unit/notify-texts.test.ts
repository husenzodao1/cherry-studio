import { describe, expect, it } from 'vitest'

import { emptyProgress, mergeProgress, ProgressData } from '@/lib/progress'
import { lines, variant } from '@/web/offline/notify'

describe('notification texts from the panel', () => {
  const vars = { name: 'Малика', lesson: 'Одоби сухан', streak: 5 }
  it('takes one variant per line and fills its placeholders', () => {
    const list = lines(' Мо шуморо интизорем, {name} 💜 \n\n«{lesson}» нимтамом мондааст\n{streak} рӯз пай дар пай ')
    expect(list).toHaveLength(3)
    expect(variant(list, 0, vars)).toBe('Мо шуморо интизорем, Малика 💜')
    expect(variant(list, 1, vars)).toBe('«Одоби сухан» нимтамом мондааст')
    expect(variant(list, 5, vars)).toBe('5 рӯз пай дар пай')
    expect(variant(list, -1, vars)).toBe('5 рӯз пай дар пай')
  })
  it('tidies a line whose name is empty', () => {
    expect(variant(['Мо шуморо интизорем, {name}!'], 0, { ...vars, name: '' })).toBe('Мо шуморо интизорем!')
  })
})

describe('welcome answers in the progress backup', () => {
  it('are kept, validated and merged by their time', () => {
    const a = { ...emptyProgress(), about: { time: '1 соат', at: '2026-11-21T10:00:00Z' } }
    const b = { ...emptyProgress(), about: { time: '2 соат', schools: ['odob-va-akhloq'], at: '2026-11-21T11:00:00Z' } }
    expect(mergeProgress(a, b).about?.time).toBe('2 соат')
    expect(mergeProgress(b, a)).toEqual(mergeProgress(a, b))
    expect(ProgressData.safeParse({ ...b, about: { ...b.about, extra: 1 } }).success).toBe(false)
  })
})

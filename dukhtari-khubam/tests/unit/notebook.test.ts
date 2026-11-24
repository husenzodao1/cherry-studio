import { describe, expect, it } from 'vitest'

import { checkedFrom, rules } from '@/server/notebook'

describe('the red pen', () => {
  it('marks made safe to draw: boxes inside the photo and in order, empty ones dropped, the grade 2–5 only', () => {
    const c = checkedFrom({
      subject: 'Математика', grade: 7, summary: 'Хуб', next: ['Касрҳо', 'Тартиби амалҳо', 'Ҷадвали зарб', 'X'],
      marks: [
        { box: [600, 100, 640, 400], kind: 'error', text: '14', why: 'Аввал зарб' },
        { box: [1200, -5, 100, 50], kind: 'ok', text: '' },
        { box: [10, 10, 11, 11], kind: 'error', text: 'x' },
        { box: [1, 2, 3], kind: 'error', text: 'x' },
        { box: [100, 50, 150, 300], kind: 'strange', text: 'y' }
      ]
    })
    expect(c.grade).toBeNull()
    expect(c.next).toHaveLength(3)
    expect(c.marks.map((m) => [m.kind, m.box])).toEqual([
      ['ok', [100, 0, 1000, 50]], ['error', [100, 50, 150, 300]], ['error', [600, 100, 640, 400]]
    ])
    expect(checkedFrom({ grade: 4, marks: 'no' }).grade).toBe(4)
    expect(checkedFrom(null)).toEqual({ subject: '', grade: null, summary: '', marks: [], next: [] })
  })

  it('the teacher\'s rules: her language, her task, never the whole answer', () => {
    const r = rules('ru', 'Реши уравнение 3x + 7 = 22', 'Алгебра')
    expect(r).toContain('Write every text in Russian')
    expect(r).toContain('Реши уравнение 3x + 7 = 22')
    expect(r).toContain('The subject: Алгебра')
    expect(r).toContain('Never write the right answer of a whole unsolved task')
    expect(rules('xx')).toContain('in Tajik')
  })
})

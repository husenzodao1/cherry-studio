import { describe, expect, it } from 'vitest'

import type { Grading, OfflineQuestion } from '@/web/offline/content'
import { gradeQuiz, normalize } from '@/web/offline/grade'

const q = (id: string, type: string, points = 1): OfflineQuestion => ({ id, type, points, prompt: id, options: [] })
const g = (key: Grading['key'], extra: Partial<Grading> = {}): Grading =>
  ({ partial_credit: false, penalty: 0, case_sensitive: false, ignore_punctuation: true, key, ...extra })

describe('on-phone quiz grading', () => {
  const questions = [q('s', 'single_choice', 2), q('m', 'multiple_choice', 3), q('t', 'short_answer'), q('o', 'ordering'), q('x', 'matching')]
  const grading = {
    s: g({ correct_option_ids: ['b'] }),
    m: g({ correct_option_ids: ['a', 'c', 'd'] }, { partial_credit: true }),
    t: g({ accepted_answers: { tg: ['Душанбе'] } }),
    o: g({ correct_order: ['1', '2', '3'] }),
    x: g({ matching: { l1: 'r1', l2: 'r2' } })
  }

  it('scores like the server: exact, partial credit, normalised text, order and pairs', () => {
    const r = gradeQuiz(questions, grading, {
      s: { option_id: 'b' },
      m: { option_ids: ['a', 'c', 'x'] },
      t: { text: '  душанбе! ' },
      o: { order: ['1', '2', '3'] },
      x: { pairs: { l1: 'r1', l2: 'r1' } }
    }, 'tg')
    expect(r.results.s.status).toBe('correct')
    expect(r.results.m).toEqual({ status: 'partial', points: 1, max_points: 3 })
    expect(r.results.t.status).toBe('correct')
    expect(r.results.o.status).toBe('correct')
    expect(r.results.x.status).toBe('incorrect')
    expect(r.score).toBe(5)
    expect(r.max_score).toBe(8)
  })

  it('marks missing answers as unanswered and never goes below zero', () => {
    const r = gradeQuiz([q('s', 'single_choice')], { s: g({ correct_option_ids: ['b'] }, { penalty: 5 }) }, { s: { option_id: 'a' } }, 'tg')
    expect(r.results.s.points).toBe(-5)
    expect(r.score).toBe(0)
    expect(gradeQuiz([q('s', 'single_choice')], {}, {}, 'tg').results.s.status).toBe('unanswered')
  })

  it('normalises answers the way the database does', () => {
    expect(normalize('  Салом,  ДУНЁ! ', false, true)).toBe('салом дунё')
    expect(normalize('A.B', true, false)).toBe('A.B')
  })
})

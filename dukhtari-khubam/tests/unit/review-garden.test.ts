import { describe, expect, it } from 'vitest'

import { emptyProgress, mergeProgress, type ProgressData } from '@/lib/progress'
import type { Bundle } from '@/web/offline/content'
import { gardenOf } from '@/web/offline/garden'
import { addDays, dueToday, NEW_PER_DAY, reviewStats, schedule } from '@/web/offline/review'

const q = (id: string, type = 'single_choice') => ({ id, type, points: 1, prompt: id, options: [{ id: `${id}a` }, { id: `${id}b` }] })
const grade = (id: string) => ({ partial_credit: false, penalty: 0, case_sensitive: false, ignore_punctuation: true, key: { correct_option_ids: [`${id}a`] } })
const bundle = {
  schools: [], schoolDetails: { 'marifati-dini': { slug: 'marifati-dini', courses: [{ id: 'c1' }] } },
  courses: {
    c1: { id: 'c1', title: 'Курс', school: { id: 's', slug: 'marifati-dini', title: 'М' }, quizzes: [],
      modules: [{ id: 'm', quizzes: [], topics: [{ id: 't', quizzes: [{ id: 'z2' }], lessons: [{ id: 'l1', locked: false }, { id: 'l2', locked: false }] }] }] }
  },
  lessons: { l1: { id: 'l1', title: 'Дарс 1', context: { course: { id: 'c1' } } }, l2: { id: 'l2', title: 'Дарс 2', context: { course: { id: 'c1' } } } },
  quizzes: {
    z1: { quiz: { id: 'z1' }, questions: [q('a1'), q('a2'), q('a3', 'short_answer'), q('a4'), q('a5')], grading: { a1: grade('a1'), a2: grade('a2'), a3: grade('a3'), a4: grade('a4'), a5: grade('a5') } },
    z2: { quiz: { id: 'z2' }, questions: [q('b1')], grading: { b1: grade('b1') } }
  }
} as unknown as Bundle

describe('spaced repetition', () => {
  it('moves up a box on a right answer and back to box 1 on a wrong one', () => {
    expect(schedule(undefined, true, '2026-11-18')).toEqual({ box: 1, due: '2026-11-19' })
    expect(schedule(1, true, '2026-11-18')).toEqual({ box: 2, due: '2026-11-20' })
    expect(schedule(4, true, '2026-11-18')).toEqual({ box: 5, due: '2026-12-04' })
    expect(schedule(5, true, '2026-11-18')).toEqual({ box: 5, due: '2026-12-04' })
    expect(schedule(4, false, '2026-11-18')).toEqual({ box: 1, due: '2026-11-19' })
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('reviews choice questions from taken quizzes and quizzes beside finished lessons', () => {
    const p: ProgressData = { ...emptyProgress(), quizzes: { z1: { best: 50, passed: false, tries: 1, at: '2026-11-17T10:00:00Z' } } }
    expect(reviewStats(bundle, p, '2026-11-18').total).toBe(4) // the short answer is left out
    const withLesson = { ...p, lessons: { l1: { p: 100, done: '2026-11-17T10:00:00Z', at: '2026-11-17T10:00:00Z' } } }
    expect(reviewStats(bundle, withLesson, '2026-11-18').total).toBe(5)
  })

  it('offers due questions first and only a few new ones a day', () => {
    const p: ProgressData = {
      ...emptyProgress(),
      quizzes: { z1: { best: 50, passed: false, tries: 1, at: '2026-11-17T10:00:00Z' } },
      review: {
        a4: { box: 2, due: '2026-11-18', at: '2026-11-16T10:00:00Z' },
        a5: { box: 3, due: '2026-11-25', at: '2026-11-16T10:00:00Z' }
      }
    }
    const today = dueToday(bundle, p, '2026-11-18').map((it) => it.question.id)
    expect(today[0]).toBe('a4')
    expect(today).not.toContain('a5')
    expect(today.length).toBe(1 + Math.min(NEW_PER_DAY, 2))
  })

  it('keeps the latest answer when two phones merge', () => {
    const a = { ...emptyProgress(), review: { a1: { box: 3, due: '2026-11-22', at: '2026-11-18T10:00:00Z' } } }
    const b = { ...emptyProgress(), review: { a1: { box: 1, due: '2026-11-19', at: '2026-11-18T12:00:00Z' } } }
    expect(mergeProgress(a, b).review.a1.box).toBe(1)
  })
})

describe('garden', () => {
  it('grows a flower per finished lesson and a large bloom per finished course', () => {
    const one = { ...emptyProgress(), lessons: { l1: { p: 100, done: '2026-11-17T10:00:00Z', at: '2026-11-17T10:00:00Z' } } }
    expect(gardenOf(bundle, one)).toMatchObject({ flowers: 1, courses: 0, bySchool: { 'marifati-dini': 1 } })
    const both = { ...one, lessons: { ...one.lessons, l2: { p: 100, done: '2026-11-18T10:00:00Z', at: '2026-11-18T10:00:00Z' } } }
    const g = gardenOf(bundle, both)
    expect(g).toMatchObject({ flowers: 2, courses: 1 })
    expect(g.blooms.map((b) => b.id)).toEqual(['l1', 'course:c1', 'l2'])
    // stable: the same progress gives the same garden
    expect(gardenOf(bundle, both).blooms).toEqual(g.blooms)
  })
})

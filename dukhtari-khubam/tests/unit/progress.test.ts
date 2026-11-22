import { randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { emptyProgress, formatCode, formatDay, isCode, mergeProgress, newCode, ProgressData, streak, withDay } from '@/lib/progress'

describe('progress merge', () => {
  const a: ProgressData = {
    ...emptyProgress(),
    lessons: { l1: { p: 40, at: '2026-11-01T10:00:00Z' }, l2: { p: 100, done: '2026-11-02T10:00:00Z', at: '2026-11-02T10:00:00Z' } },
    quizzes: { q1: { best: 50, passed: false, tries: 1, at: '2026-11-01T10:00:00Z' } },
    bookmarks: { l1: { on: true, at: '2026-11-01T10:00:00Z' } },
    achievements: { first: '2026-11-02T10:00:00Z' },
    last: { lesson: 'l1', at: '2026-11-01T10:00:00Z' }
  }
  const b: ProgressData = {
    ...emptyProgress(),
    lessons: { l1: { p: 90, at: '2026-11-03T10:00:00Z' }, l2: { p: 100, done: '2026-11-01T09:00:00Z', at: '2026-11-01T09:00:00Z' } },
    quizzes: { q1: { best: 80, passed: true, tries: 3, at: '2026-11-03T10:00:00Z' } },
    bookmarks: { l1: { on: false, at: '2026-11-03T10:00:00Z' }, l3: { on: true, at: '2026-11-03T10:00:00Z' } },
    achievements: { first: '2026-11-01T09:00:00Z', quiz: '2026-11-03T10:00:00Z' },
    last: { lesson: 'l3', at: '2026-11-03T10:00:00Z' }
  }

  it('keeps the furthest progress, best scores, latest bookmark change and earliest awards', () => {
    const m = mergeProgress(a, b)
    expect(m.lessons.l1.p).toBe(90)
    expect(m.lessons.l2.done).toBe('2026-11-01T09:00:00Z')
    expect(m.quizzes.q1).toEqual({ best: 80, passed: true, tries: 3, at: '2026-11-03T10:00:00Z' })
    expect(m.bookmarks.l1.on).toBe(false)
    expect(m.bookmarks.l3.on).toBe(true)
    expect(m.achievements).toEqual({ first: '2026-11-01T09:00:00Z', quiz: '2026-11-03T10:00:00Z' })
    expect(m.last?.lesson).toBe('l3')
  })

  it('is order independent and idempotent', () => {
    expect(mergeProgress(a, b)).toEqual(mergeProgress(b, a))
    expect(mergeProgress(mergeProgress(a, b), b)).toEqual(mergeProgress(a, b))
  })

  it('validates payloads coming from phones', () => {
    expect(ProgressData.safeParse({ v: 1, lessons: { x: { p: 101, at: 'x' } } }).success).toBe(false)
    expect(ProgressData.parse({ v: 1 })).toEqual(emptyProgress())
  })
})

describe('learner codes', () => {
  it('generates 15 digits that never start with zero', () => {
    for (let i = 0; i < 200; i++) {
      const code = newCode((n) => randomBytes(n))
      expect(isCode(code)).toBe(true)
    }
    expect(isCode('012345678901234')).toBe(false)
    expect(isCode('12345')).toBe(false)
    expect(formatCode('123456789012345')).toBe('12345 67890 12345')
  })
})

describe('study days', () => {
  it('records each day once and merges days from two phones', () => {
    const p = withDay(withDay(emptyProgress(), '2026-11-17'), '2026-11-17')
    expect(p.days).toEqual(['2026-11-17'])
    const other = withDay(emptyProgress(), '2026-11-15')
    expect(mergeProgress(p, other).days).toEqual(['2026-11-15', '2026-11-17'])
  })

  it('counts consecutive days ending today or yesterday', () => {
    const today = new Date(2026, 10, 18, 9)
    expect(streak(['2026-11-16', '2026-11-17', '2026-11-18'], today)).toBe(3)
    expect(streak(['2026-11-16', '2026-11-17'], today)).toBe(2)
    expect(streak(['2026-11-10', '2026-11-16'], today)).toBe(0)
    expect(streak([], today)).toBe(0)
  })

  it('accepts backups saved before days were tracked', () => {
    const old = ProgressData.parse({ v: 1, lessons: {}, quizzes: {}, bookmarks: {}, achievements: {} })
    expect(old.days).toEqual([])
  })
})

describe('dates', () => {
  it('writes Tajik month names', () => {
    expect(formatDay('2026-11-02T10:00:00', 'tg')).toBe('2 ноябри 2026')
  })
})

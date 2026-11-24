import { describe, expect, it } from 'vitest'

import { addDays, AGAIN, boxOf, daysBetween, EASY, fromBox, GOOD, HARD, interval, preview, retrievability, review } from '@/lib/fsrs'

const T = '2026-11-24'

describe('FSRS-5', () => {
  it('memory: 90% after exactly one stability, falling slowly after', () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 5)
    expect(retrievability(0, 3)).toBe(1)
    expect(retrievability(30, 10)).toBeLessThan(0.8)
    expect(interval(10)).toBe(10)
    expect(interval(0.2)).toBe(1)
  })

  it('a new card: Again today, Hard/Good/Easy further each; Easy is easier', () => {
    const p = preview(null, T)
    expect(p[AGAIN]).toBe(0)
    expect(p[HARD]).toBeGreaterThanOrEqual(1)
    expect(p[GOOD]).toBeGreaterThan(p[HARD])
    expect(p[EASY]).toBeGreaterThan(p[GOOD])
    expect(review(null, EASY, T).d).toBeLessThan(review(null, AGAIN, T).d)
  })

  it('remembered on its day: the next interval grows; forgotten: it shrinks and counts a lapse', () => {
    let c = review(null, GOOD, T)
    const first = daysBetween(T, c.due)
    c = review(c, GOOD, c.due)
    const second = daysBetween(c.last, c.due)
    expect(second).toBeGreaterThan(first)
    c = review(c, GOOD, c.due)
    expect(daysBetween(c.last, c.due)).toBeGreaterThan(second)
    const forgot = review(c, AGAIN, c.due)
    expect(forgot.s).toBeLessThan(c.s)
    expect(forgot.lapses).toBe(1)
    expect(forgot.due).toBe(forgot.last)
    // then Good the same day: tomorrow or a little later, not weeks
    const again = review(forgot, GOOD, forgot.last)
    expect(daysBetween(again.last, again.due)).toBeLessThan(daysBetween(c.last, c.due))
  })

  it('a card remembered late (overdue) grows more than one on time', () => {
    const c = review(review(null, GOOD, T), GOOD, addDays(T, 3))
    const onTime = review(c, GOOD, c.due)
    const late = review(c, GOOD, addDays(c.due, 20))
    expect(late.s).toBeGreaterThan(onTime.s)
  })

  it('difficulty stays 1–10; the older Leitner boxes carry over and back', () => {
    let c = review(null, AGAIN, T)
    for (let i = 0; i < 30; i++) c = review(c, AGAIN, addDays(c.last, 1))
    expect(c.d).toBeLessThanOrEqual(10)
    let e = review(null, EASY, T)
    for (let i = 0; i < 10; i++) e = review(e, EASY, e.due)
    expect(e.d).toBeGreaterThanOrEqual(1)
    expect(fromBox(3, '2026-12-01', T)).toEqual({ s: 4, d: 5, due: '2026-12-01', last: T, reps: 3, lapses: 0 })
    expect([0.5, 2, 4, 8, 20].map((s) => boxOf({ s, d: 5, due: T, last: T, reps: 1, lapses: 0 }))).toEqual([1, 2, 3, 4, 5])
  })

  it('days: across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3)
  })
})

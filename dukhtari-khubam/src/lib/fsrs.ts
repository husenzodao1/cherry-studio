/**
 * FSRS (Free Spaced Repetition Scheduler, version 5) — the scheduler modern flashcard apps use: each card has a
 * stability (in how many days her memory of it falls to 90%) and a difficulty (1–10). An answer — Again, Hard,
 * Good or Easy — updates both from how likely she still remembered it, and the next review is set on the day
 * her memory is expected to fall to the retention asked for (90%). Days, not minutes: an "Again" comes back the
 * same day (at the end of the session) and then tomorrow.
 * Published default parameters (trained on millions of reviews); see the FSRS-5 algorithm description.
 */

export const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621] as const
const DECAY = -0.5
const FACTOR = 19 / 81
export const RETENTION = 0.9
export const MAX_DAYS = 36500

export type Rating = 1 | 2 | 3 | 4
export const AGAIN: Rating = 1, HARD: Rating = 2, GOOD: Rating = 3, EASY: Rating = 4

export interface FsrsState {
  /** stability, days */
  s: number
  /** difficulty, 1–10 */
  d: number
  /** the day it is due (YYYY-MM-DD) */
  due: string
  /** the day it was last answered */
  last: string
  reps: number
  lapses: number
}

const clampD = (d: number) => Math.min(10, Math.max(1, d))
const round = (x: number, n = 4) => Math.round(x * 10 ** n) / 10 ** n

/** the chance she still remembers it after `t` days with stability `s` */
export const retrievability = (t: number, s: number) => (1 + (FACTOR * t) / s) ** DECAY
/** the days until her memory falls to `r` */
export const interval = (s: number, r = RETENTION) => Math.min(MAX_DAYS, Math.max(1, Math.round((s / FACTOR) * (r ** (1 / DECAY) - 1))))

const initS = (g: Rating) => W[g - 1]
const initD = (g: Rating) => clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1)

function nextD(d: number, g: Rating) {
  const delta = -W[6] * (g - 3)
  const damped = d + (delta * (10 - d)) / 9
  // a little back toward the difficulty of an easy card, so no card is stuck at 10
  return clampD(W[7] * initD(EASY) + (1 - W[7]) * damped)
}
function recallS(d: number, s: number, r: number, g: Rating) {
  const hard = g === HARD ? W[15] : 1
  const easy = g === EASY ? W[16] : 1
  return s * (1 + Math.exp(W[8]) * (11 - d) * s ** -W[9] * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy)
}
function forgetS(d: number, s: number, r: number) {
  return Math.min(s, W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * Math.exp(W[14] * (1 - r)))
}
/** answered again on the same day: a short-term step */
const sameDayS = (s: number, g: Rating) => s * Math.exp(W[17] * (g - 3 + W[18]))

/** whole days from one day to another (both YYYY-MM-DD) */
export function daysBetween(a: string, b: string): number {
  const t = (x: string) => Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10))
  return Math.round((t(b) - t(a)) / 86_400_000)
}
export function addDays(day: string, n: number): string {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n))
  return d.toISOString().slice(0, 10)
}

/** The card after her answer today. */
export function review(card: FsrsState | null | undefined, g: Rating, today: string): FsrsState {
  if (!card) {
    const s = initS(g)
    return { s: round(s), d: round(initD(g)), due: g === AGAIN ? today : addDays(today, interval(s)), last: today, reps: 1, lapses: 0 }
  }
  const elapsed = Math.max(0, daysBetween(card.last, today))
  const r = elapsed === 0 ? 1 : retrievability(elapsed, card.s)
  const d = nextD(card.d, g)
  const s = elapsed === 0 ? sameDayS(card.s, g) : g === AGAIN ? forgetS(card.d, card.s, r) : recallS(card.d, card.s, r, g)
  // "Again": once more today, then from tomorrow by its new stability
  const due = g === AGAIN ? today : addDays(today, interval(Math.max(s, 0.01)))
  return { s: round(Math.max(0.01, s)), d: round(d), due, last: today, reps: card.reps + 1, lapses: card.lapses + (g === AGAIN && elapsed > 0 ? 1 : 0) }
}

/** what each answer would do (the buttons show it: "1 рӯз", "4 рӯз", …) */
export function preview(card: FsrsState | null | undefined, today: string): Record<Rating, number> {
  const out = {} as Record<Rating, number>
  for (const g of [AGAIN, HARD, GOOD, EASY] as Rating[]) out[g] = daysBetween(today, review(card, g, today).due)
  return out
}

/** a card from the older Leitner boxes (1–5): as stable as its box's interval, of middle difficulty */
export function fromBox(box: number, due: string, last: string): FsrsState {
  const s = [1, 2, 4, 8, 16][Math.min(5, Math.max(1, box)) - 1]
  return { s, d: 5, due, last, reps: box, lapses: 0 }
}

/** the Leitner box that best matches a card (kept for older app versions, which read boxes) */
export const boxOf = (st: FsrsState) => (st.s < 1.5 ? 1 : st.s < 3 ? 2 : st.s < 6 ? 3 : st.s < 12 ? 4 : 5)

import { z } from 'zod'

/**
 * Learner progress kept on the phone and backed up under the learner's 15-digit code.
 * Merging is commutative, so two phones (or a phone and its backup) always converge:
 * the furthest reading progress, the best quiz score, the latest bookmark change, the earliest award.
 */

const Iso = z.string().max(40)
const MAX_DAYS = 400
const Id = z.string().min(1).max(80)

export const LessonProgress = z.strictObject({ p: z.number().min(0).max(100), done: Iso.optional(), at: Iso })
export const QuizResult = z.strictObject({ best: z.number().min(0).max(100), passed: z.boolean(), tries: z.number().int().min(0).max(100000), at: Iso })
export const Bookmark = z.strictObject({ on: z.boolean(), at: Iso })
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
/** spaced repetition (Leitner): box 1–5, the day the question is due again, when it was last answered */
export const ReviewCard = z.strictObject({ box: z.number().int().min(1).max(5), due: Day, at: Iso })

export const ProgressData = z.strictObject({
  v: z.literal(1),
  lessons: z.record(Id, LessonProgress).default({}),
  quizzes: z.record(Id, QuizResult).default({}),
  bookmarks: z.record(Id, Bookmark).default({}),
  achievements: z.record(Id, Iso).default({}),
  last: z.strictObject({ lesson: Id, at: Iso }).optional(),
  /** year of birth, from the age given at registration (so the age stays current over the years) */
  born: z.number().int().min(1900).max(2100).optional(),
  /** local dates (YYYY-MM-DD) on which the learner studied, for the day streak */
  days: z.array(Day).max(MAX_DAYS).default([]),
  review: z.record(Id, ReviewCard).default({})
})
export type ProgressData = z.infer<typeof ProgressData>

export const emptyProgress = (): ProgressData => ({ v: 1, lessons: {}, quizzes: {}, bookmarks: {}, achievements: {}, days: [], review: {} })

/** Calendar date on the phone's own clock. */
export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const keepDays = (days: Iterable<string>) => [...new Set(days)].sort().slice(-MAX_DAYS)

/** Age in whole years from the stored year of birth (null when not given yet). */
export const ageOf = (p: ProgressData, today = new Date()) => (p.born === undefined ? null : today.getFullYear() - p.born)

/** Records a day of study (no change if it is already there). */
export function withDay(p: ProgressData, day = localDay()): ProgressData {
  return p.days.includes(day) ? p : { ...p, days: keepDays([...p.days, day]) }
}

/** Consecutive study days ending today (or yesterday, so the streak survives until the day is over). */
export function streak(days: string[], today = new Date()): number {
  const set = new Set(days)
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!set.has(localDay(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (set.has(localDay(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

const later = (a?: string, b?: string) => (!a ? b : !b ? a : a >= b ? a : b)
const earlier = (a?: string, b?: string) => (!a ? b : !b ? a : a <= b ? a : b)

export function mergeProgress(a: ProgressData, b: ProgressData): ProgressData {
  const out = emptyProgress()
  for (const id of new Set([...Object.keys(a.lessons), ...Object.keys(b.lessons)])) {
    const x = a.lessons[id]
    const y = b.lessons[id]
    if (!x || !y) {
      out.lessons[id] = (x ?? y)!
      continue
    }
    const done = earlier(x.done, y.done)
    out.lessons[id] = { p: Math.max(x.p, y.p), ...(done ? { done } : {}), at: later(x.at, y.at)! }
  }
  for (const id of new Set([...Object.keys(a.quizzes), ...Object.keys(b.quizzes)])) {
    const x = a.quizzes[id]
    const y = b.quizzes[id]
    out.quizzes[id] = !x || !y ? (x ?? y)!
      : { best: Math.max(x.best, y.best), passed: x.passed || y.passed, tries: Math.max(x.tries, y.tries), at: later(x.at, y.at)! }
  }
  for (const id of new Set([...Object.keys(a.bookmarks), ...Object.keys(b.bookmarks)])) {
    const x = a.bookmarks[id]
    const y = b.bookmarks[id]
    out.bookmarks[id] = !x || !y ? (x ?? y)! : x.at >= y.at ? x : y
  }
  for (const key of new Set([...Object.keys(a.achievements), ...Object.keys(b.achievements)])) {
    out.achievements[key] = earlier(a.achievements[key], b.achievements[key])!
  }
  const last = !a.last ? b.last : !b.last ? a.last : a.last.at >= b.last.at ? a.last : b.last
  if (last) out.last = last
  out.days = keepDays([...a.days, ...b.days])
  for (const id of new Set([...Object.keys(a.review), ...Object.keys(b.review)])) {
    const x = a.review[id]
    const y = b.review[id]
    out.review[id] = !x || !y ? (x ?? y)! : x.at >= y.at ? x : y
  }
  const born = a.born ?? b.born
  if (born !== undefined) out.born = born
  return out
}

/** 15 digits, first digit not zero: about 50 bits, enough that guessing someone else's code is hopeless. */
export const CODE_LENGTH = 15
export const isCode = (s: string) => /^[1-9][0-9]{14}$/.test(s)

/** Unbiased random code from a source of random bytes (crypto.getRandomValues in the app). */
export function newCode(randomBytes: (n: number) => Uint8Array): string {
  let code = ''
  while (code.length < CODE_LENGTH) {
    for (const b of randomBytes(32)) {
      if (b >= 250) continue // keep b % 10 uniform
      const d = b % 10
      if (code.length === 0 && d === 0) continue
      code += d
      if (code.length === CODE_LENGTH) break
    }
  }
  return code
}

/** Shown as 5-5-5 so it is easy to read out and write down. */
export const formatCode = (code: string) => code.replace(/(\d{5})(?=\d)/g, '$1 ')

const TG_MONTHS = ['январи', 'феврали', 'марти', 'апрели', 'майи', 'июни', 'июли', 'августи', 'сентябри', 'октябри', 'ноябри', 'декабри']

/** "2 ноябри 2026" in Tajik (browsers have no Tajik month names); other languages use the platform. */
export function formatDay(iso: string, locale: string): string {
  const d = new Date(iso)
  if (locale === 'tg') return `${d.getDate()} ${TG_MONTHS[d.getMonth()]} ${d.getFullYear()}`
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

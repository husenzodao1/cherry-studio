import { localDay, type ProgressData } from '@/lib/progress'

import type { Bundle, OfflineQuestion, OfflineQuiz } from './content'

/**
 * "Такрори рӯз" — daily review with spaced repetition (Leitner boxes).
 * Questions come from quizzes the learner has taken and from quizzes next to lessons she has finished.
 * A right answer moves the question one box up and it returns after 1, 2, 4, 8 or 16 days; a wrong
 * answer sends it back to box 1, due tomorrow. Each day offers at most a few questions, overdue first.
 */

export const INTERVALS = [1, 2, 4, 8, 16] as const
export const DAILY_LIMIT = 5
/** never more than this many questions seen for the first time in one day */
export const NEW_PER_DAY = 3
const REVIEWABLE = new Set(['single_choice', 'true_false', 'multiple_choice'])

export interface ReviewItem { quiz: OfflineQuiz; question: OfflineQuestion }

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return localDay(new Date(y, m - 1, d + n))
}

/** Next state of a question after an answer. */
export function schedule(box: number | undefined, correct: boolean, today: string) {
  const next = correct ? Math.min(5, (box ?? 0) + 1) : 1
  return { box: next, due: addDays(today, correct ? INTERVALS[next - 1] : 1) }
}

/** Quizzes the learner has met: taken ones and those placed next to lessons she has finished. */
function metQuizzes(bundle: Bundle, progress: ProgressData): Set<string> {
  const ids = new Set(Object.keys(progress.quizzes))
  const done = (id: string) => !!progress.lessons[id]?.done
  for (const c of Object.values(bundle.courses)) {
    let courseTouched = false
    for (const m of c.modules) {
      let moduleTouched = false
      for (const t of m.topics) {
        if (t.lessons.some((l) => done(l.id))) {
          t.quizzes.forEach((q) => ids.add(q.id))
          moduleTouched = true
        }
      }
      if (moduleTouched) {
        m.quizzes.forEach((q) => ids.add(q.id))
        courseTouched = true
      }
    }
    if (courseTouched) c.quizzes.forEach((q) => ids.add(q.id))
  }
  return ids
}

/** Every question that can be reviewed on the phone (choice questions with a known answer). */
export function reviewPool(bundle: Bundle, progress: ProgressData): ReviewItem[] {
  const out: ReviewItem[] = []
  for (const id of metQuizzes(bundle, progress)) {
    const quiz = bundle.quizzes[id]
    if (!quiz) continue
    for (const question of quiz.questions) {
      if (REVIEWABLE.has(question.type) && quiz.grading[question.id]?.key.correct_option_ids?.length) out.push({ quiz, question })
    }
  }
  return out
}

/**
 * Today's questions: overdue and due ones first (oldest first), then a few new ones. `fsrs`: the memory states
 * of the questions she answered since the scheduler became FSRS (their day wins over the Leitner box's).
 */
export function dueToday(bundle: Bundle, progress: ProgressData, today = localDay(), limit = DAILY_LIMIT, fsrs: Record<string, { due: string }> = {}): ReviewItem[] {
  const pool = reviewPool(bundle, progress)
  const dueOf = (id: string) => fsrs[id]?.due ?? progress.review[id]?.due
  const due = pool
    .filter((it) => progress.review[it.question.id] && dueOf(it.question.id)! <= today)
    .sort((a, b) => dueOf(a.question.id)!.localeCompare(dueOf(b.question.id)!)
      || progress.review[a.question.id].box - progress.review[b.question.id].box)
  const seenToday = Object.values(progress.review).filter((r) => r.at.slice(0, 10) === today && r.box === 1).length
  const fresh = pool.filter((it) => !progress.review[it.question.id]).slice(0, Math.max(0, NEW_PER_DAY - seenToday))
  return [...due, ...fresh].slice(0, limit)
}

/** How the review stands: questions in each box and how many wait today. */
export function reviewStats(bundle: Bundle, progress: ProgressData, today = localDay(), fsrs: Record<string, { due: string }> = {}) {
  const pool = reviewPool(bundle, progress)
  const boxes = [0, 0, 0, 0, 0]
  for (const it of pool) {
    const r = progress.review[it.question.id]
    if (r) boxes[r.box - 1]++
  }
  return { total: pool.length, boxes, today: dueToday(bundle, progress, today, DAILY_LIMIT, fsrs).length }
}

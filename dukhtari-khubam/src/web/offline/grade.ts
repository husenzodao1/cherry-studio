import type { Grading, OfflineQuestion } from './content'

/** On-phone grading; the same rules as private.grade_answers in the database. */

export type Answer = { option_id?: string; option_ids?: string[]; pairs?: Record<string, string>; order?: string[]; text?: string }
export type Status = 'correct' | 'partial' | 'incorrect' | 'unanswered' | 'pending_review'
export interface QuestionResult { status: Status; points: number; max_points: number }

const round2 = (n: number) => Math.round(n * 100) / 100

export function normalize(text: string, caseSensitive: boolean, ignorePunct: boolean): string {
  let t = caseSensitive ? text ?? '' : (text ?? '').toLowerCase()
  if (ignorePunct) t = t.replace(/[\p{P}«»“”„‘’—–…]/gu, '')
  return t.replace(/\s+/g, ' ').trim()
}

export function gradeQuestion(q: OfflineQuestion, g: Grading | undefined, a: Answer | undefined, locale: string): QuestionResult {
  const points = q.points
  const key = g?.key ?? {}
  const partial = g?.partial_credit ?? false
  let earned = 0
  let status: Status = 'incorrect'

  if (!a) status = 'unanswered'
  else if (q.type === 'single_choice' || q.type === 'true_false') {
    if (!a.option_id) status = 'unanswered'
    else if ((key.correct_option_ids ?? []).includes(a.option_id)) { earned = points; status = 'correct' }
  } else if (q.type === 'multiple_choice') {
    const correct = key.correct_option_ids ?? []
    const given = [...new Set(a.option_ids ?? [])]
    const hits = given.filter((x) => correct.includes(x)).length
    const wrong = given.length - hits
    if (!given.length) status = 'unanswered'
    else if (correct.length && hits === correct.length && wrong === 0) { earned = points; status = 'correct' }
    else if (partial && correct.length && hits > wrong) { earned = round2((points * (hits - wrong)) / correct.length); status = 'partial' }
  } else if (q.type === 'matching') {
    const pairs = Object.entries(key.matching ?? {})
    const ok = pairs.filter(([l, r]) => a.pairs?.[l] === r).length
    if (!a.pairs) status = 'unanswered'
    else if (pairs.length && ok === pairs.length) { earned = points; status = 'correct' }
    else if (partial && pairs.length && ok > 0) { earned = round2((points * ok) / pairs.length); status = 'partial' }
  } else if (q.type === 'ordering') {
    const correct = key.correct_order ?? []
    const given = a.order ?? []
    if (!given.length) status = 'unanswered'
    else if (correct.length && given.join() === correct.join()) { earned = points; status = 'correct' }
    else if (partial && correct.length) {
      const ok = correct.filter((id, i) => given[i] === id).length
      if (ok > 0) { earned = round2((points * ok) / correct.length); status = 'partial' }
    }
  } else if (q.type === 'short_answer') {
    const cs = g?.case_sensitive ?? false
    const ip = g?.ignore_punctuation ?? true
    const norm = normalize(a.text ?? '', cs, ip)
    const accepted = key.accepted_answers?.[locale]?.length ? key.accepted_answers[locale] : Object.values(key.accepted_answers ?? {}).flat()
    if (!norm) status = 'unanswered'
    else if (accepted.some((x) => normalize(x, cs, ip) === norm)) { earned = points; status = 'correct' }
  } else if (q.type === 'long_answer') {
    // written answers have no automatic key: counted as done, not scored
    status = (a.text ?? '').trim() ? 'pending_review' : 'unanswered'
  }
  if (status === 'incorrect' && (g?.penalty ?? 0) > 0) earned = -(g!.penalty)
  return { status, points: earned, max_points: points }
}

export function gradeQuiz(questions: OfflineQuestion[], grading: Record<string, Grading>, answers: Record<string, Answer>, locale: string) {
  const results: Record<string, QuestionResult> = {}
  let total = 0
  let max = 0
  for (const q of questions) {
    const r = gradeQuestion(q, grading[q.id], answers[q.id], locale)
    results[q.id] = r
    // long answers are reviewed by a person online; offline they do not count against the learner
    if (r.status !== 'pending_review') max += r.max_points
    total += r.points
  }
  total = Math.max(total, 0)
  return { score: total, max_score: max, percent: max > 0 ? round2((total * 100) / max) : 100, results }
}

/** Fisher–Yates on a copy. */
export function shuffled<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

import type { Bundle, OfflineQuiz } from '@/web/offline/content'
import type { ProgressData } from './progress'

/**
 * A course is a stage ("этап"): each lesson ends with its own test (made in the panel, in the lesson's
 * "Тестҳо" tab), and once every lesson is done the whole stage has a final test, made up on the phone
 * from two random questions of every lesson test. Passing it finishes the stage (certificate, rating).
 */

/** Questions taken from each lesson test for the stage's final test. */
export const PER_LESSON = 2
/** Share of points needed to pass the final test. */
export const FINAL_PASS = 70
/** The final test's id in the learner's progress. */
export const finalId = (courseId: string) => `final:${courseId}`

const lessonIds = (bundle: Bundle, courseId: string) =>
  (bundle.courses[courseId]?.modules ?? []).flatMap((m) => m.topics.flatMap((t) => t.lessons.filter((l) => !l.locked).map((l) => l.id)))

/** The first test of a lesson that can be opened (offline bundle), if it has one. */
export function lessonTest(bundle: Bundle, lessonId: string): string | null {
  return bundle.lessons[lessonId]?.quizzes?.find((q) => bundle.quizzes[q.id])?.id ?? null
}

/** The lesson tests of a course, in lesson order. */
export function stageTests(bundle: Bundle, courseId: string): string[] {
  return lessonIds(bundle, courseId).map((id) => lessonTest(bundle, id)).filter((id): id is string => !!id)
}

/** The course a lesson belongs to. */
export function courseOfLesson(bundle: Bundle, lessonId: string): string | null {
  return bundle.lessons[lessonId]?.context.course.id ?? null
}

/** The final test: two random questions from every lesson test (all of them when a test has fewer). */
export function finalQuiz(bundle: Bundle, courseId: string, title: string, random: () => number = Math.random): OfflineQuiz | null {
  const tests = stageTests(bundle, courseId).map((id) => bundle.quizzes[id])
  if (!tests.length) return null
  const questions: OfflineQuiz['questions'] = []
  const grading: OfflineQuiz['grading'] = {}
  for (const quiz of tests) {
    const pool = [...quiz.questions]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    for (const q of pool.slice(0, PER_LESSON)) {
      if (!quiz.grading[q.id]) continue
      questions.push(q)
      grading[q.id] = quiz.grading[q.id]
    }
  }
  if (!questions.length) return null
  return {
    locale: tests[0].locale,
    quiz: {
      id: finalId(courseId), title, instructions: null, pass_score_percent: FINAL_PASS,
      show_explanations: 'after_submit', show_correct_answers: 'after_submit', question_count: questions.length
    },
    questions,
    settings: { shuffle_questions: true, shuffle_options: true, allow_retry: true, completion_text: null },
    grading
  }
}

export interface StageState {
  lessons: number
  done: number
  /** every lesson done */
  read: boolean
  /** the stage has a final test (some lesson has a test) */
  hasFinal: boolean
  finalPassed: boolean
  /** the stage is finished: lessons read and, when there is one, the final test passed */
  complete: boolean
}

export function stageState(bundle: Bundle, progress: ProgressData, courseId: string): StageState {
  const ids = lessonIds(bundle, courseId)
  const done = ids.filter((id) => progress.lessons[id]?.done).length
  const read = ids.length > 0 && done === ids.length
  const hasFinal = stageTests(bundle, courseId).length > 0
  const finalPassed = !!progress.quizzes[finalId(courseId)]?.passed
  return { lessons: ids.length, done, read, hasFinal, finalPassed, complete: read && (!hasFinal || finalPassed) }
}

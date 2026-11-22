import { describe, expect, it } from 'vitest'

import { emptyProgress } from '@/lib/progress'
import { FINAL_PASS, finalId, finalQuiz, lessonTest, PER_LESSON, stageState, stageTests } from '@/lib/stage'
import type { Bundle, OfflineQuiz } from '@/web/offline/content'

const quiz = (id: string, n: number): OfflineQuiz => ({
  locale: 'tg',
  quiz: { id, title: id, pass_score_percent: 60, show_explanations: 'after_each', show_correct_answers: 'after_each', question_count: n },
  questions: Array.from({ length: n }, (_, i) => ({ id: `${id}-q${i}`, type: 'single_choice', points: 1, prompt: `${id} ${i}`, options: [] })),
  settings: { shuffle_questions: false, shuffle_options: false, allow_retry: true },
  grading: Object.fromEntries(Array.from({ length: n }, (_, i) => [`${id}-q${i}`, { partial_credit: false, penalty: 0, case_sensitive: false, ignore_punctuation: true, key: { correct_option_ids: [] } }]))
})
const card = (id: string) => ({ id, title: id, question_count: 0 })
const lesson = (id: string, quizzes: string[]) => ({
  id, title: id, locked: false, locale: 'tg', context: { school: { title: 's' }, course: { id: 'c', title: 'c' } },
  blocks: [], assets: {}, position: { index: 1, total: 3 }, quizzes: quizzes.map(card)
})

const bundle = {
  courses: { c: { id: 'c', title: 'c', goals: [], prerequisites: [], quizzes: [], locked: false,
    modules: [{ id: 'm', title: 'm', quizzes: [], topics: [{ id: 't', title: 't', quizzes: [],
      lessons: [{ id: 'l1', title: 'l1', locked: false }, { id: 'l2', title: 'l2', locked: false }, { id: 'l3', title: 'l3', locked: false }] }] }] } },
  // l3 has no test; l2's test is missing from the bundle (could not be read): it does not count
  lessons: { l1: lesson('l1', ['q1']), l2: lesson('l2', ['gone', 'q2']), l3: lesson('l3', []) },
  quizzes: { q1: quiz('q1', 5), q2: quiz('q2', 1) }
} as unknown as Bundle

describe('a stage: lesson tests and the final test', () => {
  it("finds each lesson's first test that can be opened", () => {
    expect(lessonTest(bundle, 'l1')).toBe('q1')
    expect(lessonTest(bundle, 'l2')).toBe('q2')
    expect(lessonTest(bundle, 'l3')).toBeNull()
    expect(stageTests(bundle, 'c')).toEqual(['q1', 'q2'])
  })

  it('the final test takes two random questions from every lesson test, with their answer keys', () => {
    const f = finalQuiz(bundle, 'c', 'Тести пурра', () => 0.3)!
    expect(f.quiz.id).toBe(finalId('c'))
    expect(f.quiz.pass_score_percent).toBe(FINAL_PASS)
    const from = (p: string) => f.questions.filter((q) => q.id.startsWith(p)).length
    expect(from('q1-')).toBe(PER_LESSON)
    expect(from('q2-')).toBe(1)
    for (const q of f.questions) expect(f.grading[q.id]).toBeDefined()
    // another draw can pick other questions
    const g = finalQuiz(bundle, 'c', 'x', () => 0.99)!
    expect(new Set(f.questions.map((q) => q.id))).not.toEqual(new Set(g.questions.map((q) => q.id)))
  })

  it('the stage is complete when every lesson is done and the final test is passed', () => {
    const p = emptyProgress()
    expect(stageState(bundle, p, 'c')).toMatchObject({ lessons: 3, done: 0, read: false, hasFinal: true, complete: false })
    for (const id of ['l1', 'l2', 'l3']) p.lessons[id] = { done: new Date().toISOString() } as never
    expect(stageState(bundle, p, 'c')).toMatchObject({ read: true, finalPassed: false, complete: false })
    p.quizzes[finalId('c')] = { best: 80, passed: true, tries: 1, at: new Date().toISOString() } as never
    expect(stageState(bundle, p, 'c').complete).toBe(true)
  })

  it('a stage with no lesson tests is complete once its lessons are read', () => {
    const plain = { ...bundle, lessons: { l1: lesson('l1', []), l2: lesson('l2', []), l3: lesson('l3', []) } } as Bundle
    const p = emptyProgress()
    for (const id of ['l1', 'l2', 'l3']) p.lessons[id] = { done: new Date().toISOString() } as never
    expect(finalQuiz(plain, 'c', 'x')).toBeNull()
    expect(stageState(plain, p, 'c')).toMatchObject({ hasFinal: false, complete: true })
  })
})

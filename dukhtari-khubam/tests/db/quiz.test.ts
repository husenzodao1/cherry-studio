import { beforeAll, describe, expect, it } from 'vitest'

import { buildWorld, type World } from './fixtures'
import { as, createDb, createUser, expectError, rpc, type Db } from './harness'

let db: Db
let w: World
let quiz: string
const q: Record<string, string> = {}
let opt: Record<string, Record<string, string>> = {}

const tr = (text: string) => ({ tg: { text } })

async function save(question: Record<string, unknown>) {
  return as(db, w.author, (tx) => rpc(tx, 'admin_save_quiz_question', { p_question: { quiz_id: quiz, ...question } }))
}

async function publish() {
  await as(db, w.author, (tx) => rpc(tx, 'admin_transition', { p_entity: 'quiz', p_id: quiz, p_to: 'in_review' }))
  await as(db, w.reviewer, (tx) => rpc(tx, 'admin_transition', { p_entity: 'quiz', p_id: quiz, p_to: 'approved' }))
  return as(db, w.admin, (tx) => rpc(tx, 'admin_transition', { p_entity: 'quiz', p_id: quiz, p_to: 'published' }))
}

beforeAll(async () => {
  db = await createDb()
  w = await buildWorld(db)
  quiz = await as(db, w.author, async (tx) => {
    const id = (await tx.query<{ id: string }>(
      "insert into public.quizzes (slug, topic_id, pass_score_percent, max_attempts) values ('quiz-1', $1, 60, 3) returning id", [w.topic])).rows[0].id
    await tx.query(
      "insert into public.quiz_translations (quiz_id, locale, title, completion_text, ready) values ($1, 'tg', 'Тести мавзӯъ', 'Офарин', true)", [id])
    return id
  })
})

describe('manual quiz builder', () => {
  it('saves every question type with options and answer keys entered by the author', async () => {
    const single = await save({
      type: 'single_choice', points: 2,
      translations: { tg: { prompt: 'Саволи A', explanation_correct: 'Шарҳи дуруст', explanation_incorrect: 'Шарҳи хато' } },
      options: [{ ref: 'a', translations: tr('A1') }, { ref: 'b', translations: tr('A2') }, { ref: 'c', translations: tr('A3') }],
      answer_key: { correct: ['b'] }
    })
    q.single = single.id
    opt.single = single.option_ids

    const multi = await save({
      type: 'multiple_choice', points: 3, partial_credit: true,
      translations: { tg: { prompt: 'Саволи B' } },
      options: [{ ref: 'a', translations: tr('B1') }, { ref: 'b', translations: tr('B2') },
                { ref: 'c', translations: tr('B3') }, { ref: 'd', translations: tr('B4') }],
      answer_key: { correct: ['a', 'c', 'd'] }
    })
    q.multi = multi.id
    opt.multi = multi.option_ids

    const tf = await save({
      type: 'true_false', translations: { tg: { prompt: 'Изҳорот' } },
      options: [{ ref: 't', translations: tr('Дуруст') }, { ref: 'f', translations: tr('Нодуруст') }],
      answer_key: { correct: ['f'] }
    })
    q.tf = tf.id
    opt.tf = tf.option_ids

    const match = await save({
      type: 'matching', points: 2, translations: { tg: { prompt: 'Мувофиқ кунед' } },
      options: [{ ref: 'l1', side: 'left', translations: tr('Чап 1') }, { ref: 'l2', side: 'left', translations: tr('Чап 2') },
                { ref: 'r1', side: 'right', translations: tr('Рост 1') }, { ref: 'r2', side: 'right', translations: tr('Рост 2') }],
      answer_key: { matching: { l1: 'r1', l2: 'r2' } }
    })
    q.match = match.id
    opt.match = match.option_ids

    const order = await save({
      type: 'ordering', translations: { tg: { prompt: 'Тартиб диҳед' } },
      options: [{ ref: 'x', translations: tr('Якум') }, { ref: 'y', translations: tr('Дуюм') }, { ref: 'z', translations: tr('Сеюм') }],
      answer_key: { order: ['x', 'y', 'z'] }
    })
    q.order = order.id
    opt.order = order.option_ids

    const short = await save({
      type: 'short_answer', translations: { tg: { prompt: 'Пойтахт?' } },
      answer_key: { accepted_answers: { tg: ['Душанбе'] } }
    })
    q.short = short.id

    const long = await save({
      type: 'long_answer', points: 4, translations: { tg: { prompt: 'Иншо нависед', rubric: 'Меъёрҳои баҳо' } }
    })
    q.long = long.id

    const errors = await as(db, w.author, (tx) => rpc(tx, 'admin_validate', { p_entity: 'quiz', p_id: quiz }))
    expect(errors).toEqual([])
  })

  it('refuses to publish a single-choice question with two correct answers', async () => {
    await save({ id: q.single, answer_key: { correct: [opt.single.a, opt.single.b] } })
    const errors = await as(db, w.author, (tx) => rpc(tx, 'admin_validate', { p_entity: 'quiz', p_id: quiz }))
    expect(errors).toEqual([{ code: 'needs_exactly_one_correct', question_id: q.single }])
    await save({ id: q.single, answer_key: { correct: [opt.single.b] } })
  })

  it('duplicates a question as an independent copy', async () => {
    const copy = await as(db, w.author, (tx) => rpc(tx, 'admin_duplicate_question', { p_question: q.single }))
    await as(db, w.author, (tx) => tx.query("update public.quiz_question_translations set prompt = 'Нусха' where question_id = $1", [copy]))
    const original = await as(db, w.author, (tx) => tx.query<{ prompt: string }>(
      'select prompt from public.quiz_question_translations where question_id = $1', [q.single]))
    expect(original.rows[0].prompt).toBe('Саволи A')
    await as(db, w.author, (tx) => tx.query('delete from public.quiz_questions where id = $1', [copy]))
  })

  it('previews and grades the draft without storing attempts', async () => {
    const preview = await as(db, w.author, (tx) => rpc(tx, 'admin_quiz_preview', { p_quiz: quiz, p_locale: 'tg' }))
    expect(preview.player.questions).toHaveLength(7)
    expect(preview.answer_key[q.single].correct_option_ids).toEqual([opt.single.b])
    const graded = await as(db, w.author, (tx) => rpc(tx, 'admin_quiz_preview_grade', {
      p_quiz: quiz, p_answers: { [q.single]: { option_id: opt.single.b } }, p_locale: 'tg'
    }))
    expect(graded.results[q.single].status).toBe('correct')
    const { rows } = await db.query<{ n: number }>('select count(*)::int n from public.quiz_attempts')
    expect(rows[0].n).toBe(0)
  })
})

describe('taking the quiz', () => {
  let learner: string
  let attempt: string

  beforeAll(async () => {
    await publish()
    learner = await createUser(db, 'quiz-learner@example.test')
  })

  it('never exposes answer keys or explanations before submission', async () => {
    const started = await as(db, learner, (tx) => rpc(tx, 'api_start_quiz_attempt', { p_quiz: quiz, p_locale: 'tg' }))
    attempt = started.attempt.id
    const json = JSON.stringify(started)
    expect(json).not.toContain('Шарҳи дуруст')
    expect(json).not.toContain('correct_option_ids')
    expect(json).not.toContain('Душанбе')
    expect(started.player.questions).toHaveLength(7)
    const keys = await as(db, learner, (tx) => tx.query('select * from public.quiz_answer_keys'))
    expect(keys.rows).toHaveLength(0)
    await expectError(as(db, learner, (tx) => tx.query('select answer_key from public.content_revisions')), 'permission denied')
    await expectError(as(db, learner, (tx) => tx.query("update public.quiz_attempts set score = 100 where id = $1", [attempt])), 'permission denied')
  })

  it('grades every question type in the backend', async () => {
    const result = await as(db, learner, (tx) => rpc(tx, 'api_submit_quiz_attempt', {
      p_attempt: attempt,
      p_answers: {
        [q.single]: { option_id: opt.single.b },
        [q.multi]: { option_ids: [opt.multi.a, opt.multi.c, opt.multi.b] },
        [q.tf]: { option_id: opt.tf.t },
        [q.match]: { pairs: { [opt.match.l1]: opt.match.r1, [opt.match.l2]: opt.match.r2 } },
        [q.order]: { order: [opt.order.x, opt.order.y, opt.order.z] },
        [q.short]: { text: '  душанбе! ' },
        [q.long]: { text: 'Ҷавоби муфассал' }
      }
    }))
    const byId = Object.fromEntries(result.questions.map((x: any) => [x.id, x]))
    expect(byId[q.single]).toMatchObject({ status: 'correct', points: 2, explanation: 'Шарҳи дуруст' })
    // partial credit: 3 points × (2 hits − 1 wrong) / 3 correct
    expect(byId[q.multi]).toMatchObject({ status: 'partial', points: 1 })
    expect(byId[q.tf]).toMatchObject({ status: 'incorrect', points: 0, correct_option_ids: [opt.tf.f] })
    expect(byId[q.match].status).toBe('correct')
    expect(byId[q.order].status).toBe('correct')
    expect(byId[q.short].status).toBe('correct')
    expect(byId[q.long].status).toBe('pending_review')
    expect(result).toMatchObject({ status: 'pending_review', score: 7, max_score: 14, passed: null })
  })

  it('lets a reviewer grade the written answer and finalises the result', async () => {
    await expectError(as(db, learner, (tx) => rpc(tx, 'admin_review_answer', {
      p_attempt: attempt, p_question: q.long, p_points: 4 })), /forbidden|permission denied/)
    const reviewed = await as(db, w.reviewer, (tx) => rpc(tx, 'admin_review_answer', {
      p_attempt: attempt, p_question: q.long, p_points: 3, p_comment: 'Хуб'
    }))
    expect(reviewed).toMatchObject({ status: 'graded', score: 10, percent: 71.43, passed: true, completion_text: 'Офарин' })
  })

  it('keeps old attempts bound to their revision after the quiz is edited and republished', async () => {
    await save({ id: q.single, points: 5 })
    await publish()
    const old = await as(db, learner, (tx) => rpc(tx, 'api_get_quiz_attempt', { p_attempt: attempt }))
    expect(old.max_score).toBe(14)
    const fresh = await as(db, learner, (tx) => rpc(tx, 'api_start_quiz_attempt', { p_quiz: quiz, p_locale: 'tg' }))
    expect(fresh.player.quiz.total_points).toBe(17)
    const other = await as(db, w.reader, (tx) => tx.query('select * from public.quiz_attempts where id = $1', [attempt]))
    expect(other.rows).toHaveLength(0)
  })

  it('enforces the attempt limit', async () => {
    const limited = await createUser(db, 'limited@example.test')
    for (let i = 0; i < 3; i++) {
      const s = await as(db, limited, (tx) => rpc(tx, 'api_start_quiz_attempt', { p_quiz: quiz, p_locale: 'tg' }))
      await as(db, limited, (tx) => rpc(tx, 'api_submit_quiz_attempt', { p_attempt: s.attempt.id, p_answers: {} }))
    }
    await expectError(as(db, limited, (tx) => rpc(tx, 'api_start_quiz_attempt', { p_quiz: quiz, p_locale: 'tg' })), 'attempt_limit_reached')
  })

  it('reports analytics to authorised roles only', async () => {
    await expectError(as(db, w.author, (tx) => rpc(tx, 'admin_quiz_analytics', { p_quiz: quiz })), 'forbidden')
    const stats = await as(db, w.admin, (tx) => rpc(tx, 'admin_quiz_analytics', { p_quiz: quiz }))
    expect(stats.attempts_submitted).toBe(4)
    expect(stats.unique_users).toBe(2)
  })

  it('checks single answers immediately when the quiz asks for it', async () => {
    await as(db, w.author, (tx) => tx.query("update public.quizzes set show_explanations = 'after_each' where id = $1", [quiz]))
    await publish()
    const user = await createUser(db, 'instant@example.test')
    const s = await as(db, user, (tx) => rpc(tx, 'api_start_quiz_attempt', { p_quiz: quiz, p_locale: 'tg' }))
    const check = await as(db, user, (tx) => rpc(tx, 'api_check_quiz_answer', {
      p_attempt: s.attempt.id, p_question: q.single, p_answer: { option_id: opt.single.a }
    }))
    expect(check).toMatchObject({ status: 'incorrect', explanation: 'Шарҳи хато' })
    expect(check.correct_option_ids).toBeUndefined()
    await expectError(as(db, user, (tx) => rpc(tx, 'api_check_quiz_answer', {
      p_attempt: s.attempt.id, p_question: q.single, p_answer: { option_id: opt.single.b }
    })), 'already_checked')
    const final = await as(db, user, (tx) => rpc(tx, 'api_submit_quiz_attempt', {
      p_attempt: s.attempt.id, p_answers: { [q.single]: { option_id: opt.single.b } }
    }))
    expect(final.questions.find((x: any) => x.id === q.single).status).toBe('incorrect')
  })
})

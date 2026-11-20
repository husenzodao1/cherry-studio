import { beforeAll, describe, expect, it } from 'vitest'

import { buildWorld, span, type World } from './fixtures'
import { as, createDb, rpc, type Db } from './harness'

let db: Db
let w: World

beforeAll(async () => {
  db = await createDb()
  w = await buildWorld(db)
})

const school = () => as(db, null, async (tx) => ({
  card: (await rpc(tx, 'api_schools', { p_locale: 'tg' })).find((s: { slug: string }) => s.slug === 'marifati-dini'),
  detail: await rpc(tx, 'api_school', { p_key: 'marifati-dini', p_locale: 'tg' })
}))

async function publish(entity: 'lesson' | 'quiz', id: string) {
  await as(db, w.author, (tx) => rpc(tx, 'admin_transition', { p_entity: entity, p_id: id, p_to: 'in_review' }))
  await as(db, w.reviewer, (tx) => rpc(tx, 'admin_transition', { p_entity: entity, p_id: id, p_to: 'approved' }))
  await as(db, w.admin, (tx) => rpc(tx, 'admin_transition', { p_entity: entity, p_id: id, p_to: 'published' }))
}

describe('what a school shows learners', () => {
  let lesson = ''

  it('a published course with no published lesson is neither counted nor listed (no "1 курс" leading to nothing)', async () => {
    const { card, detail } = await school()
    expect(card.course_count).toBe(0)
    expect(detail.courses).toEqual([])
    expect(detail.progress.total).toBe(0)
  })

  it('once a lesson is published, the course is counted and listed, the same number in both', async () => {
    lesson = await as(db, w.author, async (tx) => {
      const id = (await tx.query<{ id: string }>('insert into public.lessons (topic_id) values ($1) returning id', [w.topic])).rows[0].id
      await tx.query("insert into public.lesson_translations (lesson_id, locale, title, ready) values ($1, 'tg', 'Дарси 1', true)", [id])
      return id
    })
    await as(db, w.author, (tx) => rpc(tx, 'admin_save_lesson_blocks', {
      p_lesson: lesson, p_expected_version: 1, p_blocks: [{ type: 'paragraph', props: {}, content: { tg: span('Матн') } }]
    }))
    await publish('lesson', lesson)
    const { card, detail } = await school()
    expect(card.course_count).toBe(1)
    expect(detail.courses.map((c: { id: string }) => c.id)).toEqual([w.course])
  })

  it('a test made in the lesson\'s "Тестҳо" tab comes with the lesson (it used to reach no one)', async () => {
    const quiz = await as(db, w.author, async (tx) => {
      const id = (await tx.query<{ id: string }>(
        "insert into public.quizzes (slug, lesson_id) values ('lesson-test', $1) returning id", [lesson])).rows[0].id
      await tx.query("insert into public.quiz_translations (quiz_id, locale, title, ready) values ($1, 'tg', 'Тести дарс', true)", [id])
      return id
    })
    await as(db, w.author, (tx) => rpc(tx, 'admin_save_quiz_question', { p_question: {
      quiz_id: quiz, type: 'single_choice', translations: { tg: { prompt: 'Савол' } },
      options: [{ ref: 'a', translations: { tg: { text: 'Ҳа' } } }, { ref: 'b', translations: { tg: { text: 'Не' } } }],
      answer_key: { correct: ['a'] }
    } }))
    // not published yet: not shown
    expect((await as(db, null, (tx) => rpc(tx, 'api_lesson', { p_lesson: lesson, p_locale: 'tg' }))).quizzes).toEqual([])
    await publish('quiz', quiz)
    const shown = await as(db, null, (tx) => rpc(tx, 'api_lesson', { p_lesson: lesson, p_locale: 'tg' }))
    expect(shown.quizzes).toEqual([expect.objectContaining({ id: quiz, title: 'Тести дарс', question_count: 1 })])
    // and the app can open it offline
    const offline = await as(db, null, (tx) => rpc(tx, 'api_offline_quiz', { p_quiz: quiz, p_locale: 'tg' }))
    expect(offline.questions).toHaveLength(1)
  })
})

import { createHash } from 'node:crypto'

import { beforeAll, describe, expect, it } from 'vitest'

import { buildWorld, type World } from './fixtures'
import { as, createDb, expectError, rpc, type Db } from './harness'

let db: Db
let w: World
let quiz: string

const hash = (code: string) => createHash('sha256').update(code).digest('hex')

beforeAll(async () => {
  db = await createDb()
  w = await buildWorld(db)
  quiz = await as(db, w.admin, async (tx) => {
    const id = (await tx.query<{ id: string }>(
      "insert into public.quizzes (slug, topic_id, pass_score_percent) values ('offline-quiz', $1, 50) returning id", [w.topic])).rows[0].id
    await tx.query("insert into public.quiz_translations (quiz_id, locale, title, ready) values ($1, 'tg', 'Тести офлайн', true)", [id])
    await rpc(tx, 'admin_save_quiz_question', { p_question: {
      quiz_id: id, type: 'single_choice', points: 1,
      translations: { tg: { prompt: 'Савол', explanation_correct: 'Офарин' } },
      options: [{ ref: 'a', translations: { tg: { text: 'Не' } } }, { ref: 'b', translations: { tg: { text: 'Ҳа' } } }],
      answer_key: { correct: ['b'] }
    } })
    for (const to of ['in_review', 'approved', 'published']) await rpc(tx, 'admin_transition', { p_entity: 'quiz', p_id: id, p_to: to })
    return id
  })
})

describe('learner profiles by code', () => {
  it('saves and loads progress under the hash of the code, from an anonymous caller', async () => {
    const h = hash('123456789012345')
    await as(db, null, (tx) => rpc(tx, 'api_profile_save', { p_code_hash: h, p_name: '  Малика ', p_data: { v: 1, lessons: { x: { p: 40 } } } }))
    const got = await as(db, null, (tx) => rpc(tx, 'api_profile_load', { p_code_hash: h }))
    expect(got.name).toBe('Малика')
    expect(got.data.lessons.x.p).toBe(40)
    await as(db, null, (tx) => rpc(tx, 'api_profile_save', { p_code_hash: h, p_name: 'Малика', p_data: { v: 1, lessons: { x: { p: 90 } } } }))
    expect((await as(db, null, (tx) => rpc(tx, 'api_profile_load', { p_code_hash: h }))).data.lessons.x.p).toBe(90)
    expect(await as(db, null, (tx) => rpc(tx, 'api_profile_load', { p_code_hash: hash('000000000000000') }))).toBeNull()
  })

  it('rejects malformed hashes and empty names, and hides the table itself', async () => {
    await expectError(as(db, null, (tx) => rpc(tx, 'api_profile_save', { p_code_hash: '123', p_name: 'A', p_data: {} })), 'validation_failed')
    await expectError(as(db, null, (tx) => rpc(tx, 'api_profile_save', { p_code_hash: hash('1'), p_name: '  ', p_data: {} })), 'validation_failed')
    const rows = await as(db, null, (tx) => tx.query('select * from public.device_profiles'))
    expect(rows.rows).toHaveLength(0)
  })
})

describe('offline content', () => {
  it('ships a published quiz with its answer key for grading on the phone', async () => {
    const payload = await as(db, null, (tx) => rpc(tx, 'api_offline_quiz', { p_quiz: quiz, p_locale: 'tg' }))
    expect(payload.quiz.title).toBe('Тести офлайн')
    expect(payload.questions).toHaveLength(1)
    const question = payload.questions[0]
    expect(question.options.map((o: { text: string }) => o.text)).toEqual(['Не', 'Ҳа'])
    const key = payload.grading[question.id].key
    expect(key.correct_option_ids).toEqual([question.options[1].id])
    expect(payload.grading[question.id].explanation_correct).toBe('Офарин')
  })

  it('does not ship draft or premium quizzes', async () => {
    await as(db, w.admin, (tx) => tx.query("update public.quizzes set access_tier = 'premium' where id = $1", [quiz]))
    expect(await as(db, null, (tx) => rpc(tx, 'api_offline_quiz', { p_quiz: quiz }))).toBeNull()
    await as(db, w.admin, (tx) => tx.query("update public.quizzes set access_tier = 'free' where id = $1", [quiz]))
  })

  it('lists only published achievements, in the requested language', async () => {
    await as(db, w.admin, async (tx) => {
      const id = (await tx.query<{ id: string }>(
        `insert into public.achievements (key, rule) values ('first-lesson', '{"type":"lessons_completed","count":1}') returning id`)).rows[0].id
      await tx.query("insert into public.achievement_translations (achievement_id, locale, title, ready) values ($1, 'tg', 'Дарси аввал', true)", [id])
      expect(await rpc(tx, 'api_achievements', { p_locale: 'tg' })).toEqual([])
      await rpc(tx, 'admin_transition', { p_entity: 'achievement', p_id: id, p_to: 'published' })
    })
    const list = await as(db, null, (tx) => rpc(tx, 'api_achievements', { p_locale: 'ru' }))
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ key: 'first-lesson', title: 'Дарси аввал', rule: { type: 'lessons_completed', count: 1 } })
  })
})

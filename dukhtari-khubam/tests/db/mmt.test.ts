import { beforeAll, describe, expect, it } from 'vitest'

import { as, createDb, createUser, expectError, rpc, type Db } from './harness'

let db: Db
let staff: string
beforeAll(async () => {
  db = await createDb()
  staff = await createUser(db, 'staff@example.com', ['editor'])
  await db.exec("create or replace function private.server_ok(p_proof text) returns boolean language sql immutable set search_path = '' as $$ select p_proof = 'test-proof' $$")
})

const admin = <T = any>(fn: string, args: Record<string, unknown> = {}) => as(db, staff, (tx) => rpc<T>(tx, fn, args))
const anon = <T = any>(fn: string, args: Record<string, unknown> = {}) => as(db, null, (tx) => rpc<T>(tx, fn, args))
const q = (question: string, difficulty: number, answer = 1, topic = 'Ҳисоб') => ({ question, options: ['1', '2', '3', '4'], answer, difficulty, topic, explanation: 'Чунки…' })

describe('ММТ', () => {
  it('the staff add subjects to clusters and import questions; the same question is not taken twice; a bad one is refused', async () => {
    await admin('admin_mmt_subject_save', { p_id: 'math', p_name: 'Математика', p_clusters: [1, 2], p_max_points: 120, p_position: 1 })
    await admin('admin_mmt_subject_save', { p_id: 'tajik', p_name: 'Забони тоҷикӣ', p_clusters: [1, 2, 3, 4, 5], p_max_points: 100, p_position: 0 })
    const list = [1, 2, 3].flatMap((d) => Array.from({ length: 4 }, (_, i) => q(`Савол ${d}-${i}`, d)))
    expect(await admin('admin_mmt_questions_import', { p_subject: 'math', p_list: list })).toBe(12)
    expect(await admin('admin_mmt_questions_import', { p_subject: 'math', p_list: [q('Савол 1-0', 1), q('Нав', 2)] })).toBe(1)
    await expectError(admin('admin_mmt_questions_import', { p_subject: 'math', p_list: [q('Ҷавоб нест', 2, 7)] }), /check constraint/)
    await expectError(admin('admin_mmt_questions_import', { p_subject: 'chem', p_list: [q('X', 2)] }), 'not_found')
    await expectError(anon('admin_mmt_questions_import', { p_subject: 'math', p_list: [] }), 'forbidden')
  })

  it('learners see the subjects and counts (never the answers); the server draws a balanced mock exam', async () => {
    const c = await anon('api_mmt_catalog')
    expect(c.subjects.map((s: { id: string }) => s.id)).toEqual(['tajik', 'math'])
    expect(c.subjects[1]).toMatchObject({ name: 'Математика', clusters: [1, 2], max_points: 120, questions: 13 })
    expect(JSON.stringify(c)).not.toContain('"answer"')
    await expectError(anon('api_mmt_draw', { p_proof: 'wrong', p_subjects: ['math'], p_per: 2 }), 'forbidden')
    const drawn = await anon('api_mmt_draw', { p_proof: 'test-proof', p_subjects: ['math'], p_per: 2 })
    expect(drawn).toHaveLength(6)
    for (const d of [1, 2, 3]) expect(drawn.filter((x: { difficulty: number }) => x.difficulty === d)).toHaveLength(2)
    expect(drawn[0]).toHaveProperty('answer')
  })

  it('programmes: a year imported again replaces that year; a cluster shows the latest year of each', async () => {
    const p = (specialty: string, year: number, min: number, form = 'budget') => ({ university: 'ДМТ', specialty, cluster: 1, year, form, min_score: min, places: 20 })
    expect(await admin('admin_mmt_programs_import', { p_list: [p('Информатика', 2025, 480), p('Иқтисод', 2025, 420)] })).toBe(2)
    expect(await admin('admin_mmt_programs_import', { p_list: [p('Информатика', 2026, 495), p('Информатика', 2026, 300, 'contract')] })).toBe(2)
    expect(await admin('admin_mmt_programs_import', { p_list: [p('Информатика', 2026, 500), p('Информатика', 2026, 310, 'contract')] })).toBe(2)
    const list = await anon('api_mmt_programs', { p_cluster: 1 })
    expect(list.map((x: { specialty: string; year: number; form: string; min_score: number }) => [x.specialty, x.year, x.form, Number(x.min_score)]))
      .toEqual([['Информатика', 2026, 'budget', 500], ['Иқтисод', 2025, 'budget', 420], ['Информатика', 2026, 'contract', 310]])
    expect(await anon('api_mmt_programs', { p_cluster: 3 })).toEqual([])
  })

  it('books on shelves: the mode\'s own shelf comes first', async () => {
    const general = await admin<string>('admin_book_start', { p_title: 'Умумӣ', p_file: null, p_pages: 1 })
    const mmt = await admin<string>('admin_book_start', { p_title: 'Китоби ММТ', p_file: null, p_pages: 1, p_shelf: 'mmt' })
    for (const [id, text] of [[general, 'Квадрати сумма ва квадрати фарқ ду бор'], [mmt, 'Квадрати сумма']] as const) {
      await admin('admin_book_chunks', { p_book: id, p_chunks: [{ n: 0, page: 1, text }] })
      await admin('admin_book_done', { p_book: id })
    }
    const query = 'квадрат:* | сумма:*'
    expect((await anon('api_books_search', { p_proof: 'test-proof', p_query: query, p_limit: 2, p_shelf: 'mmt' }))[0].book).toBe('Китоби ММТ')
    expect((await admin('admin_books')).find((b: { title: string }) => b.title === 'Китоби ММТ').shelf).toBe('mmt')
  })
})

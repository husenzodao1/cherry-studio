import { beforeAll, describe, expect, it } from 'vitest'

import { buildWorld, type World } from './fixtures'
import { as, createDb, createUser, expectError, rpc, type Db } from './harness'

let db: Db
let w: World

beforeAll(async () => {
  db = await createDb()
  w = await buildWorld(db)
})

const query = 'фотосинт:* | хлорофил:*'

describe("the student's Workspace (Premium)", () => {
  it('a Premium learner keeps her materials, finds her own passages; no one else sees them; removed, they are gone', async () => {
    const she = await createUser(db, 'student@example.test')
    const other = await createUser(db, 'other@example.test')
    // free while the plans are on: no Workspace
    expect((await as(db, she, (tx) => rpc(tx, 'api_ws_docs'))).allowed).toBe(false)
    await expectError(as(db, she, (tx) => rpc(tx, 'api_ws_start', { p_title: 'Биология', p_file: 'bio.pdf', p_subject: 'Биология', p_pages: 2 })), 'plan_limit')
    await as(db, w.admin, (tx) => rpc(tx, 'admin_grant_plan', { p_email: 'student@example.test', p_tier: 'premium', p_months: 1 }))

    const doc = await as(db, she, (tx) => rpc<string>(tx, 'api_ws_start', { p_title: 'Лексияи биология', p_file: 'bio.pdf', p_subject: 'Биология', p_pages: 2 }))
    expect(await as(db, she, (tx) => rpc(tx, 'api_ws_chunks', { p_doc: doc, p_chunks: [
      { n: 0, page: 1, text: 'Фотосинтез дар хлоропластҳо мегузарад; хлорофилл нури офтобро мегирад.' },
      { n: 1, page: 2, text: 'Ҳуҷайра воҳиди асосии ҳаёт аст.' }
    ] }))).toBe(2)
    await as(db, she, (tx) => rpc(tx, 'api_ws_done', { p_doc: doc }))
    const mine = await as(db, she, (tx) => rpc(tx, 'api_ws_docs'))
    expect(mine.allowed).toBe(true)
    expect(mine.docs).toMatchObject([{ id: doc, title: 'Лексияи биология', subject: 'Биология', chunks: 2, status: 'ready' }])

    const found = await as(db, she, (tx) => rpc<{ book: string; page: number; text: string }[]>(tx, 'api_ws_search', { p_query: query }))
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ book: 'Лексияи биология', page: 1 })
    // another learner: nothing of hers, and cannot add to or remove her material
    expect(await as(db, other, (tx) => rpc(tx, 'api_ws_search', { p_query: query }))).toEqual([])
    expect((await as(db, other, (tx) => rpc(tx, 'api_ws_docs'))).docs).toEqual([])
    await expectError(as(db, other, (tx) => rpc(tx, 'api_ws_chunks', { p_doc: doc, p_chunks: [{ n: 5, text: 'x'.repeat(30) }] })), 'not_found')
    await expectError(as(db, other, (tx) => rpc(tx, 'api_ws_remove', { p_doc: doc })), 'not_found')
    // without an account: nothing at all
    await expectError(as(db, null, (tx) => rpc(tx, 'api_ws_docs')), 'permission denied')

    await as(db, she, (tx) => rpc(tx, 'api_ws_remove', { p_doc: doc }))
    expect(await as(db, she, (tx) => rpc(tx, 'api_ws_search', { p_query: query }))).toEqual([])
    const { rows } = await db.query<{ n: number }>('select count(*)::int as n from private.workspace_chunks')
    expect(rows[0].n).toBe(0)
  })
})

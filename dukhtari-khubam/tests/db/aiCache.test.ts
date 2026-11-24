import { beforeAll, describe, expect, it } from 'vitest'

import { as, createDb, expectError, rpc, type Db } from './harness'

let db: Db
beforeAll(async () => {
  db = await createDb()
  await db.exec("create or replace function private.server_ok(p_proof text) returns boolean language sql immutable set search_path = '' as $$ select p_proof = 'test-proof' $$")
})

describe("Mahliyo's kept answers and search results", () => {
  it('kept by the server, given again within its days, counted; no one else may read or write', async () => {
    const value = { tajik: true, reply: 'x', blocks: [{ type: 'text', text: 'x' }] }
    await as(db, null, (tx) => rpc(tx, 'api_cache_put', { p_proof: 'test-proof', p_kind: 'answer', p_key: 'tg||g|хучайра чи', p_value: value }))
    expect(await as(db, null, (tx) => rpc(tx, 'api_cache_get', { p_proof: 'test-proof', p_kind: 'answer', p_key: 'tg||g|хучайра чи', p_days: 30 }))).toEqual(value)
    // too old for a week's search results
    await db.query("update private.ai_cache set at = now() - interval '10 days'")
    expect(await as(db, null, (tx) => rpc(tx, 'api_cache_get', { p_proof: 'test-proof', p_kind: 'answer', p_key: 'tg||g|хучайра чи', p_days: 7 }))).toBeNull()
    expect((await db.query<{ hits: number }>('select hits from private.ai_cache')).rows[0].hits).toBe(1)
    await expectError(as(db, null, (tx) => rpc(tx, 'api_cache_get', { p_proof: 'no', p_kind: 'answer', p_key: 'x', p_days: 1 })), 'forbidden')
    await expectError(as(db, null, (tx) => rpc(tx, 'api_cache_put', { p_proof: 'test-proof', p_kind: 'secret', p_key: 'x', p_value: {} })), /check constraint/)
  })
})

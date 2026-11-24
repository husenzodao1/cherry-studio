import { beforeAll, describe, expect, it } from 'vitest'

import { as, createDb, expectError, rpc, type Db } from './harness'

let db: Db
beforeAll(async () => {
  db = await createDb()
  await db.exec("create or replace function private.server_ok(p_proof text) returns boolean language sql immutable set search_path = '' as $$ select p_proof = 'test-proof' $$")
})

describe('songs found on YouTube, kept for everyone', () => {
  it('the server keeps a search and finds it again (any spelling of spaces and case); no one else may', async () => {
    const songs = [{ id: 'dQw4w9WgXcQ', title: 'Суруд', channel: 'Канал', thumb: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg' }]
    expect(await as(db, null, (tx) => rpc(tx, 'api_music_cached', { p_proof: 'test-proof', p_q: 'Шабнам Сурайё' }))).toBeNull()
    await as(db, null, (tx) => rpc(tx, 'api_music_keep', { p_proof: 'test-proof', p_q: 'Шабнам Сурайё', p_items: songs }))
    expect(await as(db, null, (tx) => rpc(tx, 'api_music_cached', { p_proof: 'test-proof', p_q: ' шабнам сурайё ' }))).toEqual(songs)
    await expectError(as(db, null, (tx) => rpc(tx, 'api_music_cached', { p_proof: 'wrong', p_q: 'x' })), 'forbidden')
  })
})

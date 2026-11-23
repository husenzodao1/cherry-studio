import { beforeAll, describe, expect, it } from 'vitest'

import { buildWorld, type World } from './fixtures'
import { as, createDb, createUser, expectError, rpc, type Db } from './harness'

let db: Db
let w: World

beforeAll(async () => {
  db = await createDb()
  w = await buildWorld(db)
  await db.exec("create or replace function private.server_ok(p_proof text) returns boolean language sql immutable set search_path = '' as $$ select p_proof = 'test-proof' $$")
})

const P = 'test-proof'

describe('Mahliyo in Telegram (Premium)', () => {
  it('a code made in the app links her Telegram once; the bot knows her and her plan; groups she turns on are hers; unlinked, all is gone', async () => {
    const she = await createUser(db, 'tg@example.test')
    // without Premium (the plans on): no code
    await expectError(as(db, she, (tx) => rpc(tx, 'api_tg_code')), 'plan_limit')
    await as(db, w.admin, (tx) => rpc(tx, 'admin_grant_plan', { p_email: 'tg@example.test', p_tier: 'premium', p_months: 1 }))
    const code = await as(db, she, (tx) => rpc<string>(tx, 'api_tg_code'))
    expect(code).toMatch(/^[A-Za-z0-9]{12}$/)

    // a stranger's code, a wrong proof: nothing
    expect((await rpc(db, 'api_tg_link', { p_proof: P, p_code: 'AAAAAAAAAAAA', p_tg_user: 777, p_tg_name: 'malika' })).linked).toBe(false)
    await expectError(rpc(db, 'api_tg_link', { p_proof: 'wrong', p_code: code, p_tg_user: 777, p_tg_name: 'malika' }), 'forbidden')
    expect(await rpc(db, 'api_tg_link', { p_proof: P, p_code: code, p_tg_user: 777, p_tg_name: 'malika' })).toEqual({ linked: true, plan: 'premium' })
    // spent
    expect((await rpc(db, 'api_tg_link', { p_proof: P, p_code: code, p_tg_user: 888, p_tg_name: 'x' })).linked).toBe(false)
    expect(await as(db, she, (tx) => rpc(tx, 'api_tg_status'))).toMatchObject({ linked: true, name: 'malika', allowed: true })

    const who = await rpc(db, 'api_tg_who', { p_proof: P, p_tg_user: 777, p_chat: 777 })
    expect(who).toMatchObject({ user: she, allowed: true, chat_owner: null, turns: [] })
    expect((await rpc(db, 'api_tg_who', { p_proof: P, p_tg_user: 999, p_chat: 999 })).allowed).toBe(false)

    // a group she turns on: its owner is she, its turns kept (the last 16)
    const turns = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `т${i}` }))
    await rpc(db, 'api_tg_chat', { p_proof: P, p_chat: -100123, p_owner: she, p_group: true, p_turns: turns })
    const inGroup = await rpc(db, 'api_tg_who', { p_proof: P, p_tg_user: 555, p_chat: -100123 })
    expect(inGroup).toMatchObject({ allowed: false, chat_owner: she, chat_allowed: true })
    expect(inGroup.turns).toHaveLength(16)
    expect(inGroup.turns[15].content).toBe('т19')

    await as(db, she, (tx) => rpc(tx, 'api_tg_unlink'))
    expect((await as(db, she, (tx) => rpc(tx, 'api_tg_status'))).linked).toBe(false)
    expect((await rpc(db, 'api_tg_who', { p_proof: P, p_tg_user: 777, p_chat: -100123 })).chat_owner).toBeNull()
  })
})

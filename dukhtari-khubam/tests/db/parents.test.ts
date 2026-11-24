import { beforeAll, describe, expect, it } from 'vitest'

import { as, createDb, rpc, type Db } from './harness'

let db: Db
beforeAll(async () => { db = await createDb() })
const call = <T = any>(fn: string, args: Record<string, unknown>) => as(db, null, (tx) => rpc<T>(tx, fn, args))
const CODE = '811111111111111'

describe("the parents' view", () => {
  it('her link shows her parents only the summary her phone wrote; taken back, it stops at once', async () => {
    await call('api_profile_push', { p_code: CODE, p_name: 'Малика Каримова', p_data: { v: '1' } })
    // no link yet: the summary is not kept
    expect(await call('api_parent_summary', { p_code: CODE, p_summary: { streak: 3 } })).toBe(false)
    const { token } = await call('api_parent_link', { p_code: CODE })
    expect(token).toMatch(/^[0-9a-f]{32}$/)
    // asked again: the same link
    expect((await call('api_parent_link', { p_code: CODE })).token).toBe(token)
    expect(await call('api_parent_summary', { p_code: CODE, p_summary: { streak: 5, lessons: 12 } })).toBe(true)
    expect(await call('api_parent_view', { p_token: token })).toMatchObject({ name: 'Малика', summary: { streak: 5, lessons: 12 } })
    expect(await call('api_parent_view', { p_token: 'f'.repeat(32) })).toBeNull()
    await call('api_parent_unlink', { p_code: CODE })
    expect(await call('api_parent_view', { p_token: token })).toBeNull()
    // a new link is a new address
    expect((await call('api_parent_link', { p_code: CODE })).token).not.toBe(token)
  })
})

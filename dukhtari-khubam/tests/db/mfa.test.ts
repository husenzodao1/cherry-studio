import { beforeAll, describe, expect, it } from 'vitest'

import { buildWorld, type World } from './fixtures'
import { as, createDb, createUser, rpc, type Db, type Tx } from './harness'

let db: Db
let w: World

beforeAll(async () => {
  db = await createDb()
  w = await buildWorld(db)
})

/** her session with its assurance level (aal1: password or code only; aal2: the second step passed) */
const at = <T>(user: string, aal: 'aal1' | 'aal2', fn: (tx: Tx) => Promise<T>) => db.transaction(async (tx) => {
  await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: 'authenticated', aal })])
  await tx.exec('set local role authenticated')
  return fn(tx)
})

describe('two-step sign-in for paid accounts', () => {
  it('with the second step on, her plan counts only in a session that passed it', async () => {
    const she = await createUser(db, 'paid@example.test')
    await as(db, w.admin, (tx) => rpc(tx, 'admin_grant_plan', { p_email: 'paid@example.test', p_tier: 'premium', p_months: 1 }))
    // no second step yet: Premium in any session
    expect((await at(she, 'aal1', (tx) => rpc(tx, 'api_my_plan'))).plan).toBe('premium')
    expect(await at(she, 'aal1', (tx) => rpc(tx, 'api_my_mfa'))).toEqual({ enabled: false, passed: false })

    await db.query("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [she])
    // a password alone (a stolen one): a free account
    expect((await at(she, 'aal1', (tx) => rpc(tx, 'api_my_plan'))).plan).toBe('free')
    expect(await at(she, 'aal1', (tx) => rpc(tx, 'api_my_mfa'))).toEqual({ enabled: true, passed: false })
    // the code from her authenticator: Premium again
    expect((await at(she, 'aal2', (tx) => rpc(tx, 'api_my_plan'))).plan).toBe('premium')
  })
})

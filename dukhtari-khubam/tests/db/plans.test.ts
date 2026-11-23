import { beforeAll, describe, expect, it } from 'vitest'

import { buildWorld, type World } from './fixtures'
import { as, createDb, createUser, expectError, rpc, type Db } from './harness'

let db: Db
let w: World

beforeAll(async () => {
  db = await createDb()
  w = await buildWorld(db)
  // the server's proof, for these tests only
  await db.exec("create or replace function private.server_ok(p_proof text) returns boolean language sql immutable set search_path = '' as $$ select p_proof = 'test-proof' $$")
})

const lockedOf = async (user: string | null) => (await as(db, user, (tx) => rpc(tx, 'api_course', { p_course: w.course }))).locked as boolean
const setTier = (tier: string) => as(db, w.admin, (tx) => rpc(tx, 'admin_set_tier', { p_kind: 'course', p_id: w.course, p_tier: tier }))

describe('plans: free, Standard, Premium', () => {
  it('a Standard course opens with Standard and Premium, a Premium course only with Premium; staff open everything', async () => {
    await setTier('standard')
    expect(await lockedOf(w.reader)).toBe(true)
    expect((await as(db, w.reader, (tx) => rpc(tx, 'api_my_plan'))).plan).toBe('free')
    await as(db, w.admin, (tx) => rpc(tx, 'admin_grant_plan', { p_email: 'reader@example.test', p_tier: 'standard', p_months: 1 }))
    expect((await as(db, w.reader, (tx) => rpc(tx, 'api_my_plan'))).plan).toBe('standard')
    expect(await lockedOf(w.reader)).toBe(false)
    await setTier('premium')
    expect(await lockedOf(w.reader)).toBe(true)
    expect(await lockedOf(w.author)).toBe(false)
    expect((await as(db, w.admin, (tx) => rpc(tx, 'api_my_plan'))).plan).toBe('premium')
    await setTier('free')
    expect(await lockedOf(null)).toBe(false)
  })

  it('counts what Mahliyo does under each limit (the server only)', async () => {
    const use = (limit: number) => rpc(db, 'api_plan_use', { p_proof: 'test-proof', p_who: 'user-00000001', p_kind: 'message', p_period: 'd2026-11-23', p_limit: limit })
    expect(await use(2)).toMatchObject({ ok: true, used: 1 })
    expect(await use(2)).toMatchObject({ ok: true, used: 2 })
    expect(await use(2)).toMatchObject({ ok: false, used: 2 })
    expect(await use(-1)).toMatchObject({ ok: true, used: 3 })
    await expectError(rpc(db, 'api_plan_use', { p_proof: 'wrong', p_who: 'user-00000001', p_kind: 'message', p_period: 'd2026-11-23', p_limit: 5 }), 'forbidden')
  })

  it('Paddle: a subscription is one entitlement, kept up to date; its plan is the learner\'s', async () => {
    const buyer = await createUser(db, 'buyer@example.test')
    const write = (tier: string, ends: string) => rpc(db, 'api_paddle_entitlement', {
      p_proof: 'test-proof', p_user: buyer, p_subscription: 'sub_01', p_tier: tier, p_starts: new Date().toISOString(), p_ends: ends, p_auto_renew: true
    })
    const month = new Date(Date.now() + 30 * 86_400_000).toISOString()
    expect((await write('standard', month)).plan).toBe('standard')
    expect((await write('premium', month)).plan).toBe('premium')
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.entitlements where paddle_subscription = 'sub_01'")
    expect(rows[0].n).toBe(1)
  })

  it('a Premium gift: three days for a friend, once, never for oneself', async () => {
    const giver = await createUser(db, 'giver@example.test')
    const friend = await createUser(db, 'friend@example.test')
    const code = await rpc<string>(db, 'api_make_gift', { p_proof: 'test-proof', p_user: giver, p_days: 3 })
    expect(code).toMatch(/^[A-Z0-9]{8}$/)
    await expectError(as(db, giver, (tx) => rpc(tx, 'api_redeem_gift', { p_code: code })), 'conflict')
    expect((await as(db, friend, (tx) => rpc(tx, 'api_redeem_gift', { p_code: code.toLowerCase() }))).plan).toBe('premium')
    await expectError(as(db, w.reader, (tx) => rpc(tx, 'api_redeem_gift', { p_code: code })), 'conflict')
    expect((await as(db, giver, (tx) => rpc(tx, 'api_my_plan'))).gifts).toEqual([{ code, days: 3, redeemed: true }])
  })

  it('Standard\'s free Premium week: only from the second month, only once', async () => {
    const learner = await createUser(db, 'standard@example.test')
    await expectError(as(db, learner, (tx) => rpc(tx, 'api_claim_premium_week')), 'not_allowed')
    await db.query("insert into public.entitlements (user_id, tier, source, starts_at, ends_at) values ($1, 'standard', 'payment', now() - interval '29 days', now() + interval '20 days')", [learner])
    expect((await as(db, learner, (tx) => rpc(tx, 'api_claim_premium_week'))).plan).toBe('premium')
    await expectError(as(db, learner, (tx) => rpc(tx, 'api_claim_premium_week')), 'conflict')
  })
})

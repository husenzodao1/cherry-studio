import { beforeAll, describe, expect, it } from 'vitest'

import { as, createDb, expectError, rpc, type Db } from './harness'

let db: Db
beforeAll(async () => { db = await createDb() })

const MALIKA = '611111111111111', OTHER = '622222222222222'
const call = <T = any>(fn: string, args: Record<string, unknown>) => as(db, null, (tx) => rpc<T>(tx, fn, args))
const push = (code: string, name: string) => call('api_profile_push', { p_code: code, p_name: name, p_data: { v: '1' } })

describe('SOS', () => {
  it('her people: at most three, numbers kept as digits; a bad number refused', async () => {
    await push(MALIKA, 'Малика Каримова')
    await push(OTHER, 'Зарина')
    expect(await call('api_sos_set_guardians', { p_code: MALIKA, p_list: [{ name: 'Модар', phone: '+992 90 123-45-67' }, { name: 'Падар', phone: '992911234567' }] }))
      .toEqual([{ name: 'Модар', phone: '992901234567' }, { name: 'Падар', phone: '992911234567' }])
    await expectError(call('api_sos_set_guardians', { p_code: MALIKA, p_list: [{ name: 'X', phone: '123' }] }), 'bad_phone')
    await expectError(call('api_sos_set_guardians', { p_code: MALIKA, p_list: [1, 2, 3, 4].map((i) => ({ name: `G${i}`, phone: `99290000000${i}` })) }), 'validation_failed')
    // the refused change rolled back: her two people are still there
    expect(await call('api_sos_guardians', { p_code: MALIKA })).toHaveLength(2)
  })

  it('an SOS opens a live map by token; a second press goes on with it; "safe" closes it', async () => {
    const a = await call('api_sos_start', { p_code: MALIKA, p_kind: 'sos', p_lat: 38.56, p_lng: 68.78, p_accuracy: 12 })
    expect(a).toMatchObject({ kind: 'sos', new: true, name: 'Малика', guardians: [{ name: 'Модар' }, { name: 'Падар' }] })
    expect(a.token).toMatch(/^[0-9a-f]{24}$/)
    const again = await call('api_sos_start', { p_code: MALIKA, p_kind: 'sos', p_lat: 38.57, p_lng: 68.79 })
    expect(again).toMatchObject({ token: a.token, new: false })
    expect(await call('api_sos_update', { p_code: MALIKA, p_token: a.token, p_lat: 38.58, p_lng: 68.8, p_battery: 41 })).toEqual({ open: true })
    // someone else's code cannot move her place
    expect(await call('api_sos_update', { p_code: OTHER, p_token: a.token, p_lat: 1, p_lng: 1 })).toEqual({ open: false })
    expect(await call('api_sos_where', { p_token: a.token })).toMatchObject({ name: 'Малика', open: true, lat: 38.58, lng: 68.8, battery: 41 })
    expect(await call('api_sos_stop', { p_code: MALIKA, p_token: a.token, p_safe: true })).toMatchObject({ stopped: true, kind: 'sos', lat: 38.58 })
    // closed: the map no longer shows where she is
    expect(await call('api_sos_where', { p_token: a.token })).toMatchObject({ open: false, safe: true, lat: null, lng: null })
    expect(await call('api_sos_where', { p_token: 'nottoken' })).toBeNull()
  })

  it('a walk home has a due time; a bad code or a wrong kind is refused; at most 8 alerts a day', async () => {
    const w = await call('api_sos_start', { p_code: MALIKA, p_kind: 'walk', p_lat: 38.5, p_lng: 68.7, p_minutes: 25 })
    expect(new Date(w.due_at).getTime() - Date.now()).toBeGreaterThan(24 * 60_000)
    await expectError(call('api_sos_start', { p_code: MALIKA, p_kind: 'walk', p_lat: 1, p_lng: 1, p_minutes: 1 }), 'validation_failed')
    await expectError(call('api_sos_start', { p_code: MALIKA, p_kind: 'party', p_lat: 1, p_lng: 1 }), 'validation_failed')
    await expectError(call('api_sos_start', { p_code: '000', p_kind: 'sos', p_lat: 1, p_lng: 1 }), 'unauthorized')
    await call('api_sos_stop', { p_code: MALIKA, p_token: w.token })
    for (let i = 0; i < 6; i++) {
      const a = await call('api_sos_start', { p_code: MALIKA, p_kind: 'sos', p_lat: 1, p_lng: 1 })
      await call('api_sos_stop', { p_code: MALIKA, p_token: a.token })
    }
    await expectError(call('api_sos_start', { p_code: MALIKA, p_kind: 'sos', p_lat: 1, p_lng: 1 }), 'rate_limited')
  })
})

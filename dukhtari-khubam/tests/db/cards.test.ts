import { beforeAll, describe, expect, it } from 'vitest'

import { as, createDb, expectError, rpc, type Db } from './harness'

let db: Db
beforeAll(async () => { db = await createDb() })
const call = <T = any>(fn: string, args: Record<string, unknown>) => as(db, null, (tx) => rpc<T>(tx, fn, args))
const CODE = '711111111111111', OTHER = '722222222222222'

describe('flashcard decks', () => {
  it('a deck is kept by her code; an older write never replaces a newer one; others cannot see it', async () => {
    await call('api_profile_push', { p_code: CODE, p_name: 'Малика', p_data: { v: '1' } })
    await call('api_profile_push', { p_code: OTHER, p_name: 'Зарина', p_data: { v: '1' } })
    const cards = [{ id: 'c1', f: 'H₂O', b: 'Об', at: '2026-11-24T10:00:00Z' }]
    expect(await call('api_deck_put', { p_code: CODE, p_id: 'd1', p_title: 'Химия', p_source: 'text', p_cards: cards, p_at: '2026-11-24T10:00:00Z' })).toMatchObject({ kept: true })
    expect(await call('api_deck_put', { p_code: CODE, p_id: 'd1', p_title: 'Кӯҳна', p_source: 'text', p_cards: [], p_at: '2026-11-23T10:00:00Z' })).toMatchObject({ kept: false })
    const mine = await call('api_decks', { p_code: CODE })
    expect(mine).toMatchObject([{ id: 'd1', title: 'Химия', cards, del: false }])
    expect(await call('api_decks', { p_code: OTHER })).toEqual([])
    await expectError(call('api_decks', { p_code: '1' }), 'unauthorized')
    await expectError(call('api_deck_put', { p_code: CODE, p_id: 'bad id!', p_title: 'x', p_source: 'text', p_cards: [], p_at: '2026-11-24T10:00:00Z' }), /check constraint/)
  })

  it('a deck removed is kept as removed (so other phones remove it too)', async () => {
    await call('api_deck_put', { p_code: CODE, p_id: 'd1', p_title: 'Химия', p_source: 'text', p_cards: [], p_at: '2026-11-24T11:00:00Z', p_deleted: true })
    expect((await call('api_decks', { p_code: CODE }))[0]).toMatchObject({ id: 'd1', del: true })
  })
})

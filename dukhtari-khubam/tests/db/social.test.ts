import { beforeAll, describe, expect, it } from 'vitest'

import { as, createDb, expectError, rpc, type Db } from './harness'

let db: Db
beforeAll(async () => { db = await createDb() })

/** a profile as the phone first sends it (its code, name, year of birth) */
const push = (code: string, name: string, born?: number) =>
  as(db, null, (tx) => rpc(tx, 'api_profile_push', { p_code: code, p_name: name, p_data: { v: '1', ...(born ? { born } : {}), achievements: { a1: {}, a2: {} }, lessons: { l1: {} } } }))
const call = <T = any>(fn: string, args: Record<string, unknown>) => as(db, null, (tx) => rpc<T>(tx, fn, args))

const MALIKA = '111111111111111', MALIKA2 = '222222222222222', ZARINA = '333333333333333', SITORA = '444444444444444', TEACHER = '555555555555555'

describe('logins, profiles and contacts', () => {
  it('a login made from the name, Tajik letters in Latin, a number when taken; she may change it', async () => {
    await push(MALIKA, 'Малика Каримова', 2002)
    await push(MALIKA2, 'Малика Каримова', 2003)
    await push(ZARINA, 'Зарина Ҳусейнова', 2001)
    expect((await call('api_social_me', { p_code: MALIKA })).login).toBe('malika.karimova')
    expect((await call('api_social_me', { p_code: MALIKA2 })).login).toBe('malika.karimova2')
    expect((await call('api_social_me', { p_code: ZARINA })).login).toBe('zarina.husejnova'.replace('j', 'y'))
    expect(await call('api_social_set_login', { p_code: MALIKA, p_login: 'Malika_K' })).toEqual({ login: 'malika_k' })
    await expectError(call('api_social_set_login', { p_code: MALIKA2, p_login: 'malika_k' }), 'login_taken')
    await expectError(call('api_social_set_login', { p_code: MALIKA2, p_login: 'a b' }), 'bad_login')
  })

  it('anyone sees a profile by its login; her links only after she accepts a request', async () => {
    expect(await call('api_social_set_links', { p_code: MALIKA, p_links: { whatsapp: '+992 900-00-00-01', telegram: '@malika_k', instagram: 'https://instagram.com/malika.k/', other: 'x' } }))
      .toEqual({ whatsapp: '+992900000001', telegram: 'malika_k', instagram: 'malika.k' })
    const seen = await call('api_social_profile', { p_login: 'malika_k', p_code: ZARINA })
    expect(seen).toMatchObject({ login: 'malika_k', name: 'Малика К.', achievements: 2, lessons: 1, links: null, status: 'none', can_request: true })
    expect(seen.has.sort()).toEqual(['instagram', 'telegram', 'whatsapp'])
    expect(await call('api_social_request', { p_code: ZARINA, p_login: 'malika_k', p_note: 'Салом!' })).toEqual({ status: 'sent' })
    expect((await call('api_social_me', { p_code: MALIKA })).requests).toBe(1)
    expect((await call('api_social_requests', { p_code: MALIKA })).received).toMatchObject([{ name: 'Зарина', note: 'Салом!' }])
    expect(await call('api_social_answer', { p_code: MALIKA, p_login: (await call('api_social_me', { p_code: ZARINA })).login, p_accept: true })).toEqual({ status: 'contact' })
    expect((await call('api_social_profile', { p_login: 'malika_k', p_code: ZARINA })).links).toEqual({ whatsapp: '+992900000001', telegram: 'malika_k', instagram: 'malika.k' })
    // a stranger without the code: no links
    expect((await call('api_social_profile', { p_login: 'malika_k' })).links).toBeNull()
  })

  it('under 16 (or the age not known): requests only from someone in her class', async () => {
    await push(SITORA, 'Ситора', 2014)
    await push(TEACHER, 'Муаллима Нигина', 1990)
    const sitora = (await call('api_social_me', { p_code: SITORA })).login
    expect((await call('api_social_profile', { p_login: sitora, p_code: ZARINA })).can_request).toBe(false)
    await expectError(call('api_social_request', { p_code: ZARINA, p_login: sitora }), 'not_allowed')
    // the teacher makes a class, Sitora joins it: the teacher may write to her
    const cls = await call('api_class_create', { p_code: TEACHER, p_name: '9 «А»' })
    expect(cls.join_code).toMatch(/^[A-Z0-9]{6}$/)
    await call('api_class_join', { p_code: SITORA, p_join: cls.join_code.toLowerCase() })
    expect(await call('api_social_request', { p_code: TEACHER, p_login: sitora })).toEqual({ status: 'sent' })
    // her login can be found by its beginning, never by name
    expect(await call('api_social_search', { p_query: 'sit' })).toEqual([{ login: sitora, name: 'Ситора' }])
    expect(await call('api_social_search', { p_query: 'Сит' })).toEqual([])
  })

  it('blocked: no request, no profile, the contact gone; the report kept for the staff', async () => {
    const zarina = (await call('api_social_me', { p_code: ZARINA })).login
    await call('api_social_block', { p_code: MALIKA, p_login: zarina, p_reason: 'Паёмҳои бад' })
    expect((await call('api_social_requests', { p_code: MALIKA })).contacts).toEqual([])
    await expectError(call('api_social_profile', { p_login: 'malika_k', p_code: ZARINA }), 'not_found')
    await expectError(call('api_social_request', { p_code: ZARINA, p_login: 'malika_k' }), /not_found|not_allowed/)
    expect((await db.query('select reason from public.social_reports')).rows).toEqual([{ reason: 'Паёмҳои бад' }])
    await expectError(call('api_social_me', { p_code: '000' }), 'unauthorized')
  })
})

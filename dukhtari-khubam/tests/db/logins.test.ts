import { createHash } from 'node:crypto'

import { beforeAll, describe, expect, it } from 'vitest'

import { as, createDb, createUser, expectError, rpc, type Db } from './harness'

let db: Db
let owner: string
let editor: string
const hash = (s: string) => createHash('sha256').update(s).digest('hex')
const code = '123456789012345'

beforeAll(async () => {
  db = await createDb()
  owner = await createUser(db, 'owner@example.com', ['super_admin'])
  editor = await createUser(db, 'editor@example.com', ['editor'])
  await as(db, null, (tx) => rpc(tx, 'api_profile_save', { p_code_hash: hash(code), p_name: 'Малика', p_data: { v: 1 } }))
})

describe('learner login and password', () => {
  it('sets a unique login for the profile whose code the caller knows', async () => {
    expect(await as(db, null, (tx) => rpc(tx, 'api_profile_username_free', { p_username: 'Malika' }))).toBe(true)
    const r = await as(db, null, (tx) => rpc(tx, 'api_profile_set_login', { p_code_hash: hash(code), p_username: ' Malika ', p_password: 'gul-123', p_code_enc: 'v1.enc' }))
    expect(r.username).toBe('malika')
    expect(await as(db, null, (tx) => rpc(tx, 'api_profile_username_free', { p_username: 'MALIKA' }))).toBe(false)
    const other = hash('987654321098765')
    await as(db, null, (tx) => rpc(tx, 'api_profile_save', { p_code_hash: other, p_name: 'Нигина', p_data: { v: 1 } }))
    await expectError(as(db, null, (tx) => rpc(tx, 'api_profile_set_login', { p_code_hash: other, p_username: 'malika', p_password: 'xxxxxx', p_code_enc: 'v1' })), 'username_taken')
    await expectError(as(db, null, (tx) => rpc(tx, 'api_profile_set_login', { p_code_hash: other, p_username: 'ab', p_password: 'xxxxxx', p_code_enc: 'v1' })), 'validation_failed')
  })

  it('returns the profile and the encrypted code for the right password only, and stores no plain password', async () => {
    const ok = await as(db, null, (tx) => rpc(tx, 'api_profile_login', { p_username: 'malika', p_password: 'gul-123' }))
    expect(ok).toMatchObject({ name: 'Малика', username: 'malika', code_enc: 'v1.enc', code: null, must_change: false })
    expect((await as(db, null, (tx) => rpc(tx, 'api_profile_login', { p_username: 'malika', p_password: 'wrong' }))).error).toBe('invalid_login')
    expect((await as(db, null, (tx) => rpc(tx, 'api_profile_login', { p_username: 'nobody', p_password: 'gul-123' }))).error).toBe('invalid_login')
    const stored = (await db.query<{ password_hash: string }>("select password_hash from public.device_profiles where username = 'malika'")).rows[0]
    expect(stored.password_hash.startsWith('$2')).toBe(true)
  })

  it('locks the login for a while after 8 wrong passwords in a row', async () => {
    for (let i = 0; i < 7; i++) await as(db, null, (tx) => rpc(tx, 'api_profile_login', { p_username: 'malika', p_password: 'wrong' }))
    expect((await as(db, null, (tx) => rpc(tx, 'api_profile_login', { p_username: 'malika', p_password: 'gul-123' }))).error).toBe('locked')
    await db.query("update public.device_profiles set locked_until = null where username = 'malika'")
  })

  it('lets only a super admin issue a temporary password; the next login hands over a new code once', async () => {
    await expectError(as(db, editor, (tx) => rpc(tx, 'admin_profile_reset', { p_username: 'malika' })), 'forbidden')
    const reset = await as(db, owner, (tx) => rpc(tx, 'admin_profile_reset', { p_username: 'malika' }))
    expect(reset.password).toMatch(/^[a-z2-9]{10}$/)
    const r = await as(db, null, (tx) => rpc(tx, 'api_profile_login', { p_username: 'malika', p_password: reset.password }))
    expect(r.code).toMatch(/^[1-9][0-9]{14}$/)
    expect(r.must_change).toBe(true)
    expect(r.name).toBe('Малика')
    // the profile now answers to the new code; choosing a new password clears the one-time code
    expect((await as(db, null, (tx) => rpc(tx, 'api_profile_load', { p_code_hash: hash(r.code) }))).name).toBe('Малика')
    await as(db, null, (tx) => rpc(tx, 'api_profile_set_login', { p_code_hash: hash(r.code), p_username: 'malika', p_password: 'nav-parol', p_code_enc: 'v1.new' }))
    const again = await as(db, null, (tx) => rpc(tx, 'api_profile_login', { p_username: 'malika', p_password: 'nav-parol' }))
    expect(again).toMatchObject({ code: null, must_change: false, code_enc: 'v1.new' })
  })
})

describe('support chat', () => {
  const token = hash('phone-token')
  it('lets a phone write without an account and staff answer it', async () => {
    const t = await as(db, null, (tx) => rpc(tx, 'api_support_send', { p_token_hash: token, p_name: 'Малика', p_username: 'Malika', p_body: ' Кодро гум кардам ' }))
    expect(t.messages).toHaveLength(1)
    expect(t.messages[0]).toMatchObject({ from_staff: false, body: 'Кодро гум кардам' })
    await expectError(as(db, null, (tx) => rpc(tx, 'admin_support_threads')), 'forbidden')
    const list = await as(db, editor, (tx) => rpc(tx, 'admin_support_threads'))
    expect(list[0]).toMatchObject({ username: 'malika', unread_staff: 1, last_body: 'Кодро гум кардам' })
    await as(db, editor, (tx) => rpc(tx, 'admin_support_reply', { p_thread: t.id, p_body: 'Пароли муваққатӣ: …' }))
    expect(await as(db, null, (tx) => rpc(tx, 'api_support_unread', { p_token_hash: token }))).toBe(1)
    const mine = await as(db, null, (tx) => rpc(tx, 'api_support_thread', { p_token_hash: token }))
    expect(mine.messages.map((m: { from_staff: boolean }) => m.from_staff)).toEqual([false, true])
    expect(await as(db, null, (tx) => rpc(tx, 'api_support_unread', { p_token_hash: token }))).toBe(0)
    expect((await as(db, editor, (tx) => rpc(tx, 'admin_support_thread', { p_thread: t.id }))).unread_staff).toBe(0)
  })

  it('keeps threads private to their phone and limits flooding', async () => {
    expect(await as(db, null, (tx) => rpc(tx, 'api_support_thread', { p_token_hash: hash('other-phone') }))).toBeNull()
    await expect(db.query('select * from public.support_messages')).resolves.toBeDefined()
    const anonRead = as(db, null, (tx) => tx.query('select * from public.support_messages'))
    await expect(anonRead.then((r) => r.rows.length)).resolves.toBe(0)
    const flood = hash('flood')
    for (let i = 0; i < 30; i++) await as(db, null, (tx) => rpc(tx, 'api_support_send', { p_token_hash: flood, p_name: null, p_username: null, p_body: `m${i}` }))
    await expectError(as(db, null, (tx) => rpc(tx, 'api_support_send', { p_token_hash: flood, p_name: null, p_username: null, p_body: 'one more' })), 'rate_limited')
  })
})

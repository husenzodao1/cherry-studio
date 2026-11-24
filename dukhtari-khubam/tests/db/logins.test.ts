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
    // the login made from her name is hers to take; to anyone else it is taken
    expect(await as(db, null, (tx) => rpc(tx, 'api_profile_username_free', { p_username: 'Malika', p_code_hash: hash(code) }))).toBe(true)
    expect(await as(db, null, (tx) => rpc(tx, 'api_profile_username_free', { p_username: 'Malika' }))).toBe(false)
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
    // her message, and at once Mahliyo's answer while no consultant is there
    expect(t.messages).toHaveLength(2)
    expect(t.messages[0]).toMatchObject({ from_staff: false, kind: 'text', body: 'Кодро гум кардам' })
    expect(t.messages[1]).toMatchObject({ from_staff: true, kind: 'bot' })
    expect(t.messages[1].body).toMatch(/^Салом! Лутфан интизор бошед/)
    await expectError(as(db, null, (tx) => rpc(tx, 'admin_support_threads')), 'forbidden')
    const list = await as(db, editor, (tx) => rpc(tx, 'admin_support_threads'))
    expect(list[0]).toMatchObject({ username: 'malika', unread_staff: 1, last_body: 'Кодро гум кардам' })
    await as(db, editor, (tx) => rpc(tx, 'admin_support_reply', { p_thread: t.id, p_body: 'Пароли муваққатӣ: …' }))
    expect(await as(db, null, (tx) => rpc(tx, 'api_support_unread', { p_token_hash: token }))).toBe(1)
    const mine = await as(db, null, (tx) => rpc(tx, 'api_support_thread', { p_token_hash: token }))
    expect(mine.messages.map((m: { kind: string }) => m.kind)).toEqual(['text', 'bot', 'text'])
    expect(await as(db, null, (tx) => rpc(tx, 'api_support_unread', { p_token_hash: token }))).toBe(0)
    expect((await as(db, editor, (tx) => rpc(tx, 'admin_support_thread', { p_thread: t.id }))).unread_staff).toBe(0)
  })

  it('a consultant joins once, the closed conversation asks for a rating once, a new one greets again', async () => {
    const phone = hash('phone-2')
    const t = await as(db, null, (tx) => rpc(tx, 'api_support_send', { p_token_hash: phone, p_name: 'Нигина', p_username: null, p_body: 'Ба почта дастрасӣ надорам' }))
    await db.query(`update public.profiles set display_name = 'Руслан Ҳусейнзода' where id = '${owner}'`)
    // opening it (again and again) adds "joined" once, with her name
    await as(db, owner, (tx) => rpc(tx, 'admin_support_thread', { p_thread: t.id }))
    const seen = await as(db, owner, (tx) => rpc(tx, 'admin_support_thread', { p_thread: t.id }))
    expect(seen.messages.filter((m: { kind: string }) => m.kind === 'joined')).toEqual([expect.objectContaining({ body: 'Руслан Ҳусейнзода', from_staff: true })])
    // a second message of hers gets no second greeting
    const again = await as(db, null, (tx) => rpc(tx, 'api_support_send', { p_token_hash: phone, p_name: null, p_username: null, p_body: 'Илова' }))
    expect(again.messages.map((m: { kind: string }) => m.kind)).toEqual(['text', 'bot', 'joined', 'text'])
    await as(db, owner, (tx) => rpc(tx, 'admin_support_reply', { p_thread: t.id, p_body: 'Тайёр' }))
    expect((await as(db, null, (tx) => rpc(tx, 'api_support_thread', { p_token_hash: phone }))).needs_rating).toBe(false)
    await as(db, owner, (tx) => rpc(tx, 'admin_support_status', { p_thread: t.id, p_status: 'closed' }))
    expect((await as(db, null, (tx) => rpc(tx, 'api_support_thread', { p_token_hash: phone }))).needs_rating).toBe(true)
    await expectError(as(db, null, (tx) => rpc(tx, 'api_support_rate', { p_token_hash: phone, p_rating: 6, p_note: null })), 'validation_failed')
    const rated = await as(db, null, (tx) => rpc(tx, 'api_support_rate', { p_token_hash: phone, p_rating: 5, p_note: ' Ташаккур! ' }))
    expect(rated).toMatchObject({ needs_rating: false, rating: 5, rating_note: 'Ташаккур!' })
    expect((await as(db, owner, (tx) => rpc(tx, 'admin_support_threads'))).find((x: { id: string }) => x.id === t.id)).toMatchObject({ rating: 5 })
    // writing again opens a new conversation: Mahliyo greets once more
    const next = await as(db, null, (tx) => rpc(tx, 'api_support_send', { p_token_hash: phone, p_name: null, p_username: null, p_body: 'Боз савол' }))
    expect(next.status).toBe('open')
    expect(next.messages.slice(-2).map((m: { kind: string }) => m.kind)).toEqual(['text', 'bot'])
  })

  it('tells a learner whose account is staff that she is a consultant, with the conversations waiting', async () => {
    const mine = '512345678901234'
    await as(db, null, (tx) => rpc(tx, 'api_profile_save', { p_code_hash: hash(mine), p_name: 'Руслан', p_data: { v: 1 } }))
    await db.query(`insert into public.google_learners (user_id, code_hash, code) values ('${owner}', '${hash(mine)}', '${mine}')`)
    const r = await as(db, null, (tx) => rpc(tx, 'api_consultant', { p_code_hash: hash(mine) }))
    expect(r.consultant).toBe(true)
    expect(r.waiting).toBeGreaterThanOrEqual(1)
    expect(await as(db, null, (tx) => rpc(tx, 'api_consultant', { p_code_hash: hash(code) }))).toEqual({ consultant: false })
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

describe('Mahliyo AI questions', () => {
  const phone = hash('ai-phone')
  it('records a question, then her answer once; the staff see them; nobody else can read them', async () => {
    const id = await as(db, null, (tx) => rpc(tx, 'api_mahliyo_ask', { p_token_hash: phone, p_code_hash: hash(code), p_name: 'Малика', p_question: ' Тести марҳила чист? ' }))
    await as(db, null, (tx) => rpc(tx, 'api_mahliyo_answer', { p_id: id, p_answer: 'Тести охири марҳила…', p_tajik: true }))
    // a second answer to the same question is ignored
    await as(db, null, (tx) => rpc(tx, 'api_mahliyo_answer', { p_id: id, p_answer: 'дигар', p_tajik: false }))
    await expectError(as(db, null, (tx) => rpc(tx, 'admin_mahliyo_questions')), 'forbidden')
    const list = await as(db, editor, (tx) => rpc(tx, 'admin_mahliyo_questions'))
    expect(list[0]).toMatchObject({ name: 'Малика', question: 'Тести марҳила чист?', answer: 'Тести охири марҳила…', tajik: true })
    // the table itself is closed to the app's keys
    await expect(as(db, null, (tx) => tx.query('select * from public.mahliyo_questions'))).rejects.toThrow(/permission denied/)
  })

  it('refuses empty or overlong questions and more than 30 an hour from one phone', async () => {
    await expectError(as(db, null, (tx) => rpc(tx, 'api_mahliyo_ask', { p_token_hash: phone, p_code_hash: null, p_name: null, p_question: '  ' })), 'validation_failed')
    await expectError(as(db, null, (tx) => rpc(tx, 'api_mahliyo_ask', { p_token_hash: phone, p_code_hash: null, p_name: null, p_question: 'х'.repeat(1001) })), 'validation_failed')
    const busy = hash('busy-phone')
    for (let i = 0; i < 30; i++) await as(db, null, (tx) => rpc(tx, 'api_mahliyo_ask', { p_token_hash: busy, p_code_hash: null, p_name: null, p_question: `савол ${i}` }))
    await expectError(as(db, null, (tx) => rpc(tx, 'api_mahliyo_ask', { p_token_hash: busy, p_code_hash: null, p_name: null, p_question: 'боз' })), 'rate_limited')
  })

  it('in the background: pending, then her answer with its blocks for the phone that asked; stopped or failed questions say so', async () => {
    const me = hash('bg-phone')
    const ask = (q: string) => as(db, null, (tx) => rpc(tx, 'api_mahliyo_ask', { p_token_hash: me, p_code_hash: null, p_name: null, p_question: q }))
    const result = (id: string, phone = me) => as(db, null, (tx) => rpc(tx, 'api_mahliyo_result', { p_id: id, p_token_hash: phone }))
    const id = await ask('PIN-ро чӣ тавр иваз кунам?')
    expect(await result(id)).toEqual({ status: 'pending' })
    // another phone cannot read it
    await expectError(result(id, hash('other-phone')), 'not_found')
    const blocks = [{ type: 'text', text: 'Ба «Танзимот» дароед.' }, { type: 'screen', spot: 'settings.pin', caption: 'Инҷо' }]
    await as(db, null, (tx) => rpc(tx, 'api_mahliyo_answer', { p_id: id, p_answer: 'Ба «Танзимот» дароед.', p_tajik: true, p_blocks: blocks }))
    expect(await result(id)).toEqual({ status: 'done', tajik: true, reply: 'Ба «Танзимот» дароед.', blocks })
    // stopped by the learner (only from her phone): her late answer is not kept
    const stopped = await ask('Савол')
    await as(db, null, (tx) => rpc(tx, 'api_mahliyo_stop', { p_id: stopped, p_token_hash: hash('other-phone') }))
    expect(await result(stopped)).toEqual({ status: 'pending' })
    await as(db, null, (tx) => rpc(tx, 'api_mahliyo_stop', { p_id: stopped, p_token_hash: me }))
    await as(db, null, (tx) => rpc(tx, 'api_mahliyo_answer', { p_id: stopped, p_answer: 'дер', p_tajik: true, p_blocks: blocks }))
    expect(await result(stopped)).toEqual({ status: 'failed', reason: 'stopped' })
    // the AI failed
    const failed = await ask('Боз савол')
    await as(db, null, (tx) => rpc(tx, 'api_mahliyo_fail', { p_id: failed, p_reason: 'busy' }))
    expect(await result(failed)).toEqual({ status: 'failed', reason: 'busy' })
    // a question nobody answered in five minutes
    const old = await ask('Кӯҳна')
    await db.query(`update public.mahliyo_questions set created_at = now() - interval '6 minutes' where id = $1`, [old])
    expect(await result(old)).toEqual({ status: 'failed', reason: 'timeout' })
    // blocks that are not a list are not kept
    const odd = await ask('Тоқ')
    await as(db, null, (tx) => rpc(tx, 'api_mahliyo_answer', { p_id: odd, p_answer: 'ҳа', p_tajik: true, p_blocks: { a: 1 } }))
    expect(await result(odd)).toMatchObject({ status: 'done', blocks: null })
  })
})

import { createHash } from 'node:crypto'

import { beforeAll, describe, expect, it } from 'vitest'

import { buildWorld, type World } from './fixtures'
import { as, createDb, createUser, expectError, rpc, type Db } from './harness'

let db: Db
let w: World

const hash = (code: string) => createHash('sha256').update(code).digest('hex')

beforeAll(async () => {
  db = await createDb()
  w = await buildWorld(db)
})

describe('live content stamp', () => {
  it('moves whenever staff change content, and anyone may read it', async () => {
    const before = await as(db, null, (tx) => rpc<string>(tx, 'api_content_stamp'))
    expect(before).toMatch(/^\d{8}T\d{6}\.\d{6}$/)
    await as(db, w.admin, (tx) => tx.query("update public.ui_strings set value = value || '!' where locale = 'tg' and key = 'app.name'"))
    const after = await as(db, null, (tx) => rpc<string>(tx, 'api_content_stamp'))
    expect(after > before).toBe(true)
  })

  it('cannot be moved by visitors', async () => {
    await expectError(as(db, null, (tx) => tx.query('update public.content_stamp set changed_at = now()')), /permission denied/)
  })
})

describe('Google sign-in', () => {
  it('ties a Google user to a profile and gives the code back only to her', async () => {
    const code = '512345678901234'
    await as(db, null, (tx) => rpc(tx, 'api_profile_save', { p_code_hash: hash(code), p_name: 'Нигина', p_data: { v: 1 } }))
    const g = await createUser(db, 'nigina@gmail.test')
    const other = await createUser(db, 'other@gmail.test')
    expect(await as(db, g, (tx) => rpc(tx, 'api_google_profile'))).toBeNull()
    await as(db, g, (tx) => rpc(tx, 'api_google_link', { p_code: code }))
    const got = await as(db, g, (tx) => rpc(tx, 'api_google_profile'))
    expect(got.code).toBe(code)
    expect(got.name).toBe('Нигина')
    expect(await as(db, other, (tx) => rpc(tx, 'api_google_profile'))).toBeNull()
  })

  it('refuses visitors, unknown profiles and direct reads', async () => {
    await expectError(as(db, null, (tx) => rpc(tx, 'api_google_profile')), /permission denied|auth_required/)
    const g = await createUser(db, 'new@gmail.test')
    await expectError(as(db, g, (tx) => rpc(tx, 'api_google_link', { p_code: '699999999999999' })), 'not_found')
    await expectError(as(db, g, (tx) => tx.query('select * from public.google_learners')), /permission denied/)
  })
})

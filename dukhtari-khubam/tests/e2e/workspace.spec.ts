import type { Page } from '@playwright/test'

import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const USER = { id: '00000000-0000-0000-0000-0000000000bb', aud: 'authenticated', role: 'authenticated', email: 'm@gmail.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = () => {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
}
const DOC = '11111111-1111-4111-8111-111111111111'

/** her account's session on the phone, as Supabase keeps it */
async function withAccount(page: Page) {
  const session = { access_token: token(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER }
  await page.addInitScript((s) => localStorage.setItem('sb-dqavtyrdipwwgeckxxhr-auth-token', JSON.stringify(s)), session)
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json(USER)))
}

test('the Workspace: locked without Premium (the plans open); with it, a lecture added by subject, asked about, removed', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await withAccount(page)
  let allowed = false
  const docs: { id: string; title: string; file: string; subject: string | null; pages: number; chunks: number; status: string; at: string }[] = []
  const sent: unknown[] = []
  await page.route('**/api/v1/me/workspace', (r) => r.fulfill(json({ allowed, room: { docs: 60, chunks: 12000 }, used: docs.reduce((n, d) => n + d.chunks, 0), docs })))
  await page.route('**/api/v1/me/workspace/start', (r) => {
    const b = r.request().postDataJSON() as { title: string; file: string; subject?: string; pages: number }
    docs.push({ id: DOC, title: b.title, file: b.file, subject: b.subject ?? null, pages: b.pages, chunks: 0, status: 'loading', at: new Date().toISOString() })
    return r.fulfill(json({ id: DOC }))
  })
  await page.route('**/api/v1/me/workspace/chunks', (r) => { sent.push(r.request().postDataJSON()); return r.fulfill(json({ saved: 1 })) })
  await page.route('**/api/v1/me/workspace/done', (r) => { docs[0].status = 'ready'; docs[0].chunks = 1; return r.fulfill(json({ ok: true })) })
  await page.route('**/api/v1/me/workspace/remove', (r) => { docs.splice(0); return r.fulfill(json({ ok: true })) })

  // from the settings
  await page.goto('/settings')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.getByRole('link', { name: /Фазои донишҷӯ/ }).click()
  await expect(page).toHaveURL(/\/workspace\/?$/)
  // without Premium: locked, and its button opens the plans
  await expect(page.locator('.ws-locked')).toContainText('Фазои донишҷӯ — дар Premium')
  await page.locator('.ws-locked .btn').click()
  await expect(page.locator('.pw-over')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goBack().catch(() => undefined)

  allowed = true
  await page.goto('/workspace')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.getByText('Ҳанӯз мавод нест. Аввалин лексияро илова кунед.')).toBeVisible()
  await page.getByLabel('Фан (масалан: Математикаи олӣ)').fill('Биология')
  await page.locator('input[type="file"]').setInputFiles({ name: 'Лексияи 1.txt', mimeType: 'text/plain', buffer: Buffer.from('Фотосинтез дар хлоропластҳо мегузарад. Хлорофилл нури офтобро мегирад ва энергияи онро ба кор мебарад.') })
  await expect(page.locator('.ws-doc')).toContainText('Лексияи 1')
  await expect(page.locator('.eyebrow', { hasText: 'Биология' })).toBeVisible()
  expect(sent).toHaveLength(1)
  expect((sent[0] as { chunks: { text: string }[] }).chunks[0].text).toContain('Фотосинтез')
  await page.screenshot({ path: 'test-results/workspace.png' })

  // asked about: Mahliyo opens with the question started for her
  await page.locator('.ws-doc').getByRole('button', { name: /Аз маводи ман пурсидан/ }).click()
  await expect(page).toHaveURL(/\/mahliyo\/?$/)
  await expect(page.locator('textarea.ai-input')).toHaveValue('Аз «Лексияи 1»: ')

  await page.goto('/workspace')
  page.once('dialog', (d) => void d.accept())
  await page.locator('.ws-doc').getByRole('button', { name: /Нест кардан/ }).click()
  await expect(page.locator('.ws-doc')).toHaveCount(0)
  expect(errors).toEqual([])
})

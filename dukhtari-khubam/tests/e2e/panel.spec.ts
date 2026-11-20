import { expect, signedIn, test } from './fixtures'

// a test passphrase (not the real one) whose SHA-256 starts with the app's prefix, so search reacts
const PASS = 'e2e-panel-25593'
const USER = { id: '00000000-0000-0000-0000-0000000000aa', aud: 'authenticated', role: 'authenticated', email: 'panel@dukhtari-khubam.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = () => {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
}

test('panel: opens from search, then at once offline; an offline change is sent when the connection returns', async ({ page, context, server: _, errors }) => {
  const puts: string[] = []
  let signIns = 0
  await page.route('**/auth/v1/token?grant_type=refresh_token', (r) => {
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: token(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r2', user: USER }) })
  })
  await page.route('**/auth/v1/token?grant_type=password', (r) => {
    signIns++
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: token(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER }) })
  })
  await page.route('**/auth/v1/user**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
  // the most general first: Playwright tries the routes added last first
  await page.route('**/api/v1/admin/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' }))
  await page.route('**/api/v1/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ roles: ['super_admin'] }) }))
  await page.route('**/api/v1/admin/dashboard', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ counts: { schools: 7 }, status: { published: 7 }, pending_quiz_reviews: 0, storage_bytes: 0, recent_activity: [] }) }))
  await page.route('**/api/v1/admin/ui-strings', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/api/v1/admin/ui-strings/**', (r) => { puts.push(`${r.request().method()} ${new URL(r.request().url()).pathname}`); return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) })
  await signedIn(page)

  // 1. online: the passphrase signs in and opens the panel
  await page.goto('/search')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('input[type=search]').fill(PASS)
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 8000 })
  await expect(page.getByRole('heading', { name: 'Идора' })).toBeVisible()
  expect(signIns).toBe(1)

  // 2. offline: the same passphrase opens it at once, from what the phone kept
  await page.goto('/search')
  await page.waitForTimeout(1500) // the panel's page is fetched ahead while online
  await context.setOffline(true)
  const t0 = Date.now()
  await page.locator('input[type=search]').fill(PASS)
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 3000 })
  await expect(page.getByRole('heading', { name: 'Идора' })).toBeVisible()
  expect(Date.now() - t0).toBeLessThan(2500)
  expect(signIns).toBe(1)
  await expect(page.getByText(/Интернет нест/)).toBeVisible()

  // 3. a text changed offline waits in the queue …
  await page.getByRole('tab', { name: 'Матнҳо' }).click()
  await page.getByRole('tab', { name: 'Матнҳои интерфейс' }).click()
  await page.locator('input[type=search]').fill('nav.home')
  const row = page.locator('label', { hasText: 'nav.home' }).first()
  await row.locator('input').fill('Хона')
  await page.getByRole('button', { name: 'Захира' }).first().click()
  await expect(page.getByText(/Дар навбат/).first()).toBeVisible()
  expect(puts).toEqual([])
  // … and is sent by itself when the connection returns
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => puts).toEqual(['PUT /api/v1/admin/ui-strings/nav.home/tg'])
  expect(errors).toEqual([])
})

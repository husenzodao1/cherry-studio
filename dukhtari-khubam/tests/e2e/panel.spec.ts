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

test('panel → Маҳлиё AI: a key saved in a model\'s box makes it answer; a book is read, cut into passages and sent', async ({ page, server: _, errors }) => {
  await page.route('**/auth/v1/token?grant_type=password', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: token(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER }) }))
  await page.route('**/auth/v1/user**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
  await page.route('**/api/v1/admin/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' }))
  await page.route('**/api/v1/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ roles: ['super_admin'] }) }))
  await page.route('**/api/v1/admin/dashboard', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ counts: {}, status: {}, pending_quiz_reviews: 0, storage_bytes: 0, recent_activity: [] }) }))
  await page.route('**/api/v1/admin/mahliyo', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  let settings = { keys: [] as { provider: string; hint: string; at: string }[], active: null as null | { provider: string; model: string; at: string }, server: true }
  const posted: { path: string; body: Record<string, unknown> }[] = []
  await page.route('**/api/v1/admin/ai', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(settings) }))
  await page.route('**/api/v1/admin/ai/key', (r) => {
    const body = r.request().postDataJSON()
    posted.push({ path: 'key', body })
    settings = { ...settings, keys: [{ provider: body.provider, hint: `…${String(body.key).slice(-4)}`, at: '' }], active: { provider: body.provider, model: body.model, at: '' } }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })
  let books: unknown[] = []
  await page.route('**/api/v1/admin/books', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(books) }))
  await page.route('**/api/v1/admin/books/*', (r) => {
    const path = new URL(r.request().url()).pathname.split('/').pop()!
    const body = r.request().postDataJSON()
    posted.push({ path, body })
    if (path === 'done') books = [{ id: 'b1', title: 'Одоби духтар', file: 'odob.txt', pages: 1, chunks: 3, status: 'ready', at: '' }]
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(path === 'start' ? { id: '00000000-0000-4000-8000-0000000000b1' } : { ok: true, saved: 3 }) })
  })
  await signedIn(page)
  await page.goto('/search')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('input[type=search]').fill(PASS)
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 8000 })
  await page.getByRole('tab', { name: 'Маҳлиё AI' }).click()
  await page.getByRole('tab', { name: 'Моделҳо (API)' }).click()
  await expect(page.getByText('Модели пешфарзи барнома (Gemini)')).toBeVisible()
  // a key in DeepSeek's "deepseek-chat" box: checked, kept, and that model answers
  const deepseek = page.locator('section[aria-label="DeepSeek"] form').filter({ hasText: 'deepseek-chat' })
  await deepseek.getByLabel('Калиди API барои deepseek-chat').fill('sk-test-12345678')
  await deepseek.getByRole('button', { name: 'Нигоҳ доштан' }).click()
  await expect(page.getByText('DeepSeek · deepseek-chat')).toBeVisible()
  expect(posted[0]).toEqual({ path: 'key', body: { provider: 'deepseek', model: 'deepseek-chat', key: 'sk-test-12345678' } })
  await expect(page.locator('section[aria-label="DeepSeek"]')).toContainText('Калид: …5678')
  // a book: its text read here, cut into passages, sent, then ready
  await page.getByRole('tab', { name: 'Китобҳо (омӯзиш)' }).click()
  await page.getByLabel('Номи китоб').fill('Одоби духтар')
  const text = Array.from({ length: 60 }, (_, i) => `Ҷумлаи ${i + 1}: меҳмонро бо хурсандӣ ва эҳтиром пешвоз мегиранд.`).join(' ')
  await page.getByLabel('Файли китоб').setInputFiles({ name: 'odob.txt', mimeType: 'text/plain', buffer: Buffer.from(text) })
  await expect(page.getByText('Одоби духтар', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/3 қисм/)).toBeVisible()
  expect(posted.map((p) => p.path)).toEqual(['key', 'start', 'chunks', 'done'])
  expect(posted[1].body).toMatchObject({ title: 'Одоби духтар', file: 'odob.txt', pages: 1 })
  const chunks = posted[2].body.chunks as { n: number; text: string }[]
  expect(chunks.length).toBeGreaterThan(2)
  expect(chunks.every((c) => c.text.length <= 1100)).toBe(true)
  expect(errors).toEqual([])
})

test('panel → Матнҳо → Ҷавобҳои сурх: "+ Ҷавоби сурх" adds a word and its reply, as many as wanted; ✕ removes one', async ({ page, server: _, errors }) => {
  await page.route('**/auth/v1/token?grant_type=password', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: token(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER }) }))
  await page.route('**/auth/v1/user**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
  await page.route('**/api/v1/admin/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' }))
  await page.route('**/api/v1/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ roles: ['super_admin'] }) }))
  await page.route('**/api/v1/admin/dashboard', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ counts: {}, status: {}, pending_quiz_reviews: 0, storage_bytes: 0, recent_activity: [] }) }))
  let kept: unknown[] = [{ word: '', reply: 'Бас кунед' }]
  const saved: unknown[] = []
  await page.route('**/api/v1/admin/ai/warnings', (r) => {
    if (r.request().method() === 'POST') { kept = r.request().postDataJSON().items; saved.push(kept) }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().method() === 'POST' ? { ok: true } : { items: kept }) })
  })
  await signedIn(page)
  await page.goto('/search')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('input[type=search]').fill(PASS)
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 8000 })
  await page.getByRole('tab', { name: 'Матнҳо' }).click()
  await page.getByRole('tab', { name: 'Ҷавобҳои сурх' }).click()
  await expect(page.locator('.red-reply')).toHaveCount(1)
  for (const [word, reply] of [['Аблаҳ', 'Маро аблаҳ нагӯ, вагарна блок меравӣ'], ['беақл', 'Ман беақл нестам'], ['хато', 'нест мешавад']]) {
    await page.getByRole('button', { name: '+ Ҷавоби сурх' }).click()
    const row = page.locator('.red-reply').last()
    await row.getByPlaceholder('Калима дар паёми корбар').fill(word)
    await row.getByPlaceholder('Ҷавоби сурхи Маҳлиё').fill(reply)
  }
  await expect(page.locator('.red-reply')).toHaveCount(4)
  await page.getByRole('button', { name: 'Нест кардани 4' }).click()
  await page.getByRole('button', { name: 'Сабт кардан' }).click()
  await expect.poll(() => saved.length).toBe(1)
  expect(saved[0]).toEqual([{ word: '', reply: 'Бас кунед' }, { word: 'Аблаҳ', reply: 'Маро аблаҳ нагӯ, вагарна блок меравӣ' }, { word: 'беақл', reply: 'Ман беақл нестам' }])
  await expect(page.locator('.red-reply')).toHaveCount(3)
  await page.screenshot({ path: 'test-results/red-replies.png' })
  expect(errors).toEqual([])
})

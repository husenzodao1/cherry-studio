import { expect, signedIn, test } from './fixtures'

// the same test passphrase and staff session as panel.spec.ts
const PASS = 'e2e-panel-25593'
const USER = { id: '00000000-0000-0000-0000-0000000000aa', aud: 'authenticated', role: 'authenticated', email: 'panel@dukhtari-khubam.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = () => {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
}
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const entity = (id: string, title: string) => ({ id, status: 'draft', translations: [{ locale: 'tg', title }] })
const LESSON = '66666666-6666-4666-8666-666666666666'

test('CodeHub: a lesson written as tags, mistakes shown with their line, saved as blocks', async ({ page, server: _, errors }) => {
  const saved: unknown[] = []
  await page.route('**/auth/v1/token?grant_type=password', (r) => r.fulfill(json({ access_token: token(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER })))
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json(USER)))
  await page.route('**/api/v1/admin/**', (r) => r.fulfill(json({ items: [] })))
  await page.route('**/api/v1/me', (r) => r.fulfill(json({ roles: ['super_admin'] })))
  await page.route('**/api/v1/admin/dashboard', (r) => r.fulfill(json({ counts: {}, status: {}, pending_quiz_reviews: 0, storage_bytes: 0, recent_activity: [] })))
  for (const [level, title] of [['schools', 'Мактаб'], ['courses', 'Курс'], ['modules', 'Модул'], ['topics', 'Мавзӯъ'], ['lessons', 'Дарс']] as const) {
    await page.route(`**/api/v1/admin/${level}?*`, (r) => r.fulfill(json({ items: [entity(level === 'lessons' ? LESSON : `${level}-1`, title)] })))
  }
  await page.route(`**/api/v1/admin/lessons/${LESSON}`, (r) => r.fulfill(json(entity(LESSON, 'Дарс'))))
  await page.route(`**/api/v1/admin/lessons/${LESSON}/blocks`, (r) => {
    if (r.request().method() === 'PUT') { saved.push(r.request().postDataJSON()); return r.fulfill(json({ version: 2 })) }
    return r.fulfill(json({ version: 1, blocks: [{ id: 'b1', type: 'heading', props: { level: 2 }, content: { tg: { spans: [{ text: 'Одоби сухан' }] }, ru: { spans: [{ text: 'Этикет' }] } } }] }))
  })
  await signedIn(page)
  await page.goto('/search')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('input[type=search]').fill(PASS)
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 8000 })

  await page.getByRole('tab', { name: 'Мундариҷа' }).click()
  for (let n = 0; n < 4; n++) await page.getByRole('button', { name: 'Кушодан' }).first().click()
  await page.getByRole('button', { name: 'Таҳрир' }).first().click()
  await page.getByRole('tab', { name: 'CodeHub' }).click()

  // the lesson is shown as code
  const code = page.getByRole('textbox', { name: 'Коди дарс' })
  await expect(code).toHaveValue('<сарлавҳа>Одоби сухан</сарлавҳа>')
  // a mistake: an unknown tag and an unclosed one, each with its line
  await code.fill('<сарлавҳа>Одоби сухан</сарлавҳа>\n<саттр>Матн</саттр>\n<сатр>Сухани нек')
  await expect(page.locator('.codehub-errors')).toContainText('Хатогӣ дар сатри 2: теги <саттр> маълум нест')
  await expect(page.locator('.codehub-errors')).toContainText('Хатогӣ дар сатри 3: теги <сатр> пӯшида нашудааст')
  await expect(page.getByRole('button', { name: 'Сабти дарс' })).toBeDisabled()
  await page.screenshot({ path: 'test-results/codehub.png', fullPage: true })
  // inside <аудио> the file panel appears by itself
  await code.fill('<сарлавҳа>Одоби сухан</сарлавҳа>\n<аудио ном="Шеър"></аудио>')
  // the cursor goes between <аудио …> and </аудио>
  await code.press('End')
  for (let n = 0; n < '</аудио>'.length; n++) await code.press('ArrowLeft')
  await expect(page.getByText('Файлро гиред — <аудио>')).toBeVisible()
  // fixed: saved as blocks, the heading keeping its id and its Russian text
  await code.fill('<сарлавҳа>Одоби сухани нек</сарлавҳа>\n<сатр>Сухани нек калиди **дилҳост**.<сатр>\n<видео ном="Дарс">https://youtu.be/abcdefghijk</видео>')
  await expect(page.getByText(/Хатогӣ нест · 3 блок/)).toBeVisible()
  await page.getByRole('button', { name: 'Сабти дарс' }).click()
  await expect.poll(() => saved.length).toBe(1)
  const body = saved[0] as { expected_version: number; blocks: { id?: string; type: string; content: Record<string, unknown>; props: Record<string, unknown> }[] }
  expect(body.expected_version).toBe(1)
  expect(body.blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'youtube'])
  expect(body.blocks[0].id).toBe('b1')
  expect(body.blocks[0].content.ru).toEqual({ spans: [{ text: 'Этикет' }] })
  expect(body.blocks[1].content.tg).toEqual({ spans: [{ text: 'Сухани нек калиди ' }, { text: 'дилҳост', marks: ['bold'] }, { text: '.' }] })
  expect(body.blocks[2].props).toEqual({ video_id: 'abcdefghijk' })
  expect(errors).toEqual([])
})

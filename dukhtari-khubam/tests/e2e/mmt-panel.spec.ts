import { expect, signedIn, test } from './fixtures'

const PASS = 'e2e-panel-25593'
const USER = { id: '00000000-0000-0000-0000-0000000000aa', aud: 'authenticated', role: 'authenticated', email: 'panel@dukhtari-khubam.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = () => {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
}
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

test('panel ММТ: a subject in clusters, questions from a table checked and saved, the AI reading a test book', async ({ page, server: _, errors }) => {
  const sent: { path: string; body: Record<string, unknown> }[] = []
  const session = { access_token: token(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER }
  await page.route('**/auth/v1/token**', (r) => r.fulfill(json(session)))
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json(USER)))
  await page.route('**/api/v1/admin/**', (r) => r.fulfill(json({ items: [] })))
  await page.route('**/api/v1/me', (r) => r.fulfill(json({ roles: ['super_admin'] })))
  await page.route('**/api/v1/admin/dashboard', (r) => r.fulfill(json({ counts: {}, status: {}, pending_quiz_reviews: 0, storage_bytes: 0, recent_activity: [] })))
  const subjects = [{ id: 'math', name: 'Математика', clusters: [1, 2], max_points: 120, questions: 0 }]
  await page.route('**/api/v1/admin/mmt', (r) => r.fulfill(json({ catalog: { exam_date: null, subjects }, by_difficulty: {}, programs: 0, years: [] })))
  await page.route('**/api/v1/admin/mmt/questions?**', (r) => r.fulfill(json({ questions: [] })))
  await page.route('**/api/v1/admin/mmt/programs**', (r) => r.fulfill(json({ programs: [] })))
  await page.route('**/api/v1/admin/mmt/extract', (r) => r.fulfill(json({ questions: [
    { question: 'Пойтахти Тоҷикистон?', options: ['Хуҷанд', 'Душанбе', 'Бохтар'], answer: -1, topic: 'География', difficulty: 1 }
  ] })))
  for (const path of ['subject', 'questions/import']) {
    await page.route(`**/api/v1/admin/mmt/${path}`, (r) => { sent.push({ path, body: r.request().postDataJSON() as Record<string, unknown> }); return r.fulfill(json(path === 'subject' ? { ok: true } : { added: 1 })) })
  }
  await signedIn(page)
  await page.goto('/search')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('input[type=search]').fill(PASS)
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 8000 })
  await page.getByRole('tab', { name: '🎓 ММТ' }).click()

  // a subject: its name, a Latin id made from nothing typed is refused, clusters and points
  await page.getByLabel('Номи фан').fill('Физика')
  await page.getByLabel('Рамз (лотинӣ)').fill('physics')
  await page.getByRole('button', { name: 'Кластери 1' }).click()
  await page.getByRole('button', { name: 'Кластери 2' }).click()
  await page.getByLabel('Балли ҳадди аксар').fill('110')
  await page.getByRole('button', { name: 'Сабт', exact: true }).last().click()
  await expect.poll(() => sent.find((s) => s.path === 'subject')?.body).toMatchObject({ id: 'physics', name: 'Физика', clusters: [1, 2], max_points: 110 })

  // questions from a table: read, checked, saved
  await page.getByRole('tab', { name: 'Бонки тестҳо' }).click()
  await page.getByPlaceholder('…ё матни саҳифаҳои китоби тестро ин ҷо гузоред').fill('Савол;А;Б;В;Г;Ҷавоб\n2+2=?;3;4;5;6;Б\n')
  await page.getByRole('button', { name: 'Ҳамчун ҷадвал' }).click()
  await expect(page.getByText('Санҷед · 1 савол (1 бо ҷавоб)')).toBeVisible()
  await page.getByRole('button', { name: 'Сабти 1 савол' }).click()
  await expect.poll(() => sent.find((s) => s.path === 'questions/import')?.body).toMatchObject({ subject: 'math', rows: [{ question: '2+2=?', options: ['3', '4', '5', '6'], answer: 1 }] })

  // the AI reads a book: a question without the book's answer waits for the staff to choose it
  await page.getByPlaceholder('…ё матни саҳифаҳои китоби тестро ин ҷо гузоред').fill('1. Пойтахти Тоҷикистон? А) Хуҷанд Б) Душанбе В) Бохтар')
  await page.getByRole('button', { name: '✨ AI хонад' }).click()
  await expect(page.getByText('Санҷед · 1 савол (0 бо ҷавоб)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сабти 0 савол' })).toBeDisabled()
  await page.getByLabel('Ҷавоби саволи 1').selectOption('1')
  await expect(page.getByRole('button', { name: 'Сабти 1 савол' })).toBeEnabled()
  await page.screenshot({ path: 'test-results/mmt-panel.png' })
  expect(errors).toEqual([])
})

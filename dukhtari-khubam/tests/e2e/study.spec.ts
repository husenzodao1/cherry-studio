import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

test('the student Workspace from the paperclip: a new chat, her materials on top, a task and a subject sent with the question', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const asked: { study?: unknown; turns: unknown[] }[] = []
  await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill(json({ ready: true })))
  await page.route('**/api/v1/mahliyo/ask', (r) => { asked.push(r.request().postDataJSON()); return r.fulfill(json({ id: '00000000-0000-4000-8000-000000000001' })) })
  const done = json({ status: 'done', tajik: true, reply: '', blocks: [{ type: 'text', text: 'Дода шудааст: m = 2 кг, a = 3 м/с². Ёфтан лозим: F. Ҳал: F = ma = 6 Н. Ҷавоб: 6 Н.' }] })
  await page.route('**/api/v1/mahliyo/answer', (r) => r.fulfill(done))
  await page.route('**/rest/v1/rpc/api_mahliyo_result', (r) => r.fulfill(done))
  await page.route('**/api/v1/me/workspace', (r) => r.fulfill(json({ allowed: true, room: { docs: 60, chunks: 12000 }, used: 10, docs: [{ id: 'a' }, { id: 'b' }] })))
  await page.goto('/mahliyo')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('.ai-attach').click()
  await page.getByRole('button', { name: 'Фазои донишҷӯ' }).click()
  await expect(page.locator('.study-bar')).toBeVisible()
  await page.getByRole('button', { name: /Масъала барои дафтар/ }).click()
  await page.getByRole('button', { name: /Физика/ }).click()
  await page.screenshot({ path: 'test-results/study.png' })
  const box = page.locator('textarea.ai-input')
  await box.fill('Ҷисми 2 кг бо шитоби 3 м/с² ҳаракат мекунад. Қувва чанд аст?')
  await box.press('Enter')
  await expect(page.locator('.ai-said').first()).toContainText('Ҷавоб: 6 Н')
  expect(asked[0].study).toEqual({ task: 'problem', subject: 'physics' })
  // the bar stays with its chat
  await expect(page.locator('.study-bar')).toBeVisible()
  expect(errors).toEqual([])
})

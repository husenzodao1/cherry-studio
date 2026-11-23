import { readFileSync } from 'node:fs'

import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const PIC = 'https://upload.wikimedia.org/wikipedia/commons/8/87/Rudaki.jpg'

test.use({ viewport: { width: 390, height: 800 } })

test('a presentation in the app: big controls, and a real picture beside a slide\'s points with its caption', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.route(PIC, (r) => r.fulfill({ contentType: 'image/webp', body: readFileSync('public/assets/paywall/tg/chat.webp') }))
  await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill(json({ ready: true })))
  await page.route('**/api/v1/mahliyo/ask', (r) => r.fulfill(json({ id: '00000000-0000-4000-8000-000000000001' })))
  const done = json({ status: 'done', tajik: true, reply: '', blocks: [{ type: 'file', name: 'Рӯдакӣ.pptx', title: 'Рӯдакӣ', about: '3 слайд', style: 's07',
    content: `# Абӯабдуллоҳи Рӯдакӣ\n## Падари шеър\n---\n# Ҳаёт\n- Дар Панҷрӯд таваллуд шуд\n- Шоири дарбори Сомониён\n![Рӯдакӣ](${PIC})\n> Дар бораи ҳаёташ\n---\n# Мерос\n- Ашъор` }] })
  await page.route('**/api/v1/mahliyo/answer', (r) => r.fulfill(done))
  await page.route('**/rest/v1/rpc/api_mahliyo_result', (r) => r.fulfill(done))
  await page.goto('/mahliyo')
  await page.locator('#splash').waitFor({ state: 'hidden', timeout: 15_000 })
  await page.locator('textarea.ai-input').fill('Дар бораи Рӯдакӣ слайд')
  await page.locator('textarea.ai-input').press('Enter')
  await page.locator('.ai-file-see').click({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Дар LifeHub' }).click()
  // the controls: big enough for a finger, the play button bigger
  const ctl = page.locator('.sp-ctl .docv-btn')
  await expect(ctl.first()).toBeVisible()
  expect((await ctl.first().boundingBox())!.width).toBeGreaterThanOrEqual(48)
  expect((await page.locator('.sp-ctl .sp-play').boundingBox())!.width).toBeGreaterThanOrEqual(60)
  // the next slide: its picture on the right, beside the points
  await ctl.nth(1).click()
  const slide = page.locator('.sp-slide.has-pic')
  await expect(slide).toBeVisible()
  await expect(slide.locator('.sp-pic img')).toHaveAttribute('src', PIC)
  await expect(slide.locator('.sp-pic figcaption')).toHaveText('Рӯдакӣ')
  await page.waitForTimeout(1500)
  const pic = (await slide.locator('.sp-pic img').boundingBox())!
  const points = (await slide.locator('.sp-body').boundingBox())!
  expect(pic.width).toBeGreaterThan(80)
  expect(pic.x).toBeGreaterThan(points.x + 100)
  await page.screenshot({ path: 'test-results/slides-picture.png' })
  expect(errors).toEqual([])
})

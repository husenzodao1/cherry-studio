import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

test('the red pen: a notebook photo, the mistakes circled with the fix beside, a mark, a tap explains', async ({ page, server: _, errors }) => {
  await signedIn(page)
  let sent: Record<string, unknown> | null = null
  await page.route('**/api/v1/study/check', (r) => {
    sent = r.request().postDataJSON() as Record<string, unknown>
    return r.fulfill(json({
      subject: 'Математика', grade: 4, summary: 'Роҳи ҳал дуруст аст, танҳо як хатои ҳисоб.', next: ['Тартиби амалҳо'],
      marks: [
        { box: [300, 120, 380, 520], kind: 'error', text: '2 + 3 · 4 = 14', why: 'Аввал зарб, баъд ҷамъ.' },
        { box: [500, 120, 560, 520], kind: 'ok', text: 'Офарин', why: '' }
      ]
    }))
  })
  await page.goto('/schools')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('.tool-tile[href="/check"]').click()
  await expect(page).toHaveURL(/\/check/)
  await page.getByLabel('Аз галерея').setInputFiles('public/assets/paywall/tg/chat.webp')
  await expect(page.locator('.check-page img')).toBeVisible()
  await page.getByRole('button', { name: 'Математика' }).first().click()
  await page.getByLabel('Супориш чӣ буд? (ихтиёрӣ)').fill('2 + 3 · 4 = ?')
  await page.getByRole('button', { name: 'Санҷидан' }).click()

  await expect(page.locator('.check-grade')).toHaveText('4')
  expect(sent).toMatchObject({ lang: 'tg', subject: 'mathematics', task: '2 + 3 · 4 = ?', image: { mime: 'image/jpeg' } })
  expect(String((sent as unknown as { image: { data: string } }).image.data).length).toBeGreaterThan(1000)
  await expect(page.locator('.check-mark.is-error')).toHaveCount(1)
  await expect(page.locator('.check-fix')).toHaveText('2 + 3 · 4 = 14')
  await expect(page.locator('.check-mark.is-error')).toHaveAttribute('style', /top: 30%; left: 12%; height: 8%; width: 40%/)
  await expect(page.getByText('1 хато')).toBeVisible()
  await page.locator('.check-mark.is-error').click()
  await expect(page.locator('.check-detail')).toContainText('Аввал зарб, баъд ҷамъ.')
  await page.screenshot({ path: 'test-results/check.png' })
  expect(errors).toEqual([])
})

test('the red pen: the plan\'s checks used up — the plans open', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.route('**/api/v1/study/check', (r) => r.fulfill({ status: 402, contentType: 'application/json', body: '{"code":"plan_limit"}' }))
  await page.goto('/check')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.getByLabel('Аз галерея').setInputFiles('public/assets/paywall/tg/chat.webp')
  await page.getByRole('button', { name: 'Санҷидан' }).click()
  await expect(page.locator('.pw-over')).toBeVisible()
  expect(errors).toEqual([])
})

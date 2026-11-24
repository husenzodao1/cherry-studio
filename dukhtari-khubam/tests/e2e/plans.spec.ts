import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const PLANS = {
  live: true, prices: { standard: 45, standardFirst: 25, premium: 99 }, gift_days: 3, consultant: true, paddle: null,
  limits: {
    free: { message: 15, slides: 1, doc: 1, file: 2, quiz: 3, mmt: 1, lawyer: 2, music: 0, exam: 2, context: 12, keep: 7 },
    standard: { message: 40, slides: 3, doc: 4, file: 10, quiz: 20, mmt: 10, lawyer: 10, music: 0, exam: 20, context: 24, keep: 31 },
    premium: { message: 140, slides: 40, doc: 60, file: 100, quiz: -1, mmt: -1, lawyer: -1, music: 20, exam: -1, context: 40, keep: 366 }
  }
}

test('the plans: their screen with the app at work, two plans with crowns and prices, the table; in the settings; a free learner is shown it on opening', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.addInitScript(() => localStorage.setItem('dk.prefs', JSON.stringify({ locale: 'tg', mode: 'girl', theme: 'peach' })))
  await page.route('**/api/v1/plans', (r) => r.fulfill(json(PLANS)))
  await page.goto('/premium')
  await expect(page.locator('.pw-title')).toHaveText('LifeHub Premium')
  await expect(page.locator('.pw-shot')).toHaveCount(10)
  await expect(page.locator('.pw-plan')).toHaveCount(2)
  await expect(page.locator('.pw-plan.is-premium')).toContainText('99')
  await expect(page.locator('.pw-plan.is-standard')).toContainText('Моҳи аввал 25 сомонӣ')
  await expect(page.locator('.pw-tr')).toHaveCount(1 + 20)
  await expect(page.locator('.pw-tr', { hasText: 'Саволҳо ба Маҳлиё' })).toContainText('2 гуфтугӯ')
  await expect(page.locator('.pw-tr', { hasText: 'Сохтани мусиқӣ' }).locator('.pw-td.is-premium')).toContainText('20/моҳ')
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'test-results/plans-top.png' })
  // a moment later: down to the two plans, both coming forward at once
  await expect(page.locator('.pw-plans.is-pop')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.pw-plans')).toBeInViewport()
  await page.locator('.pw-table').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/plans-table.png' })
  // Standard chosen: its price on the button; no online payment yet: through a consultant
  await page.locator('.pw-plan.is-standard').click()
  await expect(page.locator('.pw-cta')).toContainText('25')
  await expect(page.locator('.pw-consult')).toBeVisible()
  // the settings: her plan at the top, opening the plans over the screen
  await page.goto('/settings')
  await page.locator('.plan-row').click()
  await expect(page.locator('.pw-over .pw-title')).toBeVisible()
  await page.locator('.pw-over .pw-close').click()
  await expect(page.locator('.pw-over')).toHaveCount(0)
  // the home screen of a free learner: the plans open once, a moment after
  await page.goto('/')
  await expect(page.locator('.pw-over')).toBeVisible({ timeout: 15_000 })
  // opened by the app and not touched: it closes by itself after seven seconds
  await expect(page.locator('.pw-over')).toHaveCount(0, { timeout: 9000 })
  expect(errors).toEqual([])
})

test.describe('the prices where she lives', () => {
  test.use({ timezoneId: 'Europe/Moscow' })
  test('in Russia: about as much in roubles', async ({ page, server: _, errors }) => {
    await signedIn(page)
    await page.addInitScript(() => localStorage.setItem('dk.prefs', JSON.stringify({ locale: 'ru', mode: 'girl', theme: 'peach' })))
    await page.route('**/api/v1/plans', (r) => r.fulfill(json({ ...PLANS, rates: { RUB: 8.89 } })))
    await page.goto('/premium')
    await expect(page.locator('.pw-plan.is-premium .pw-plan-price')).toContainText(/≈\s?880\s?₽/)
    await expect(page.locator('.pw-plan.is-standard')).toContainText(/Первый месяц ≈\s?222\s?₽/)
    await page.locator('.pw-plans').screenshot({ path: 'test-results/plans-rub.png' })
    expect(errors).toEqual([])
  })
})

test('with a plan: the home screen offers the new features she has not tried, until she does or closes it', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const user = { id: '00000000-0000-0000-0000-0000000000ce', aud: 'authenticated', role: 'authenticated', email: 'm@gmail.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const token = `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: user.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
  await page.addInitScript((s) => localStorage.setItem('sb-dqavtyrdipwwgeckxxhr-auth-token', JSON.stringify(s)),
    { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user })
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json(user)))
  await page.route('**/api/v1/plans', (r) => r.fulfill(json(PLANS)))
  await page.route('**/api/v1/me/plan', (r) => r.fulfill(json({ plan: 'premium' })))
  await page.goto('/')
  await expect(page.locator('.try-also')).toContainText('Инчунин функсияҳои навро санҷед')
  await expect(page.locator('.try-also-chip')).toHaveCount(4)
  await page.locator('.try-also').screenshot({ path: 'test-results/try-also.png' })
  await page.locator('.try-also-chip', { hasText: 'Фазои донишҷӯ' }).click()
  await expect(page).toHaveURL(/\/workspace/)
  await page.goto('/')
  await expect(page.locator('.try-also-chip')).toHaveCount(3)
  await page.locator('.try-also-x').click()
  await expect(page.locator('.try-also')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.try-also')).toHaveCount(0)
  expect(errors).toEqual([])
})

import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const USER = { id: '00000000-0000-0000-0000-0000000000dd', aud: 'authenticated', role: 'authenticated', email: 'm@gmail.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = () => {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: USER.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
}

test('Mahliyo in Telegram: from the settings, "Connect" opens the bot with a one-time code; linked, it can be undone', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const session = { access_token: token(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER }
  await page.addInitScript((s) => localStorage.setItem('sb-dqavtyrdipwwgeckxxhr-auth-token', JSON.stringify(s)), session)
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json(USER)))
  let linked = false
  await page.route('**/api/v1/me/telegram', (r) => r.fulfill(json({ linked, name: linked ? 'malika' : null, allowed: true, bot: 'MahliyoBot', ready: true })))
  await page.route('**/api/v1/me/telegram/code', (r) => r.fulfill(json({ code: 'GoodCode1234', link: 'https://t.me/MahliyoBot?start=GoodCode1234' })))
  await page.route('**/api/v1/me/telegram/unlink', (r) => { linked = false; return r.fulfill(json({ ok: true })) })
  await page.addInitScript(() => { (window as unknown as { __opened: string[] }).__opened = []; window.open = ((u: string) => { (window as unknown as { __opened: string[] }).__opened.push(u); return null }) as typeof window.open })

  await page.goto('/settings')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  // "Маро бубар" waits under "More features", below Telegram
  await expect(page.getByRole('link', { name: /Маро бубар/ })).toHaveCount(0)
  await page.getByRole('button', { name: /Имкониятҳои бештар/ }).click()
  await expect(page.getByRole('link', { name: /Маро бубар/ })).toBeVisible()
  await page.getByRole('link', { name: /Маҳлиё дар Telegram/ }).click()
  await expect(page).toHaveURL(/\/telegram\/?$/)
  await page.getByRole('button', { name: 'Пайваст кардан' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual(['https://t.me/MahliyoBot?start=GoodCode1234'])
  // she pressed "Start" in Telegram and came back
  linked = true
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.locator('.tg-ok')).toContainText('Пайваст аст: @malika')
  await page.screenshot({ path: 'test-results/telegram.png' })
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Ҷудо кардан' }).click()
  await expect(page.getByRole('button', { name: 'Пайваст кардан' })).toBeVisible()
  expect(errors).toEqual([])
})

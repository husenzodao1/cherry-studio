import type { Page } from '@playwright/test'

import { expect, signedIn, test } from './fixtures'

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const tokenOf = (sub: string, aal: 'aal1' | 'aal2') => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', aal, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
const FACTOR = { id: '22222222-2222-4222-8222-222222222222', factor_type: 'totp', friendly_name: 'LifeHub', status: 'verified', created_at: '2026-11-24T00:00:00Z', updated_at: '2026-11-24T00:00:00Z' }
// Supabase Auth answers the raw SVG; supabase-js makes it a data: picture
const QR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="white"/><rect x="1" y="1" width="3" height="3"/><rect x="6" y="1" width="3" height="3"/><rect x="1" y="6" width="3" height="3"/></svg>'

/** a Premium account on this phone; `factors`: her second step as Supabase knows it */
async function account(page: Page, id: string, factors: unknown[], aal: 'aal1' | 'aal2') {
  const user = { id, aud: 'authenticated', role: 'authenticated', email: 'p@gmail.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', factors }
  await page.addInitScript((s) => localStorage.setItem('sb-dqavtyrdipwwgeckxxhr-auth-token', JSON.stringify(s)),
    { access_token: tokenOf(id, aal), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user })
  await page.route('**/api/v1/me/plan', (r) => r.fulfill(json({ plan: 'premium' })))
  return user
}

test('a Premium account is asked to turn on 2FA; the QR code, a code from the app, and it is on', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const id = '00000000-0000-0000-0000-0000000000f1'
  const user = await account(page, id, [], 'aal1')
  let factors: unknown[] = []
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json({ ...user, factors })))
  await page.route('**/auth/v1/factors', (r) => r.fulfill(json({ id: FACTOR.id, type: 'totp', friendly_name: 'LifeHub', totp: { qr_code: QR, secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/LifeHub' } })))
  await page.route('**/auth/v1/factors/*/challenge', (r) => r.fulfill(json({ id: '33333333-3333-4333-8333-333333333333', type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 })))
  await page.route('**/auth/v1/factors/*/verify', (r) => {
    const code = (r.request().postDataJSON() as { code: string }).code
    if (code !== '123456') return r.fulfill(json({ code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }, 422))
    factors = [FACTOR]
    return r.fulfill(json({ access_token: tokenOf(id, 'aal2'), token_type: 'bearer', expires_in: 3600, refresh_token: 'r2', user: { ...user, factors } }))
  })
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.mfa-offer')).toContainText('Ҳисоби Premium-и худро ҳифз кунед', { timeout: 8000 })
  await page.locator('.mfa-offer .btn').click()
  await expect(page).toHaveURL(/\/security/)
  await page.getByRole('button', { name: /Фаъол кардани 2FA/ }).click()
  await expect(page.locator('.mfa-qr')).toBeVisible()
  await expect.poll(() => page.locator('.mfa-qr').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0)
  await expect(page.locator('.mfa-secret')).toContainText('JBSW Y3DP EHPK 3PXP')
  await page.screenshot({ path: 'test-results/mfa-setup.png' })
  await page.locator('.otp-input').fill('654321')
  await page.getByRole('button', { name: 'Тасдиқ' }).click()
  await expect(page.locator('.mfa-wrong')).toBeVisible()
  await page.locator('.otp-input').fill('123456')
  await page.getByRole('button', { name: 'Тасдиқ' }).click()
  await expect(page.locator('.mfa-on')).toContainText('Воридшавии дуқадама фаъол аст')
  expect(errors).toEqual([])
})

test('2FA on, a session without its second step: the code is asked before her account is used', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const id = '00000000-0000-0000-0000-0000000000f2'
  const user = await account(page, id, [FACTOR], 'aal1')
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json(user)))
  await page.route('**/auth/v1/factors/*/challenge', (r) => r.fulfill(json({ id: '33333333-3333-4333-8333-333333333333', type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 })))
  await page.route('**/auth/v1/factors/*/verify', (r) => r.fulfill(json({ access_token: tokenOf(id, 'aal2'), token_type: 'bearer', expires_in: 3600, refresh_token: 'r2', user })))
  await page.goto('/')
  await expect(page.locator('.mfa-screen')).toContainText('Коди барномаи тасдиқ', { timeout: 10_000 })
  await page.screenshot({ path: 'test-results/mfa-ask.png' })
  await page.locator('.mfa-screen .otp-input').fill('123456')
  await page.locator('.mfa-screen .btn').click()
  await expect(page.locator('.mfa-screen')).toHaveCount(0)
  expect(errors).toEqual([])
})

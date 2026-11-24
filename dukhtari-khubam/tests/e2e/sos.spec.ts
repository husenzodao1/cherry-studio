import type { Page } from '@playwright/test'

import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const TOKEN = 'a1b2c3d4e5f6a1b2c3d4e5f6'

/** her place in Dushanbe, exact */
async function inDushanbe(page: Page) {
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 38.5737, longitude: 68.7738, accuracy: 9 })
}

test('SOS: her people saved, the button held sends her place on WhatsApp, "I am safe" closes it', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await inDushanbe(page)
  const calls: { path: string; body: Record<string, unknown> }[] = []
  let people: unknown[] = []
  await page.route('**/rest/v1/rpc/api_sos_guardians**', (r) => r.fulfill(json(people)))
  await page.route('**/rest/v1/rpc/api_sos_set_guardians**', (r) => {
    people = ((r.request().postDataJSON() as { p_list: { name: string; phone: string }[] }).p_list)
    return r.fulfill(json(people))
  })
  await page.route('**/api/v1/sos/**', (r) => {
    const path = new URL(r.request().url()).pathname.replace('/api/v1', '')
    const body = r.request().postDataJSON() as Record<string, unknown>
    calls.push({ path, body })
    if (path === '/sos/start') {
      return r.fulfill(json({ token: TOKEN, link: `https://lifehub.tj/where?t=${TOKEN}`, kind: body.kind === 'walk' ? 'walk' : 'sos',
        due_at: body.kind === 'walk' ? new Date(Date.now() + 20 * 60_000).toISOString() : null, guardians: people, sent: 2, whatsapp: true }))
    }
    return r.fulfill(json(path === '/sos/stop' ? { stopped: true, sent: 2 } : { open: true }))
  })

  await page.goto('/profile')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('.menu-row[href="/sos"]').click()
  await expect(page).toHaveURL(/\/sos/)

  // no people yet: the editor is open; a bad number cannot be saved
  await page.getByLabel('WhatsApp 1').fill('123')
  await expect(page.getByRole('button', { name: 'Нигоҳ доштан' })).toBeDisabled()
  await page.getByLabel('WhatsApp 1').fill('+992 90 123 45 67')
  await page.getByRole('button', { name: 'Боз як нафар' }).click()
  await page.getByLabel('Ном 2').fill('Падар')
  await page.getByLabel('WhatsApp 2').fill('+992911234567')
  await page.getByRole('button', { name: 'Нигоҳ доштан' }).click()
  await expect.poll(() => people).toEqual([{ name: 'Модар', phone: '992901234567' }, { name: 'Падар', phone: '992911234567' }])
  await page.screenshot({ path: 'test-results/sos.png' })

  // a short press does nothing; held, the SOS goes with her exact place
  const button = page.locator('.sos-button')
  await button.dispatchEvent('pointerdown')
  await page.waitForTimeout(400)
  await button.dispatchEvent('pointerup')
  expect(calls).toHaveLength(0)
  await button.dispatchEvent('pointerdown')
  await expect(page.locator('.sos-live')).toBeVisible({ timeout: 5000 })
  const start = calls.find((c) => c.path === '/sos/start')!
  expect(start.body).toMatchObject({ code: '512345678901234', kind: 'sos', lat: 38.5737, lng: 68.7738, lang: 'tg' })
  await expect(page.locator('.sos-live')).toContainText('Модар, Падар')
  await page.screenshot({ path: 'test-results/sos-live.png' })

  await page.getByRole('button', { name: 'Ман бехатарам' }).click()
  await expect.poll(() => calls.map((c) => c.path)).toContain('/sos/stop')
  await expect(page.locator('.sos-live')).toHaveCount(0)

  // walk me home: 30 minutes, a clock counting down, "I arrived"
  await page.getByRole('button', { name: '30 дақ' }).click()
  await page.getByRole('button', { name: 'Оғоз' }).click()
  await expect(page.locator('.sos-clock')).toHaveText(/^19:\d\d$/)
  expect(calls.filter((c) => c.path === '/sos/start').at(-1)!.body).toMatchObject({ kind: 'walk', minutes: 30 })
  await page.getByRole('button', { name: 'Расидам' }).click()
  await expect(page.locator('.sos-live')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('SOS: WhatsApp not reached — the SMS opens to her people with her place', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await inDushanbe(page)
  await page.addInitScript(() => localStorage.setItem('dk.sos.people', JSON.stringify([{ name: 'Модар', phone: '992901234567' }])))
  await page.route('**/rest/v1/rpc/api_sos_guardians**', (r) => r.fulfill(json([{ name: 'Модар', phone: '992901234567' }])))
  await page.route('**/api/v1/sos/start', (r) => r.fulfill({ status: 503, body: '{}' }))
  await page.goto('/sos')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  // the phone's SMS app stands in: the address it would open is kept
  await page.evaluate(() => { (window as unknown as { __dkOpen: (u: string) => void }).__dkOpen = (u) => { (window as unknown as { __sms?: string }).__sms = u } })
  await page.locator('.sos-button').press('Enter')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __sms?: string }).__sms ?? '')).toContain('sms:+992901234567?body=')
  const body = decodeURIComponent((await page.evaluate(() => (window as unknown as { __sms?: string }).__sms ?? '')).split('body=')[1])
  expect(body).toBe('SOS! Малика ёрӣ мехоҳад. Ҷояш: https://maps.google.com/?q=38.573700,68.773800')
  expect(errors).toEqual([])
})

test('a fake call rings after five seconds; answered, it counts', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.route('**/rest/v1/rpc/api_sos_guardians**', (r) => r.fulfill(json([{ name: 'Модар', phone: '992901234567' }])))
  await page.goto('/sos')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.getByLabel('Кӣ занг мезанад').fill('Апа')
  await page.getByRole('button', { name: 'Занг', exact: true }).click()
  await expect(page.locator('.fake-call')).toBeVisible({ timeout: 8000 })
  await expect(page.locator('.fake-call')).toContainText('Апа')
  await page.screenshot({ path: 'test-results/fake-call.png' })
  await page.getByRole('button', { name: 'Ҷавоб' }).click()
  await expect(page.locator('.fake-call-who span').last()).toHaveText(/^0:0[1-9]$/, { timeout: 4000 })
  await page.getByRole('button', { name: 'Рад' }).click()
  await expect(page.locator('.fake-call')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('the live map her people open: her name, where she is, how long ago; closed when she is safe', async ({ page, errors }) => {
  let open = true
  await page.route('**/rest/v1/rpc/api_sos_where**', (r) => r.fulfill(json({
    name: 'Малика', kind: 'sos', open, safe: open ? null : true, lat: open ? 38.5737 : null, lng: open ? 68.7738 : null, accuracy: 9, battery: 41,
    due_at: null, started_at: new Date().toISOString(), updated_at: new Date(Date.now() - 2 * 60_000).toISOString()
  })))
  await page.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }))
  await page.goto(`/where?t=${TOKEN}`)
  await expect(page.locator('#splash')).toBeHidden({ timeout: 15_000 })
  await expect(page.locator('.sos-live')).toContainText('Малика ёрӣ мехоҳад')
  await expect(page.locator('.sos-live')).toContainText('2 дақ пеш')
  await expect(page.locator('.sos-live')).toContainText('41%')
  await expect(page.locator('.where-map .leaflet-container')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Дар Google Maps кушодан' })).toHaveAttribute('href', /query=38.5737,68.7738/)
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/where.png' })
  open = false
  await page.reload()
  await expect(page.locator('.sos-live')).toContainText('Малика бехатар аст')
  await expect(page.locator('.where-map')).toHaveCount(0)
  expect(errors).toEqual([])
})

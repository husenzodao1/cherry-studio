import type { Page } from '@playwright/test'

import { expect, signedIn, test } from './fixtures'

interface Phone { notify: 'prompt' | 'granted' | 'denied'; call: boolean; asked: string[]; refuse?: boolean; place?: boolean }

/**
 * The page as the Android app: every plugin method answers through a fake bridge; notifications and the
 * lock-screen call are the permissions the test plays with (`window.__phone`).
 */
async function asPhone(page: Page, phone: Phone) {
  await page.addInitScript((start) => {
    const w = window as unknown as Record<string, unknown>
    // the phone keeps what she allowed across openings (reloads)
    const kept = sessionStorage.getItem('e2e.phone')
    const state = (w.__phone = new Proxy(kept ? JSON.parse(kept) : { ...start }, {
      set: (o, k, v) => { o[k] = v; sessionStorage.setItem('e2e.phone', JSON.stringify(o)); return true }
    })) as typeof start
    w.androidBridge = {}
    // her place: allowed already unless the test says otherwise; asking gives it (rounded by the app)
    if (state.place === undefined) state.place = true
    const perms = navigator.permissions
    const query = perms.query.bind(perms)
    perms.query = ((d: { name: string }) => (d.name === 'geolocation'
      ? Promise.resolve({ state: state.place ? 'granted' : 'prompt' } as PermissionStatus) : query(d as PermissionDescriptor))) as typeof perms.query
    navigator.geolocation.getCurrentPosition = ((ok: PositionCallback) => {
      state.asked = [...state.asked, 'place']
      state.place = true
      ok({ coords: { latitude: 38.5598, longitude: 68.7870 } } as GeolocationPosition)
    }) as typeof navigator.geolocation.getCurrentPosition
    const header = { name: '', methods: { find: () => ({ name: '', rtype: 'promise' }) } }
    w.Capacitor = {
      PluginHeaders: { find: () => header },
      nativePromise: async (plugin: string, method: string) => {
        const key = `${plugin}.${method}`
        if (method === 'addListener') return { remove: async () => undefined }
        if (key === 'LocalNotifications.checkPermissions') return { display: state.notify }
        if (key === 'LocalNotifications.requestPermissions') {
          state.asked = [...state.asked, 'notify-dialog']
          if (state.notify === 'prompt') state.notify = state.refuse ? 'denied' : 'granted'
          return { display: state.notify }
        }
        // her place: Android's own permission (the app's Geolocation plugin)
        if (key === 'Geolocation.checkPermissions') return { location: state.place ? 'granted' : 'prompt', coarseLocation: state.place ? 'granted' : 'prompt' }
        if (key === 'Geolocation.requestPermissions') { state.asked = [...state.asked, 'place']; state.place = true; return { location: 'granted', coarseLocation: 'granted' } }
        if (key === 'Geolocation.getCurrentPosition') return { coords: { latitude: 38.5598, longitude: 68.7870 }, timestamp: Date.now() }
        if (key === 'MahliyoCall.canFullScreen') return { granted: state.call }
        if (key === 'MahliyoCall.askFullScreen') { state.asked = [...state.asked, 'call-settings']; state.call = true; return {} }
        if (key === 'MahliyoCall.notifySettings') { state.asked = [...state.asked, 'notify-settings']; return {} }
        if (key === 'MahliyoCall.taken') return { rang: [] }
        if (key === 'LocalNotifications.getPending') return { notifications: [] }
        return {}
      }
    }
  }, phone)
}

test('on entering the phone app: notifications, Mahliyo\'s calls and her place asked on one screen, until all are allowed', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await asPhone(page, { notify: 'prompt', call: false, asked: [], place: false })
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const sheet = page.locator('.perm')
  await expect(sheet).toBeVisible()
  await expect(sheet.locator('.perm-title')).toHaveText('Иҷозатҳо')
  await expect(sheet.locator('.perm-row')).toHaveCount(3)
  await expect(sheet.locator('.perm-row.is-on')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/permissions.png' })
  // one button: first the system's own question about notifications …
  await sheet.getByRole('button', { name: 'Иҷозат додан' }).click()
  await expect(sheet.locator('.perm-row.is-on')).toHaveCount(1)
  await expect(sheet.locator('.perm-row', { hasText: 'Огоҳиномаҳо' })).toHaveClass(/is-on/)
  // … then the setting for calls over the lock screen, then her place; all allowed, the screen goes by itself
  await sheet.getByRole('button', { name: 'Иҷозат додан' }).click()
  await expect(sheet.locator('.perm-row', { hasText: 'Зангҳои Маҳлиё' })).toHaveClass(/is-on/)
  await sheet.getByRole('button', { name: 'Иҷозат додан' }).click()
  await expect(sheet).toHaveCount(0)
  // her place is kept only roughly (about 10 km)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dk.place') ?? 'null'))).toMatchObject({ lat: 38.6, lon: 68.8 })
  await expect(page.locator('.toast').filter({ hasText: 'Ҳамаи иҷозатҳо дода шуданд' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __phone: Phone }).__phone.asked)).toEqual(['notify-dialog', 'call-settings', 'place'])
  // the next opening: everything is allowed, nothing is asked
  await page.reload()
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.waitForTimeout(2000)
  await expect(sheet).toHaveCount(0)
  expect(errors).toEqual([])
})

test('notifications once refused: their settings open; back in the app it sees the change', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await asPhone(page, { notify: 'prompt', call: true, asked: [], refuse: true })
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const sheet = page.locator('.perm')
  await expect(sheet.locator('.perm-row', { hasText: 'Зангҳои Маҳлиё' })).toHaveClass(/is-on/)
  await sheet.locator('.perm-row', { hasText: 'Огоҳиномаҳо' }).getByRole('button', { name: 'Иҷозат' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __phone: Phone }).__phone.asked)).toEqual(['notify-dialog', 'notify-settings'])
  await expect(sheet).toBeVisible()
  // she turned them on in the settings and came back
  await page.evaluate(() => {
    (window as unknown as { __phone: Phone }).__phone.notify = 'granted'
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(sheet).toHaveCount(0)
  expect(errors).toEqual([])
})

test('"Баъдтар" puts it off until the next opening, which asks again', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await asPhone(page, { notify: 'denied', call: false, asked: [] })
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const sheet = page.locator('.perm')
  await sheet.getByRole('button', { name: 'Баъдтар' }).click()
  await expect(sheet).toHaveCount(0)
  // within the same opening, moving between pages asks nothing
  await page.locator('.dock').getByRole('link').nth(1).click()
  await page.waitForTimeout(2000)
  await expect(sheet).toHaveCount(0)
  await page.reload()
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(sheet).toBeVisible()
  expect(errors).toEqual([])
})

test('in the browser, nothing is asked', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.waitForTimeout(2000)
  await expect(page.locator('.perm')).toHaveCount(0)
  expect(errors).toEqual([])
})

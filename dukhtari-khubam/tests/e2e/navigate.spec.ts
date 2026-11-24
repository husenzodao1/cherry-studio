import { readFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { routeOf } from '../../src/server/navigate'
import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const USER = { id: '00000000-0000-0000-0000-0000000000cc', aud: 'authenticated', role: 'authenticated', email: 'm@gmail.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = () => {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: USER.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
}
// a real walk in Dushanbe, as the route service answered it
const ROUTE = routeOf(JSON.parse(readFileSync('tests/unit/fixtures/osrm-dushanbe.json', 'utf8')))!
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64')

async function setUp(page: Page) {
  await signedIn(page)
  const session = { access_token: token(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER }
  await page.addInitScript((s) => localStorage.setItem('sb-dqavtyrdipwwgeckxxhr-auth-token', JSON.stringify(s)), session)
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json(USER)))
  await page.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }))
  // she walks the way: each call of the test moves her to the next point it gives
  await page.addInitScript((start) => {
    const w = window as unknown as { __walk: (p: [number, number]) => void }
    const watchers: PositionCallback[] = []
    let at = start
    const fix = () => ({ coords: { latitude: at[0], longitude: at[1], accuracy: 8, heading: 90, speed: 1.3 }, timestamp: Date.now() }) as unknown as GeolocationPosition
    navigator.geolocation.watchPosition = ((ok: PositionCallback) => { watchers.push(ok); setTimeout(() => ok(fix()), 50); return watchers.length }) as typeof navigator.geolocation.watchPosition
    navigator.geolocation.clearWatch = ((id: number) => { watchers[id - 1] = () => undefined }) as typeof navigator.geolocation.clearWatch
    w.__walk = (p) => { at = p; watchers.forEach((f) => f(fix())) }
  }, ROUTE.line[0])
}

test('"Маро бубар": the place found near her, the way drawn, each turn said before it, a new way when she leaves it, then "arrived"', async ({ page, server: _, errors }) => {
  await setUp(page)
  const asked: string[] = []
  let routes = 0
  await page.route('**/api/v1/nav/places**', (r) => { asked.push(r.request().url()); return r.fulfill(json({ places: [{ name: 'Донишгоҳи миллии Тоҷикистон', address: 'хиёбони Рӯдакӣ, Душанбе', lat: ROUTE.line.at(-1)![0], lon: ROUTE.line.at(-1)![1] }] })) })
  await page.route('**/api/v1/nav/route**', (r) => { routes++; return r.fulfill(json(ROUTE)) })

  // Mahliyo's "take me to …" opens it with the place: the nearest one found is taken at once
  await page.goto('/navigate?to=Донишгоҳи%20миллӣ')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.nav-search input')).toHaveValue('Донишгоҳи миллии Тоҷикистон')
  expect(asked.some((u) => u.includes('near='))).toBe(true)
  // the way: its time and length; on foot first
  await expect(page.locator('.nav-left b')).toHaveText(/дақ/)
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(2)
  await page.screenshot({ path: 'test-results/navigate-route.png' })

  await page.getByRole('button', { name: 'Оғоз' }).click()
  const turn = page.locator('.nav-turn')
  await expect(turn).toBeVisible()
  // at the third turn: the next is the fourth — right, onto кӯчаи Шероз — with its distance
  await page.evaluate((p) => (window as unknown as { __walk: (p: [number, number]) => void }).__walk(p), ROUTE.steps[2].at)
  await expect(turn).toContainText('ба рост гардед — кӯчаи Шероз')
  await expect(turn.locator('b')).toHaveText(/^\d+ м$/)
  // the way stays drawn around her while she goes
  await page.waitForTimeout(600)
  const way = (await page.locator('.leaflet-overlay-pane path').last().boundingBox())!
  expect(way.width + way.height).toBeGreaterThan(100)
  await page.screenshot({ path: 'test-results/navigate-going.png' })
  // past it: straight on, onto кӯчаи Истаравшан
  await page.evaluate((p) => (window as unknown as { __walk: (p: [number, number]) => void }).__walk(p), ROUTE.steps[3].at)
  await expect(turn).toContainText('рост равед — кӯчаи Истаравшан')

  // far from the way, twice: a new way is asked
  const away: [number, number] = [ROUTE.line[0][0] + 0.01, ROUTE.line[0][1] - 0.01]
  await page.evaluate((p) => (window as unknown as { __walk: (p: [number, number]) => void }).__walk(p), away)
  await page.evaluate((p) => (window as unknown as { __walk: (p: [number, number]) => void }).__walk(p), away)
  await expect.poll(() => routes).toBe(2)

  // at the place: arrived
  await page.evaluate((p) => (window as unknown as { __walk: (p: [number, number]) => void }).__walk(p), ROUTE.line.at(-1)!)
  await expect(page.locator('.nav-arrived')).toContainText('Шумо расидед!')
  expect(errors).toEqual([])
})

test('"Маро бубар": a place the map does not know — she is asked which well-known place it is near, and it is found by it', async ({ page, server: _, errors }) => {
  await setUp(page)
  const asked: string[] = []
  await page.route('**/api/v1/nav/places**', (r) => {
    const url = decodeURIComponent(r.request().url())
    asked.push(url)
    if (url.includes('q=бозори Панҷшанбе')) return r.fulfill(json({ places: [{ name: 'Бозори Панҷшанбе', address: 'Хуҷанд', lat: 40.2846, lon: 69.6234 }] }))
    if (url.includes('q=Афғонбозор') && url.includes('near=40.2846')) return r.fulfill(json({ places: [{ name: 'Афғонбозор', address: 'кӯчаи Ленин, Хуҷанд', lat: 40.2861, lon: 69.6301 }] }))
    return r.fulfill(json({ places: [] }))
  })
  await page.route('**/api/v1/nav/route**', (r) => r.fulfill(json(ROUTE)))
  await page.goto('/navigate?to=Афғонбозор')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.nav-ask')).toContainText('Ин ҷой дар харита ёфт нашуд')
  await page.locator('.nav-ask input').fill('бозори Панҷшанбе')
  await page.screenshot({ path: 'test-results/navigate-ask.png' })
  await page.locator('.nav-ask button[type=submit]').click()
  await page.getByRole('option', { name: /Афғонбозор/ }).click()
  await expect(page.locator('.nav-left b')).toHaveText(/дақ/)
  expect(errors).toEqual([])
})

test('"Маро бубар" without Premium while the plans are on: locked, its button opens the plans', async ({ page, server: _, errors }) => {
  await setUp(page)
  await page.route('**/api/v1/plans', (r) => r.fulfill(json({ live: true })))
  await page.route('**/api/v1/me/plan', (r) => r.fulfill(json({ plan: 'standard' })))
  await page.goto('/navigate')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.ws-locked')).toContainText('«Маро бубар» — дар Premium')
  await page.locator('.ws-locked .btn').click()
  await expect(page.locator('.pw-over')).toBeVisible()
  expect(errors).toEqual([])
})

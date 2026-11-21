import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Locator, Page } from '@playwright/test'

import { SPOT_IDS, type SpotId } from '../../src/lib/aiCatalog'
import { PROGRESS, signedIn, test } from '../../tests/e2e/fixtures'

/**
 * Screenshots of the app's screens for Mahliyo AI's "screen" blocks: for every place she can point at
 * (lib/aiCatalog SPOTS), the screen it is on, scrolled so the place is in view, and where the place is in
 * the picture (% of it) → src/lib/aiSpots.json. The pictures go to OUT as PNG; tools/ai-screens/webp.py
 * makes the small WebP files the app ships (public/assets/ai-screens).
 * The app runs as a phone app would (native-only rows shown), signed in, with the live Tajik catalogue
 * saved first: curl -o test-results/bundle-tg.json "https://dukhtari-khubam.vercel.app/api/v1/bundle?locale=tg"
 */
const OUT = process.env.AI_SCREENS_OUT ?? 'test-results/ai-screens'
const BUNDLE = process.env.AI_SCREENS_BUNDLE ?? 'test-results/bundle-tg.json'

type Screen = { path: string; lock?: 'pad' | 'questions' | 'email'; spots: [SpotId, (p: Page) => Locator][] }
const row = (text: RegExp) => (p: Page) => p.locator('.menu-row', { hasText: text }).first()
const SCREENS: Screen[] = [
  { path: '/', spots: [
    ['home.profile', (p) => p.locator('.home-avatar')], ['home.download', (p) => p.locator('.install-btn')],
    ['home.search', (p) => p.locator('.search-btn')], ['home.settings', (p) => p.locator('.more-btn')],
    ['home.start', (p) => p.locator('.pill-card').first()], ['home.words', (p) => p.locator('.words')],
    ['home.schools', (p) => p.locator('.home-schools')], ['home.tabs', (p) => p.locator('.dock')]
  ] },
  { path: '/settings', spots: [
    ['settings.language', (p) => p.locator('.theme-box', { has: p.locator('.lang-badge') })],
    ['settings.theme', (p) => p.locator('.theme-box', { has: p.locator('.theme-swatch') })],
    ['settings.textsize', (p) => p.locator('.glass', { has: p.locator('.text-sizes') })],
    ['settings.support', row(/^Дастгирӣ/)], ['settings.privacy', row(/Махфият/)], ['settings.about', row(/Дар бораи барнома/)],
    ['settings.version', (p) => p.locator('.menu-row', { has: p.locator('.version-num') })], ['settings.signout', (p) => p.locator('.menu-row.danger')],
    ['settings.rate', (p) => p.locator('.rate-box').first().locator('..')], ['settings.pin', (p) => p.locator('.glass.menu', { has: p.locator('button.switch[aria-label="Қулфи барнома"]') })]
  ] },
  { path: '/profile', spots: [['profile.photo', (p) => p.locator('.photo-btn')], ['profile.map', (p) => p.locator('.menu-row[href="/garden"]')]] },
  { path: '/garden', spots: [['map.legend', (p) => p.locator('.map-legend')], ['map.next', (p) => p.locator('.map-stop.is-next').first()]] },
  { path: '/schools', spots: [['schools.list', (p) => p.locator('.tile-link').first()]] },
  { path: '/support', spots: [['support.write', (p) => p.locator('.chat-form')]] },
  { path: '/', lock: 'pad', spots: [['lock.forgot', (p) => p.getByRole('button', { name: 'Фаромӯш кардед?' })]] },
  { path: '/', lock: 'questions', spots: [['lock.no_answers', (p) => p.locator('.recovery-foot .pin-small')]] },
  { path: '/', lock: 'email', spots: [['lock.no_email', (p) => p.getByRole('button', { name: 'Ба почта низ дастрасӣ нест?' })]] }
]

test.describe.configure({ mode: 'serial' })
const rects: Record<string, { x: number; y: number; w: number; h: number }> = {}

for (const screen of SCREENS) {
  test(`${screen.path}${screen.lock ? ` (${screen.lock})` : ''}`, async ({ page, server: _ }) => {
    mkdirSync(OUT, { recursive: true })
    // the live catalogue (Tajik), so the pictures show the real schools and lessons
    const live = JSON.parse(readFileSync(BUNDLE, 'utf8'))
    await page.route('**/api/v1/bundle**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(live) }))
    await page.route('**/api/v1/support/thread', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ thread: null }) }))
    await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ready: true }) }))
    // a phone app: the rows only the app has (PIN, version, notifications) are drawn; native calls stay unanswered
    // (the PIN screens are drawn as on the website: they wait for no native call there)
    await page.addInitScript((native) => {
      if (native) (window as unknown as { androidBridge: unknown }).androidBridge = { postMessage: () => undefined }
      // no greeting from Mahliyo over the screen
      sessionStorage.setItem('dk.greeted', '1')
    }, !screen.lock)
    const lesson = Object.keys(live.lessons ?? {})[0]
    const now = new Date().toISOString()
    await signedIn(page)
    await page.addInitScript(([p, l, at]) => {
      // a learner a little way into her studies: a lesson begun, a few days of study
      const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
      localStorage.setItem('dk.progress', JSON.stringify({ ...p, days: [day(2), day(1), day(0)], ...(l ? { lessons: { [l]: { p: 45, at } }, last: { lesson: l, at } } : {}) }))
    }, [PROGRESS, lesson, now] as const)
    if (screen.lock) {
      await page.addInitScript((questions) => {
        localStorage.setItem('dk.pin', JSON.stringify({ salt: '00', hash: 'x', fails: 0, until: 0 }))
        const item = (q: string) => ({ q, salt: '00', hash: 'x' })
        if (questions) localStorage.setItem('dk.pin_recovery', JSON.stringify({ items: [item('food'), item('teacher'), item('city')], fails: 0, until: 0 }))
      }, screen.lock !== 'pad')
    }
    await page.goto(screen.path)
    if (screen.lock === 'questions' || screen.lock === 'email') await page.getByRole('button', { name: 'Фаромӯш кардед?' }).click()
    if (screen.lock === 'email') await page.locator('.recovery-foot .pin-small').click()
    // the entrance animations and pictures settle; nothing floats over the screen
    await page.waitForTimeout(2500)
    await page.addStyleTag({ content: '.mascot, .update-note, .toast { display: none !important; }' })
    for (const [spot, find] of screen.spots) {
      const el = find(page)
      await el.waitFor({ state: 'visible', timeout: 20_000 })
      await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }))
      await page.waitForTimeout(700)
      const box = (await el.boundingBox())!
      const vp = page.viewportSize()!
      const pct = (v: number, of: number) => Math.round((v / of) * 1000) / 10
      const x = Math.max(0, box.x)
      const y = Math.max(0, box.y)
      rects[spot] = {
        x: pct(x, vp.width), y: pct(y, vp.height),
        w: pct(Math.min(vp.width, box.x + box.width) - x, vp.width), h: pct(Math.min(vp.height, box.y + box.height) - y, vp.height)
      }
      await page.screenshot({ path: join(OUT, `${spot}.png`), animations: 'disabled' })
    }
  })
}

test.afterAll(() => {
  const missing = SPOT_IDS.filter((s) => !rects[s])
  if (missing.length) throw new Error(`no picture for: ${missing.join(', ')}`)
  const sorted = Object.fromEntries(SPOT_IDS.map((s) => [s, rects[s]]))
  writeFileSync('src/lib/aiSpots.json', `${JSON.stringify(sorted, null, 2)}\n`)
})

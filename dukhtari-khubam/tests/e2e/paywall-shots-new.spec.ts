/**
 * The plans screen's pictures of the newer features (public/assets/paywall/<locale>): the student Workspace,
 * "Маро бубар" on its way and "Эй Маҳлиё" answering, in each language. Run only on purpose:
 * SHOTS=1 npx playwright test paywall-shots-new
 */
import { mkdirSync, readFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { routeOf } from '../../src/server/navigate'
import { LOCALES, type Locale } from '../../src/web/i18n'
import { signedIn, test } from './fixtures'
import { asPhone } from './phone'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const OUT = process.env.SHOTS_OUT ?? 'test-results/paywall'
const ROUTE = routeOf(JSON.parse(readFileSync('tests/unit/fixtures/osrm-dushanbe.json', 'utf8')))!

test.skip(!process.env.SHOTS, 'pictures for the plans screen: SHOTS=1')

const USER = { id: '00000000-0000-0000-0000-0000000000dd', aud: 'authenticated', role: 'authenticated', email: 'm@gmail.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
async function withPremium(page: Page, locale: Locale) {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const token = `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: USER.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
  await page.addInitScript(([s, l]) => {
    localStorage.setItem('sb-dqavtyrdipwwgeckxxhr-auth-token', JSON.stringify(s))
    localStorage.setItem('dk.prefs', JSON.stringify({ locale: l, mode: 'girl', theme: 'peach' }))
  }, [{ access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER }, locale] as const)
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json(USER)))
  await page.route('**/api/v1/me/plan', (r) => r.fulfill(json({ plan: 'premium' })))
}
const shot = async (page: Page, locale: Locale, name: string) => {
  mkdirSync(`${OUT}/${locale}`, { recursive: true })
  await page.screenshot({ path: `${OUT}/${locale}/${name}.png` })
}

/** the materials on her Workspace, by subject, in each language */
const DOCS: Record<Locale, [string, string, number][]> = {
  tg: [['Анатомия — лексияи 4: Дил', 'Анатомия', 38], ['Физика: Қонунҳои Нютон', 'Физика', 22], ['Таърихи халқи тоҷик, боби 3', 'Таърих', 54], ['Химия: Пайвастҳои органикӣ', 'Химия', 31]],
  ru: [['Анатомия — лекция 4: Сердце', 'Анатомия', 38], ['Физика: Законы Ньютона', 'Физика', 22], ['История, глава 3', 'История', 54], ['Химия: Органические соединения', 'Химия', 31]],
  en: [['Anatomy — lecture 4: The heart', 'Anatomy', 38], ["Physics: Newton's laws", 'Physics', 22], ['History, chapter 3', 'History', 54], ['Chemistry: Organic compounds', 'Chemistry', 31]],
  uz: [["Anatomiya — 4-ma'ruza: Yurak", 'Anatomiya', 38], ['Fizika: Nyuton qonunlari', 'Fizika', 22], ['Tarix, 3-bob', 'Tarix', 54], ["Kimyo: Organik birikmalar", 'Kimyo', 31]],
  tr: [['Anatomi — 4. ders: Kalp', 'Anatomi', 38], ['Fizik: Newton yasaları', 'Fizik', 22], ['Tarih, 3. bölüm', 'Tarih', 54], ['Kimya: Organik bileşikler', 'Kimya', 31]],
  fa: [['آناتومی — درس ۴: قلب', 'آناتومی', 38], ['فیزیک: قوانین نیوتن', 'فیزیک', 22], ['تاریخ، فصل ۳', 'تاریخ', 54], ['شیمی: ترکیبات آلی', 'شیمی', 31]],
  prs: [['اناتومی — درس ۴: قلب', 'اناتومی', 38], ['فزیک: قوانین نیوتن', 'فزیک', 22], ['تاریخ، فصل ۳', 'تاریخ', 54], ['کیمیا: ترکیبات عضوی', 'کیمیا', 31]]
}
/** the place she goes to, and what she asks "Эй Маҳлиё" */
const PLACE: Record<Locale, string> = { tg: 'Донишгоҳи миллии Тоҷикистон', ru: 'Таджикский национальный университет', en: 'Tajik National University', uz: 'Tojikiston milliy universiteti', tr: 'Tacikistan Millî Üniversitesi', fa: 'دانشگاه ملی تاجیکستان', prs: 'پوهنتون ملی تاجیکستان' }
const ASK: Record<Locale, string> = { tg: 'эй маҳлиё соат чанд шуд', ru: 'махлиё который час', en: 'mahliyo what time is it', uz: 'mahliyo soat necha', tr: 'mahliyo saat kaç', fa: 'مهلیو ساعت چند است', prs: 'مهلیو ساعت چند است' }

test.use({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 2 })

for (const locale of LOCALES) {
  test.describe(locale, () => {
    test('workspace', async ({ page, server: _ }) => {
      await signedIn(page)
      await withPremium(page, locale)
      const docs = DOCS[locale].map(([title, subject, pages], i) => ({ id: `1111111${i}-1111-4111-8111-111111111111`, title, file: `${title}.pdf`, subject, pages, chunks: pages * 3, status: 'ready', at: new Date(Date.now() - i * 86_400_000).toISOString() }))
      await page.route('**/api/v1/me/workspace', (r) => r.fulfill(json({ allowed: true, room: { docs: 60, chunks: 12000 }, used: 435, docs })))
      await page.goto('/workspace')
      await page.locator('#splash').waitFor({ state: 'hidden', timeout: 15_000 })
      await page.locator('.ws-doc').first().waitFor()
      // her materials in view, under the box to ask about them
      await page.evaluate(() => { document.querySelectorAll('.ws-doc')[1]?.scrollIntoView({ block: 'center' }); window.scrollTo(0, document.documentElement.scrollHeight) })
      await page.waitForTimeout(1200)
      await shot(page, locale, 'workspace')
    })

    test('navigate', async ({ page, server: _ }) => {
      await signedIn(page)
      await withPremium(page, locale)
      await page.addInitScript((start) => {
        const w = window as unknown as { __walk: (p: [number, number]) => void }
        const watchers: PositionCallback[] = []
        let at = start
        const fix = () => ({ coords: { latitude: at[0], longitude: at[1], accuracy: 8, heading: 90, speed: 1.3 }, timestamp: Date.now() }) as unknown as GeolocationPosition
        navigator.geolocation.watchPosition = ((ok: PositionCallback) => { watchers.push(ok); setTimeout(() => ok(fix()), 50); return watchers.length }) as typeof navigator.geolocation.watchPosition
        navigator.geolocation.clearWatch = (() => undefined) as typeof navigator.geolocation.clearWatch
        w.__walk = (p) => { at = p; watchers.forEach((f) => f(fix())) }
      }, ROUTE.line[0])
      const end = ROUTE.line.at(-1)!
      await page.route('**/api/v1/nav/places**', (r) => r.fulfill(json({ places: [{ name: PLACE[locale], address: 'Душанбе', lat: end[0], lon: end[1] }] })))
      await page.route('**/api/v1/nav/route**', (r) => r.fulfill(json(ROUTE)))
      await page.goto(`/navigate?to=${encodeURIComponent(PLACE[locale])}`)
      await page.locator('#splash').waitFor({ state: 'hidden', timeout: 15_000 })
      await page.locator('.nav-go').click()
      await page.evaluate((p) => (window as unknown as { __walk: (p: [number, number]) => void }).__walk(p), ROUTE.steps[2].at)
      await page.locator('.nav-turn').waitFor()
      // the map's tiles
      await page.waitForTimeout(4000)
      await shot(page, locale, 'navigate')
    })

    test('hey', async ({ page, server: _ }) => {
      await signedIn(page)
      await withPremium(page, locale)
      await asPhone(page)
      await page.addInitScript((t) => (window as unknown as { __hear: string[] }).__hear.push(t), ASK[locale])
      await page.goto('/voice')
      await page.locator('#splash').waitFor({ state: 'hidden', timeout: 15_000 })
      await page.locator('.voice-answer').waitFor()
      await page.waitForTimeout(800)
      await shot(page, locale, 'hey')
    })
  })
}

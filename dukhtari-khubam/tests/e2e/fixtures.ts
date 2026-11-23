import { expect, test as base, type Page } from '@playwright/test'

const slugs = ['marifati-dini', 'odob-va-akhloq', 'farhangi-tojik', 'oila-va-munosibatho', 'ilm-va-salomati', 'rushdi-shakhsiyat', 'zindagii-muosir']
export const BUNDLE = {
  v: 1, locale: 'tg', version: 'e2e', generated_at: '', schoolDetails: {}, courses: {}, lessons: {}, quizzes: {}, pages: {}, ui: {},
  schools: slugs.map((slug, i) => ({ id: `s${i}`, slug, title: `Мактаб ${i + 1}`, course_count: 1 })),
  inspiration: null, achievements: [],
  inspirations: [{ id: 'i', body: 'Дониш нур аст.', author_name: 'Ҳикмат', source_title: 'Мардумӣ' }],
  poems: [{ id: 'p', body: 'Бӯи ҷӯи Мӯлиён ояд ҳаме,\nЁди ёри меҳрубон ояд ҳаме.', author_name: 'Рӯдакӣ', source_title: 'Бӯи ҷӯи Мӯлиён' }],
  stories: [{ id: 's', body: 'Як рӯз духтарак\nба боғ рафт.\n\nДар он ҷо гул шукуфта буд.', author_name: 'Нависанда', source_title: 'Боғ' }]
}
export const PROGRESS = { v: 1, born: 2008, birthday: '2008-03-01', about: { at: '2026-11-18T00:00:00Z' }, lessons: {}, quizzes: {}, bookmarks: {}, achievements: {}, days: [], review: {} }
const USER = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'e2e@gmail.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }

export interface Server { profile: unknown; codes: string[]; reports: string[]; ratings: unknown[]; pushes: number }

/**
 * Every test fails on any page error — uncaught (the kind that shows "This page couldn't load") or caught
 * and repaired by the app itself (reported to /client-error) —
 * and talks to a fake server: the catalogue, progress backup, e-mail codes ("111111" is wrong,
 * anything else right) and the profile an account keeps (`server.profile`).
 */
export const test = base.extend<{ server: Server; errors: string[] }>({
  server: async ({ page }, use) => {
    const server: Server = { profile: null, codes: [], reports: [], ratings: [], pushes: 0 }
    // the tests read the Tajik interface (a new phone starts in Russian: tested in sign-in.spec)
    await page.addInitScript(() => { if (!localStorage.getItem('dk.prefs')) localStorage.setItem('dk.prefs', JSON.stringify({ locale: 'tg', mode: 'girl' })) })
    const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
    await page.route('**/api/v1/bundle**', (r) => r.fulfill(json(BUNDLE)))
    // progress backup straight to Supabase: saved, no other phone wrote meanwhile
    await page.route('**/rest/v1/rpc/api_profile_push**', (r) => { server.pushes++; return r.fulfill(json({ updated_at: new Date().toISOString() })) })
    // errors the app caught and repaired by itself (web/heal.ts) are failures for a test all the same
    await page.route('**/api/v1/client-error', (r) => {
      server.reports.push(String((r.request().postDataJSON() as { message?: string }).message))
      if (process.env.E2E_DEBUG) console.log('REPORT', JSON.stringify(r.request().postDataJSON()).slice(0, 900))
      return r.fulfill(json({ ok: true }))
    })
    await page.route('**/api/v1/app-config', (r) => r.fulfill(json({ google_web_client_id: null })))
    // Mahliyo AI is not set up (tests that need her say so)
    await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill(json({ ready: false })))
    // not a consultant (tests that need one say so)
    await page.route('**/api/v1/consultant', (r) => r.fulfill(json({ consultant: false })))
    await page.route('**/auth/v1/otp**', (r) => r.fulfill(json({})))
    await page.route('**/auth/v1/verify**', (r) => {
      const token = (r.request().postDataJSON() as { token?: string }).token ?? ''
      server.codes.push(token)
      return r.fulfill(token === '111111' ? json({ code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, 403)
        : json({ access_token: 'e2e.e2e.e2e', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER }))
    })
    await page.route('**/auth/v1/logout**', (r) => r.fulfill({ status: 204, body: '' }))
    await page.route('**/rest/v1/rpc/api_google_profile**', (r) => r.fulfill(json(server.profile)))
    await page.route('**/rest/v1/rpc/api_rate_app**', (r) => { server.ratings.push(r.request().postDataJSON()); return r.fulfill(json(true)) })
    await page.route('**/rest/v1/rpc/api_google_link**', (r) => r.fulfill(json({})))
    await use(server)
  },
  errors: async ({ page, server }, use) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await use(errors)
    expect(errors, 'uncaught page errors').toEqual([])
    expect(server.reports, 'errors the app caught and repaired').toEqual([])
  }
})

/** A learner already on this phone. */
export async function signedIn(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript(([p, x]) => {
    localStorage.setItem('dk.learner', JSON.stringify({ name: 'Малика', code: '512345678901234', email: 'm@gmail.com', ...x }))
    localStorage.setItem('dk.progress', JSON.stringify(p))
    // tests may run at any hour: the time-of-day scenes stay off (their own test turns them on)
    if (!x.night) localStorage.setItem('dk.scene', 'off')
  }, [PROGRESS, extra] as const)
}

export { expect }

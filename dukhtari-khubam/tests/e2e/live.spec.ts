import type { Page } from '@playwright/test'

import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const USER = { id: '00000000-0000-0000-0000-0000000000a7', aud: 'authenticated', role: 'authenticated', email: 'm@gmail.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['microphone', 'camera'] })

async function withAccount(page: Page) {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const token = `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: USER.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
  await page.addInitScript((s) => localStorage.setItem('sb-dqavtyrdipwwgeckxxhr-auth-token', JSON.stringify(s)),
    { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER })
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json(USER)))
  await page.route('**/api/v1/me/plan', (r) => r.fulfill(json({ plan: 'premium' })))
  // the live connection, as a test gives it: what the app sends is kept, Gemini's messages are played from here
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    w.__sent = { audio: 0, video: 0, tools: [] as unknown[] }
    w.__dkLive = async (_token: string, _model: string, on: unknown) => {
      w.__on = on
      const sent = w.__sent as { audio: number; video: number; tools: unknown[] }
      return {
        sendRealtimeInput: (p: { audio?: unknown; video?: unknown }) => { if (p.audio) sent.audio++; if (p.video) sent.video++ },
        sendToolResponse: (p: unknown) => sent.tools.push(p),
        close: () => undefined
      }
    }
  })
}
const say = (page: Page, m: unknown) => page.evaluate((msg) => (window as unknown as { __on: { message: (m: unknown) => void } }).__on.message(msg), m)
const sent = (page: Page) => page.evaluate(() => (window as unknown as { __sent: { audio: number; video: number; tools: { functionResponses: { name: string; response: Record<string, unknown> }[] }[] } }).__sent)

test('Mahliyo live: a token for her part, her voice heard and written, a song asked for and played on the screen', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await withAccount(page)
  const asked: Record<string, unknown>[] = []
  await page.route('**/api/v1/voice/live', (r) => { asked.push(r.request().postDataJSON()); return r.fulfill(json({ token: 'auth_tokens/t1', model: 'gemini-3.8-live', seconds: 120, minutesLeft: 88 })) })
  await page.route('**/api/v1/music/find**', (r) => r.fulfill(json({ songs: [{ id: 'aaaaaaaaaaa', title: 'Ватан', channel: 'Шабнам Сурайё', thumb: '/assets/paywall/tg/song.webp' }] })))
  await page.goto('/voice')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect.poll(() => asked.length).toBe(1)
  expect(asked[0]).toMatchObject({ lang: 'tg', mode: 'assistant' })
  // her microphone goes to Mahliyo
  await expect.poll(async () => (await sent(page)).audio, { timeout: 8000 }).toBeGreaterThan(2)
  await say(page, { serverContent: { inputTranscription: { text: 'Суруди Ватанро гузор' } } })
  await expect(page.locator('.voice-said')).toHaveText('Суруди Ватанро гузор')
  await say(page, { toolCall: { functionCalls: [{ id: 'c1', name: 'play_song', args: { query: 'Шабнам Сурайё Ватан' } }] } })
  await expect(page.locator('.voice-song .song-title')).toHaveText('Ватан')
  await expect.poll(async () => (await sent(page)).tools.length).toBe(1)
  expect((await sent(page)).tools[0].functionResponses[0]).toMatchObject({ name: 'play_song', response: { result: 'playing on the screen' } })
  await say(page, { serverContent: { outputTranscription: { text: 'Ана, суруди «Ватан».' }, turnComplete: true } })
  await expect(page.locator('.voice-answer')).toHaveText('Ана, суруди «Ватан».')
  await page.screenshot({ path: 'test-results/live.png' })
  expect(errors).toEqual([])
})

test('Mahliyo live with the camera: frames go out only when the picture changes; her month spent opens the plans', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await withAccount(page)
  await page.route('**/api/v1/voice/live', (r) => r.fulfill(json({ token: 'auth_tokens/t2', model: 'gemini-3.8-live', seconds: 120, minutesLeft: 10 })))
  await page.goto('/voice?mode=camera')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.live-screen.has-camera')).toBeVisible()
  await expect.poll(async () => (await sent(page)).video, { timeout: 8000 }).toBeGreaterThan(0)
  const before = (await sent(page)).video
  await page.getByRole('button', { name: 'Акси тез' }).click()
  await expect.poll(async () => (await sent(page)).video).toBeGreaterThan(before)

  // another conversation, her minutes spent: the plans
  await page.unroute('**/api/v1/voice/live')
  await page.route('**/api/v1/voice/live', (r) => r.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: { code: 'plan_limit', message: 'x', details: { kind: 'live' } } }) }))
  await page.goto('/voice')
  await expect(page.locator('.pw-over')).toBeVisible({ timeout: 10_000 })
  expect(errors).toEqual([])
})

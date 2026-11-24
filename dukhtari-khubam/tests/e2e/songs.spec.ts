import { expect, signedIn, test } from './fixtures'
import { asPhone } from './phone'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const SONGS = [
  { id: 'aaaaaaaaaaa', title: 'Шабнам Сурайё — Ватан', channel: 'Shabnam Surayo', thumb: '/assets/paywall/tg/song.webp' },
  { id: 'bbbbbbbbbbb', title: 'Ватан (live)', channel: 'TV Safina', thumb: '/assets/paywall/tg/chat.webp' }
]

test('asked to play a song, Mahliyo finds it on YouTube and it plays in the chat; another one can be chosen', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const asked: string[] = []
  await page.route('**/api/v1/music/find**', (r) => { asked.push(decodeURIComponent(r.request().url())); return r.fulfill(json({ songs: SONGS })) })
  await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill(json({ ready: true })))
  await page.route('**/api/v1/mahliyo/ask', (r) => r.fulfill(json({ id: '00000000-0000-4000-8000-000000000002' })))
  const done = json({ status: 'done', tajik: true, reply: '', blocks: [{ type: 'text', text: 'Ана, суруди «Ватан» 🎶' }, { type: 'play', query: 'Шабнам Сурайё Ватан', title: 'Ватан' }] })
  await page.route('**/api/v1/mahliyo/answer', (r) => r.fulfill(done))
  await page.route('**/rest/v1/rpc/api_mahliyo_result', (r) => r.fulfill(done))
  await page.goto('/mahliyo')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('textarea.ai-input').fill('Суруди Ватанро аз Шабнам Сурайё гузор')
  await page.locator('textarea.ai-input').press('Enter')
  await expect(page.locator('.ai-play .song-title')).toHaveText('Шабнам Сурайё — Ватан')
  expect(asked[0]).toContain('q=Шабнам Сурайё Ватан')
  await page.locator('.ai-play').screenshot({ path: 'test-results/song.png' })
  await page.locator('.song-other').first().click()
  await expect(page.locator('.ai-play .song-title')).toHaveText('Ватан (live)')
  expect(errors).toEqual([])
})

test('"Эй Маҳлиё, включи песню …": said, then found and shown on the voice screen', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await asPhone(page)
  await page.route('**/api/v1/music/find**', (r) => r.fulfill(json({ songs: SONGS })))
  await page.addInitScript(() => (window as unknown as { __hear: string[] }).__hear.push('махлиё включи песню шабнам сурайё ватан'))
  await page.goto('/voice')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.voice-song .song-title')).toHaveText('Шабнам Сурайё — Ватан')
  expect(errors).toEqual([])
})

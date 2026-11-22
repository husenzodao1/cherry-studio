import { BUNDLE, expect, signedIn, test } from './fixtures'
const rich = (text: string) => ({ spans: [{ text }] })
const L = '55555555-5555-4555-8555-555555555555'
const asset = (id: string, url: string, w: number, h: number) => ({ id, kind: 'image', bucket: 'media', path: url, url, mime_type: 'image/webp', width: w, height: h })
test('pictures sit in 16:9 or 1:1 frames, open whole on a tap; sources show as chips with the site\'s icon', async ({ page, server: _, errors }) => {
  const lesson = { id: L, title: 'Намуна', locked: false, locale: 'tg', context: { school: { title: 'S' }, course: { id: 'c', title: 'C' } },
    position: { index: 1, total: 1 }, assets: { tall: asset('tall', '/assets/3d/glass-tulip.webp', 440, 616), wide: asset('wide', '/assets/3d/school-family.webp', 1600, 900) },
    blocks: [
      { id: 'i1', type: 'image', props: { asset_id: 'tall', source_url: 'https://www.instagram.com/p/x' }, content: { caption: 'Расми дароз → 1:1' } },
      { id: 'i2', type: 'image', props: { asset_id: 'wide' }, content: { caption: 'Расми паҳн → 16:9', source: 'https://t.me/kanal/1' } },
      { id: 's1', type: 'source', props: { url: 'https://google.com' }, content: { title: 'Ҳусейнзода Руслан/ шеърҳо', author: 'Ҳусейнзода', year: '2008' } },
      { id: 's2', type: 'source', props: {}, content: { title: 'Шоҳнома', author: 'Фирдавсӣ' } },
      { id: 'q1', type: 'quote', props: {}, content: { text: rich('Иқтибос барои намуна.'), author: 'Ҳусейнзода', source: 'https://google.com' } }
    ] }
  await page.route('**/api/v1/bundle**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...BUNDLE, courses: { c: { id: 'c', title: 'C', goals: [], locked: false, prerequisites: [], quizzes: [], modules: [{ id: 'm', title: 'm', quizzes: [], topics: [{ id: 't', title: 't', quizzes: [], lessons: [{ id: L, title: 'Намуна', locked: false }] }] }] } }, lessons: { [L]: lesson } }) }))
  await signedIn(page)
  await page.goto(`/lesson?id=${L}`)
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const pics = page.locator('.pic')
  await expect(pics).toHaveCount(2)
  // a tall picture: square frame; a wide one: 16:9
  await expect(pics.nth(0)).toHaveAttribute('data-frame', 'square')
  await expect(pics.nth(1)).toHaveAttribute('data-frame', 'wide')
  const box = (await pics.nth(1).boundingBox())!
  expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.02)
  // sources: the site's name on a chip, never "Манбаъ: …"
  await expect(pics.nth(0).locator('.src-chip')).toHaveText('Instagram')
  await expect(pics.nth(1).locator('.src-chip')).toHaveText('Telegram')
  await expect(page.locator('.src-line').first()).toContainText('Google')
  await expect(page.locator('.src-line').first()).toContainText('Ҳусейнзода Руслан/ шеърҳо')
  await expect(page.locator('.src-line').nth(1).locator('.src-chip')).toHaveText('Шоҳнома')
  await expect(page.locator('.quote-cite .src-chip')).toHaveText('Google')
  await expect(page.getByText(/Манбаъ:/)).toHaveCount(0)
  // a tap shows the whole picture, another closes it
  await pics.nth(0).locator('.pic-open').click()
  const big = page.locator('.lightbox img')
  await expect(big).toBeVisible()
  expect(await big.evaluate((el) => getComputedStyle(el).objectFit)).toBe('contain')
  await page.locator('.lightbox').click()
  await expect(page.locator('.lightbox')).toHaveCount(0)
  expect(errors).toEqual([])
})

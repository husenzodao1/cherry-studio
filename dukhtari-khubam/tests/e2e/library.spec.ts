import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const book = (id: string, title: string, author: string, cover: string) => ({ id, title, author, about: `«${title}» — ${author}. Китоби тавсияшуда барои хонандагон.`, cover, file: null, pages: 300 })

test('the Library from the schools: books on shelves by category, a search, a tapped book comes forward', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.route('**/api/v1/library**', (r) => r.fulfill(json({ shelves: [
    { id: 's1', title: 'Адабиёти классикӣ', emoji: '📜', books: [
      book('b1', 'Шоҳнома', 'Абулқосим Фирдавсӣ', '/assets/paywall/tg/chat.webp'), book('b2', 'Гулистон', 'Саъдии Шерозӣ', '/assets/paywall/tg/slides.webp'),
      book('b3', 'Маснавии маънавӣ', 'Ҷалолиддини Румӣ', '/assets/paywall/tg/song.webp')
    ] },
    { id: 's2', title: 'Илм', emoji: '🔬', books: [book('b4', 'Таърихи мухтасари замон', 'Стивен Хокинг', '/assets/paywall/tg/quiz.webp')] },
    { id: 's3', title: 'Холӣ', emoji: '📦', books: [] }
  ] })))
  await page.goto('/schools')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('.lib-entry').click()
  await expect(page).toHaveURL(/\/library/)
  // an empty shelf is not shown
  await expect(page.locator('.lib-shelf')).toHaveCount(2)
  await expect(page.locator('.lib-book')).toHaveCount(4)
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'test-results/library.png' })
  // a search by author, Tajik letters typed as Russian ones
  await page.locator('.lib-search input').fill('руми')
  await expect(page.locator('.lib-book')).toHaveCount(1)
  await page.locator('.lib-book').click()
  await expect(page.locator('.lib-open')).toContainText('Маснавии маънавӣ')
  await expect(page.locator('.lib-open')).toContainText('Ҷалолиддини Румӣ')
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'test-results/library-open.png' })
  expect(errors).toEqual([])
})

import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

test('the words of the day turn into the news by the small switch: picture, title, words over a shadow; kept so', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.route('**/api/v1/news**', (r) => r.fulfill(json({ items: [
    { id: 'n1', title: 'Олимпиадаи ҷумҳуриявӣ оғоз шуд', body: 'Сабти ном то 1 декабр идома дорад. Барои иштирок ба мактаби худ муроҷиат кунед — ғолибон ба озмуни байналмилалӣ мераванд.', image: '/assets/mascot/salom.webp', at: '2026-11-24T08:00:00Z' },
    { id: 'n2', title: 'Китобхонаи нав', body: 'Дар бахши мактабҳо китобхона кушода шуд.', image: null, at: '2026-11-23T08:00:00Z' }
  ] })))
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const sw = page.locator('.words-switch')
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  await sw.click()
  await expect(page.locator('.words.is-news .words-label')).toContainText('Хабарҳо')
  await expect(page.locator('.news-item.is-in')).toContainText('Олимпиадаи ҷумҳуриявӣ оғоз шуд')
  await page.waitForTimeout(700)
  await page.locator('.words').screenshot({ path: 'test-results/news.png' })
  await page.reload()
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.words.is-news')).toBeVisible()
  await page.locator('.words-switch').click()
  await expect(page.locator('.words:not(.is-news) .words-label')).toContainText('Суханҳои рӯз')
  expect(errors).toEqual([])
})

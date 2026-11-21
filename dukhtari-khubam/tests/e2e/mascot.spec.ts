import { BUNDLE, expect, signedIn, test } from './fixtures'

const opt = (id: string, text: string) => ({ id, text })
const question = (id: string) => ({ id, type: 'single_choice', points: 1, prompt: `Савол ${id}`, options: [opt(`${id}a`, 'Дуруст'), opt(`${id}b`, 'Нодуруст')] })
const grading = (id: string) => ({ partial_credit: false, penalty: 0, case_sensitive: false, ignore_punctuation: true, key: { correct_option_ids: [`${id}a`] } })
const QUIZ = {
  locale: 'tg',
  quiz: { id: 'qz', title: 'Санҷиш', pass_score_percent: 70, show_explanations: 'after_each', show_correct_answers: 'after_each', question_count: 3 },
  questions: ['1', '2', '3'].map(question),
  settings: { shuffle_questions: false, shuffle_options: false, allow_retry: true },
  grading: Object.fromEntries(['1', '2', '3'].map((id) => [id, grading(id)]))
}

test('she greets on opening the app (once per opening), says "stop" after two wrong answers in a row and reacts to the result', async ({ page, server: _, errors }) => {
  await page.route('**/api/v1/bundle**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...BUNDLE, quizzes: { qz: QUIZ } }) }))
  await signedIn(page)
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const card = page.locator('.mascot')
  await expect(card).toBeVisible({ timeout: 8000 })
  // her picture for this moment is there and drawn
  await expect(card.locator('.mascot-girl img')).toHaveAttribute('src', /^\/assets\/mascot\/(salom|calm)\.webp$/)
  await expect.poll(() => card.locator('.mascot-girl img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(300)
  // the card floats above the page: a soft shadow under it, a faint glow round her
  expect(await card.evaluate((e) => getComputedStyle(e).boxShadow)).toContain('rgba')
  expect(await card.locator('.mascot-girl img').evaluate((e) => getComputedStyle(e).filter)).toContain('drop-shadow')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'test-results/mascot-home.png' })
  // a tap closes it, and the same day it does not come back
  await card.click()
  await expect(card).toHaveCount(0)
  await page.reload()
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.waitForTimeout(3000)
  await expect(card).toHaveCount(0)

  await page.goto('/quiz?id=qz')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.getByRole('button', { name: /Оғоз/ }).click()
  for (const n of [1, 2]) {
    await page.getByRole('radio', { name: 'Нодуруст', exact: true }).click()
    await page.getByRole('button', { name: /^Санҷиш/ }).click()
    if (n === 1) await page.getByRole('button', { name: /Навбатӣ/ }).click()
  }
  await expect(card).toHaveClass(/is-stop/)
  await expect(card.locator('.mascot-girl img')).toHaveAttribute('src', /^\/assets\/mascot\/(stop|oops)\.webp$/)
  await expect(card.locator('.mascot-text')).toHaveText(/./)
  await page.screenshot({ path: 'test-results/mascot-stop.png' })
  await page.getByRole('button', { name: /Навбатӣ/ }).click()
  await page.getByRole('radio', { name: 'Дуруст', exact: true }).click()
  await page.getByRole('button', { name: /^Санҷиш/ }).click()
  await page.getByRole('button', { name: /Супоридан/ }).click()
  await expect(card).toHaveClass(/is-failed/)
  expect(errors).toEqual([])
})

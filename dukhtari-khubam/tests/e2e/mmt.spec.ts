import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const q = (id: string, subject: string, difficulty: 1 | 2 | 3, topic: string) => ({
  id, subject, topic, difficulty, question: `${topic}: савол ${id}`, options: ['10', '20', '30', '40'], answer: 1, explanation: `Шарҳи ${id}`, source: null
})

test('ММТ: a cluster, an adaptive mock exam, the predicted score, chances against last year and a plan', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.route('**/api/v1/mmt/catalog', (r) => r.fulfill(json({ exam_date: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10), subjects: [
    { id: 'math', name: 'Математика', clusters: [1, 2], max_points: 120, questions: 300 },
    { id: 'tajik', name: 'Забони тоҷикӣ', clusters: [1, 2, 3, 4, 5], max_points: 100, questions: 200 },
    { id: 'bio', name: 'Биология', clusters: [3], max_points: 100, questions: 50 }
  ] })))
  await page.route('**/api/v1/mmt/programs?cluster=1', (r) => r.fulfill(json({ programs: [
    { id: 'p1', university: 'ДМТ', specialty: 'Информатика', code: null, year: 2026, form: 'budget', min_score: 205, places: 25, city: 'Душанбе' },
    { id: 'p2', university: 'ДТТ', specialty: 'Иқтисод', code: null, year: 2026, form: 'contract', min_score: 60, places: null, city: null }
  ] })))
  let asked: Record<string, unknown> | null = null
  await page.route('**/api/v1/mmt/exam', (r) => {
    asked = r.request().postDataJSON() as Record<string, unknown>
    return r.fulfill(json({ questions: [
      q('m1', 'math', 1, 'Касрҳо'), q('m2', 'math', 2, 'Логарифм'), q('m3', 'math', 3, 'Тригонометрия'),
      q('t1', 'tajik', 1, 'Имло'), q('t2', 'tajik', 2, 'Синтаксис'), q('t3', 'tajik', 3, 'Услуб')
    ] }))
  })

  await page.goto('/schools')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('.lib-entry[href="/mmt"]').click()
  await expect(page).toHaveURL(/\/mmt/)
  await page.getByRole('button', { name: 'Кластери 1' }).click()
  // only the cluster's subjects
  await expect(page.locator('.mmt-subject')).toHaveCount(2)
  await expect(page.getByText('Биология')).toHaveCount(0)
  await expect(page.getByText('То ММТ 20 рӯз монд')).toBeVisible()
  await page.getByRole('button', { name: '5 савол аз ҳар фан' }).click()
  await page.getByRole('button', { name: 'Оғоз' }).click()

  // starts in the middle; a right answer brings the hard one, a wrong one the easy one
  await expect(page.locator('.mmt-question')).toHaveText('Логарифм: савол m2')
  expect(asked).toMatchObject({ subjects: ['math', 'tajik'], per: 5 })
  await page.locator('.mmt-option').nth(1).click()
  await expect(page.locator('.mmt-option.is-right')).toHaveCount(1)
  await page.getByRole('button', { name: 'Минбаъда' }).click()
  await expect(page.locator('.mmt-question')).toHaveText('Тригонометрия: савол m3')
  await page.locator('.mmt-option').nth(0).click()
  await expect(page.locator('.mmt-option.is-wrong')).toHaveCount(1)
  await page.screenshot({ path: 'test-results/mmt-exam.png' })
  await page.getByRole('button', { name: 'Минбаъда' }).click()
  await expect(page.locator('.mmt-question')).toHaveText('Касрҳо: савол m1')
  await page.locator('.mmt-option').nth(1).click()
  await page.getByRole('button', { name: 'Минбаъда' }).click()
  // then the next subject, from the middle again
  await expect(page.locator('.mmt-question')).toHaveText('Синтаксис: савол t2')
  for (let i = 0; i < 3; i++) {
    await page.locator('.mmt-option').nth(1).click()
    await page.getByRole('button', { name: 'Минбаъда' }).click()
  }

  // the result: 5 of 6, the mistake explained, Mahliyo one tap away
  await expect(page.locator('.mmt-score')).toContainText('5 аз 6 дуруст')
  await expect(page.locator('.mmt-review')).toHaveCount(1)
  await expect(page.locator('.mmt-review')).toContainText('Шарҳи m3')
  await page.screenshot({ path: 'test-results/mmt-result.png' })
  await page.getByRole('button', { name: 'Тайёр' }).click()

  // home: the predicted score, chances for each programme, a plan with the weakest topic first
  await expect(page.locator('.mmt-big')).toBeVisible()
  await expect(page.locator('.mmt-program')).toHaveCount(2)
  await expect(page.locator('.mmt-program').first()).toContainText('Иқтисод')
  await expect(page.locator('.mmt-chance').first()).toHaveText('Имкони баланд')
  await expect(page.locator('.mmt-day').first()).toContainText('Тригонометрия')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/mmt-home.png', fullPage: true })
  // a topic opens Mahliyo in her ММТ mode with the question written in
  await page.locator('.mmt-topic', { hasText: 'Тригонометрия' }).first().click()
  await expect(page).toHaveURL(/\/mahliyo/)
  expect(await page.evaluate(() => localStorage.getItem('dk.ai.mode'))).toBe('mmt')
  expect(errors).toEqual([])
})

test('ММТ: the plan\'s tests used up — the plans open', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.addInitScript(() => localStorage.setItem('dk.mmt.cluster', '1'))
  await page.route('**/api/v1/mmt/catalog', (r) => r.fulfill(json({ exam_date: null, subjects: [{ id: 'math', name: 'Математика', clusters: [1], max_points: 120, questions: 10 }] })))
  await page.route('**/api/v1/mmt/programs**', (r) => r.fulfill(json({ programs: [] })))
  await page.route('**/api/v1/mmt/exam', (r) => r.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ code: 'plan_limit' }) }))
  await page.goto('/mmt')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Оғоз' }).click()
  await expect(page.locator('.pw-over')).toBeVisible()
  expect(errors).toEqual([])
})

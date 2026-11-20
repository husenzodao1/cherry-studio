import { BUNDLE, expect, signedIn, test } from './fixtures'

/** A stage of two lessons, each with its own test of three questions (the first option is always right). */
const COURSE_ID = '33333333-3333-4333-8333-333333333333'
const L1 = '44444444-4444-4444-8444-444444444441'
const L2 = '44444444-4444-4444-8444-444444444442'
const rich = (text: string) => ({ spans: [{ text }] })
const card = (id: string) => ({ id, title: `Тести ${id}`, question_count: 3 })
const lesson = (id: string, n: number, next: string | null, prev: string | null) => ({
  id, title: `Дарси ${n}`, locked: false, locale: 'tg', estimated_minutes: 5,
  context: { school: { title: 'Маърифати динӣ' }, course: { id: COURSE_ID, title: 'Этапи аввал' } },
  position: { index: n, total: 2 }, prev_lesson_id: prev, next_lesson_id: next, assets: {},
  blocks: [{ id: `p${n}`, type: 'paragraph', content: rich(`Матни дарси ${n}.`) }],
  quizzes: [card(`qz${n}`)]
})
const quiz = (id: string) => ({
  locale: 'tg',
  quiz: { id, title: `Тести ${id}`, pass_score_percent: 60, show_explanations: 'after_submit', show_correct_answers: 'after_submit', question_count: 3 },
  questions: [0, 1, 2].map((i) => ({ id: `${id}-${i}`, type: 'single_choice', points: 1, prompt: `Саволи ${id} ${i}`,
    options: [{ id: `${id}-${i}-a`, text: 'Дуруст' }, { id: `${id}-${i}-b`, text: 'Нодуруст' }] })),
  settings: { shuffle_questions: false, shuffle_options: false, allow_retry: true },
  grading: Object.fromEntries([0, 1, 2].map((i) => [`${id}-${i}`, { partial_credit: false, penalty: 0, case_sensitive: false, ignore_punctuation: true, key: { correct_option_ids: [`${id}-${i}-a`] } }]))
})
const COURSE = {
  id: COURSE_ID, title: 'Этапи аввал', goals: [], locked: false, prerequisites: [], quizzes: [],
  school: { id: 's0', slug: 'marifati-dini', title: 'Маърифати динӣ' },
  modules: [{ id: 'm1', title: 'Модул', quizzes: [], topics: [{ id: 't1', title: 'Мавзӯъ', quizzes: [],
    lessons: [{ id: L1, title: 'Дарси 1', locked: false }, { id: L2, title: 'Дарси 2', locked: false }] }] }]
}
const STAGE = {
  ...BUNDLE,
  courses: { [COURSE_ID]: COURSE },
  lessons: { [L1]: lesson(L1, 1, L2, null), [L2]: lesson(L2, 2, null, L1) },
  quizzes: { qz1: quiz('qz1'), qz2: quiz('qz2') }
}

/** Answers every question of the open test with the right option, then hands it in. */
async function answerAll(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Оғоз' }).click()
  for (;;) {
    await page.getByRole('radio', { name: 'Дуруст', exact: true }).click()
    const submit = page.getByRole('button', { name: /Супоридан/ })
    if (await submit.isVisible()) { await submit.click(); return }
    await page.getByRole('button', { name: /Навбатӣ/ }).click()
  }
}

test('a stage: each lesson ends with its test, then the stage test, the certificate and the rating', async ({ page, server, errors }) => {
  await page.route('**/api/v1/bundle**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(STAGE) }))
  await signedIn(page)
  await page.goto(`/course?id=${COURSE_ID}`)
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  // no download or certificate blocks on the course any more
  await expect(page.getByText('Боргирии курс')).toHaveCount(0)
  await expect(page.locator('.cert-card')).toHaveCount(0)

  // lesson 1: "Анҷом" opens its test; handing the test in finishes the lesson
  await page.goto(`/lesson?id=${L1}`)
  await expect(page.locator('.lesson-end-hint')).toBeVisible()
  await page.locator('.lesson-end a').click()
  await expect(page).toHaveURL(/\/quiz\?id=qz1&lesson=/)
  await answerAll(page)
  await expect(page.getByText('Супорида шуд')).toBeVisible()
  await page.getByRole('link', { name: /Дарси навбатӣ/ }).click()

  // lesson 2, the last: its test leads to the stage's final test
  await expect(page).toHaveURL(new RegExp(`/lesson\\?id=${L2}`))
  await page.locator('.lesson-end a').click()
  await answerAll(page)
  await page.getByRole('link', { name: /Супоридани тести марҳила/ }).click()
  await expect(page).toHaveURL(/\/quiz\?final=/)
  // two questions from each lesson test
  await expect(page.getByText(/4 савол/)).toBeVisible()
  await answerAll(page)

  // the stage is finished: the certificate over the whole screen, Save and Share with friends
  const done = page.getByRole('dialog', { name: /Марҳила анҷом ёфт/ })
  await expect(done).toBeVisible()
  await expect(done.locator('.stage-done-cert img')).toBeVisible({ timeout: 10_000 })
  await expect(done.getByRole('button', { name: /Сабт/ })).toBeEnabled()
  await expect(done.getByRole('button', { name: /Мубодила бо дӯстон/ })).toBeEnabled()
  await page.screenshot({ path: 'test-results/stage-done.png' })
  // closing it brings the rating
  await done.getByRole('button', { name: 'Пӯшидан' }).click()
  await expect(page.locator('.sheet-scrim')).toBeVisible()
  await page.locator('.sheet-cancel').click()

  // back on the course (inside the app, the progress kept): the stage can be gone through again
  await page.getByRole('link', { name: /Ба курс/ }).click()
  await expect(page).toHaveURL(/\/course\?id=/)
  await expect(page.getByRole('link', { name: /Такрори марҳила/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Тести марҳиларо аз нав/ })).toBeVisible()
  // and a finished lesson offers its test again
  await page.locator(`a[href="/lesson?id=${L1}"]`).first().click()
  await expect(page.locator('.lesson-end a')).toHaveText(/Тести дарсро аз нав супоридан/)
  expect(server.reports).toEqual([])
  expect(errors).toEqual([])
})

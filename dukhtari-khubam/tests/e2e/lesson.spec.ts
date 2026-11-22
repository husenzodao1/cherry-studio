import { BUNDLE, expect, signedIn, test } from './fixtures'

const rich = (text: string) => ({ spans: [{ text }] })
const LESSON = {
  id: '11111111-1111-4111-8111-111111111111', title: 'Одоби сухан', locked: false, locale: 'tg', estimated_minutes: 5,
  context: { school: { title: 'Одоб ва ахлоқ' }, course: { id: '22222222-2222-4222-8222-222222222222', title: 'Одоб' } },
  position: { index: 1, total: 3 }, prev_lesson_id: null, next_lesson_id: null,
  assets: { a1: { id: 'a1', kind: 'audio', url: '/missing.mp3', mime_type: 'audio/mpeg', title: 'Шеъри Рӯдакӣ' } },
  blocks: [
    { id: 'b1', type: 'lead', content: rich('Сухани нек калиди дилҳост.') },
    { id: 'b2', type: 'paragraph', content: rich('Ҳар сухан ҷои худро дорад: онро бо андеша ва меҳрубонӣ гӯед.') },
    ...['note', 'tip', 'important', 'warning', 'info'].map((v, i) => ({ id: `c${i}`, type: 'callout', props: { variant: v }, content: { title: `Сарлавҳаи ${v}`, body: rich('Матни кӯтоҳи блок барои намуна.') } })),
    { id: 'b3', type: 'audio', props: { asset_id: 'a1' }, content: { title: 'Шеъри Рӯдакӣ', speaker: 'Нигина' } },
    { id: 'b4', type: 'practical_task', content: { title: 'Вазифа', body: rich('Се сухани нек ба модаратон гӯед.') } }
  ]
}

const COURSE = {
  id: LESSON.context.course.id, title: 'Одоб', goals: [], locked: false, prerequisites: [], quizzes: [],
  modules: [{ id: 'm1', title: 'Модул', quizzes: [], topics: [{ id: 't1', title: 'Мавзӯъ', quizzes: [], lessons: [{ id: LESSON.id, title: LESSON.title, locked: false }] }] }]
}

test('a lesson: soft white page, calm labelled blocks, no errors', async ({ page, server: _, errors }) => {
  await page.route('**/api/v1/bundle**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...BUNDLE, lessons: { [LESSON.id]: LESSON }, courses: { [COURSE.id]: COURSE } }) }))
  await signedIn(page)
  await page.goto(`/lesson?id=${LESSON.id}`)
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.backdrop-lesson')).toHaveCount(1)
  await expect(page.locator('.callout')).toHaveCount(6)
  for (const label of ['Эзоҳ', 'Маслиҳат', 'Муҳим', 'Диққат', 'Маълумот', 'Вазифаи амалӣ']) await expect(page.locator('.block-kind', { hasText: label })).toHaveCount(1)
  // no "Audio" or "Video" word over a player: only its title
  await expect(page.locator('.block-kind', { hasText: /^(Аудио|Видео)$/ })).toHaveCount(0)
  await expect(page.locator('.block-label-audio .block-title')).toHaveText('Шеъри Рӯдакӣ · Нигина')
  await page.screenshot({ path: 'test-results/lesson.png', fullPage: true })
  // her circle at the lower right asks her about this lesson: the chat opens with the question begun
  await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ready: true }) }))
  await page.getByRole('button', { name: 'Аз Маҳлиё дар бораи ин мавзӯъ пурсед' }).click()
  await expect(page).toHaveURL(/\/mahliyo\/?$/)
  await expect(page.locator('.ai-input')).toHaveValue('Дар мавзӯи «Одоби сухан» инро нафаҳмидам: ')
  expect(errors).toEqual([])
})

test('a lesson stays private: its words cannot be selected; the screenshot keys and printing say it is forbidden; away, it hides', async ({ page, server: _, errors }) => {
  await page.route('**/api/v1/bundle**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...BUNDLE, lessons: { [LESSON.id]: LESSON }, courses: { [COURSE.id]: COURSE } }) }))
  await signedIn(page)
  await page.goto(`/lesson?id=${LESSON.id}`)
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('html')).toHaveClass(/no-capture/)
  expect(await page.locator('.callout').first().evaluate((e) => getComputedStyle(e).userSelect)).toBe('none')
  for (const key of ['PrintScreen', 'Control+p']) {
    await page.keyboard.press(key)
    await expect(page.locator('.toast').filter({ hasText: 'Скриншот ва ё сабти гирфтан қатъиян манъ аст' })).toBeVisible()
  }
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  expect(await page.locator('main').evaluate((e) => getComputedStyle(e).filter)).toContain('blur')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  // elsewhere (the home page), nothing is guarded
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('html')).not.toHaveClass(/no-capture/)
  expect(errors).toEqual([])
})

test('a YouTube video that cannot play here: a note in its frame — the words open YouTube, "Аз нав" tries again', async ({ page, server: _, errors }) => {
  const yt = { ...LESSON, blocks: [{ id: 'y1', type: 'youtube', props: { video_id: 'dQw4w9WgXcQ' }, content: { title: 'Видео' } }] }
  await page.route('**/api/v1/bundle**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...BUNDLE, lessons: { [LESSON.id]: yt }, courses: { [COURSE.id]: COURSE } }) }))
  // the player never answers (as when the video may not be played elsewhere)
  await page.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }))
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  await signedIn(page)
  await page.goto(`/lesson?id=${LESSON.id}`)
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('.yt-cover').click()
  const note = page.locator('.yt-failed')
  await expect(note).toBeVisible({ timeout: 15_000 })
  await expect(note.getByRole('link')).toHaveText('Пахши мустақим дастрас нест, ба барномаи расмӣ равед')
  await expect(note.getByRole('link')).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await note.getByRole('button', { name: 'Аз нав' }).click()
  await expect(note).toHaveCount(0)
  expect(errors).toEqual([])
})

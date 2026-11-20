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
  for (const label of ['Эзоҳ', 'Маслиҳат', 'Муҳим', 'Диққат', 'Маълумот', 'Вазифаи амалӣ', 'Аудио']) await expect(page.locator('.block-kind', { hasText: label })).toHaveCount(1)
  await page.screenshot({ path: 'test-results/lesson.png', fullPage: true })
  expect(errors).toEqual([])
})

import { expect, signedIn, test } from './fixtures'

const at = new Date().toISOString()
const json = (body: unknown) => ({ contentType: 'application/json', body: JSON.stringify(body) })

test('support: a consultant joins (without her name); leaving a closed conversation asks to rate her, once', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.addInitScript(() => localStorage.setItem('dk.support', 'a'.repeat(64)))
  const rated: unknown[] = []
  let closed = false
  const thread = () => ({ id: 't1', status: closed ? 'closed' : 'open', needs_rating: closed && !rated.length, messages: [
    { id: 'm1', from_staff: false, kind: 'text', body: 'Пин-кодро фаромӯш кардам', at },
    { id: 'm2', from_staff: true, kind: 'bot', body: 'Салом! …', at },
    { id: 'm3', from_staff: true, kind: 'joined', body: 'Руслан Ҳусейнзода', at },
    { id: 'm4', from_staff: true, kind: 'text', body: 'Салом! Кӯмак мекунам.', at }] })
  await page.route('**/api/v1/support/thread', (r) => r.fulfill(json({ thread: thread() })))
  await page.route('**/api/v1/support/rate', (r) => { rated.push(r.request().postDataJSON()); return r.fulfill(json(thread())) })
  await page.goto('/support')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const joined = page.locator('.chat-joined')
  await expect(joined).toHaveText('Мушовир бо шумо пайваст шуд, ҷавобро интизор бошед.')
  await expect(joined).not.toContainText('Руслан')
  // her message on the server: sent
  await expect(page.locator('.bubble').first().locator('.msg-state.is-sent')).toBeVisible()
  await expect(page.locator('.bubble-bot img')).toHaveAttribute('src', '/assets/mascot/salom.webp')
  // the consultant closes it: leaving now asks for a rating
  closed = true
  await page.reload()
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.getByText('Муроҷиат баста шуд')).toBeVisible()
  await page.getByRole('button', { name: 'Бозгашт' }).click()
  const card = page.getByRole('dialog', { name: 'Баҳодиҳии мушовир' })
  await expect(card).toBeVisible()
  await expect(card.getByRole('button', { name: 'Фиристодан' })).toBeDisabled()
  await card.getByRole('radio', { name: '5' }).click()
  await card.locator('textarea').fill('Хеле ташаккур!')
  await page.screenshot({ path: 'test-results/support-rate.png' })
  await card.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page).toHaveURL(/\/settings\/?$/)
  expect(rated).toEqual([{ token: 'a'.repeat(64), rating: 5, note: 'Хеле ташаккур!' }])
  expect(errors).toEqual([])
})

test('a consultant sees "Саволҳои корбарон" with the questions waiting, and a banner that opens the panel on support', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.route('**/api/v1/consultant', (r) => r.fulfill(json({ consultant: true, waiting: 2 })))
  await page.goto('/settings')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const row = page.getByRole('link', { name: /Саволҳои корбарон/ })
  await expect(row).toBeVisible()
  await expect(row).toContainText('2')
  await expect(row).toHaveAttribute('href', '/admin?tab=support')
  const banner = page.locator('.support-banner')
  await expect(banner).toContainText('Саволи нав аз корбар · 2')
  // the panel asks for the 6-digit code sent to her own e-mail
  await row.click()
  await expect(page.getByPlaceholder('Почта')).toHaveValue('m@gmail.com')
  await expect(page.getByRole('button', { name: 'Фиристодани код' })).toBeVisible()
  expect(errors).toEqual([])
})

test('a learner who is not a consultant sees no such row', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.goto('/settings')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.getByRole('link', { name: 'Дастгирӣ' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Саволҳои корбарон/ })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('progress map: a begun course is a road; finished lessons green, yellow or red by their tests, the next one pulses', async ({ page, server: _, errors }) => {
  const { BUNDLE, PROGRESS } = await import('./fixtures')
  const ids = ['l1', 'l2', 'l3', 'l4']
  const lesson = (id: string, n: number) => ({ id, title: `Дарси ${n}`, locked: false, locale: 'tg', blocks: [], assets: {}, position: { index: n, total: 4 },
    quizzes: n < 4 ? [{ id: `q${n}` }] : [], context: { school: { title: 'Мактаб 1' }, course: { id: 'c1', title: 'Курси аввал' } } })
  const bundle = {
    ...BUNDLE,
    schoolDetails: { [BUNDLE.schools[0].slug]: { slug: BUNDLE.schools[0].slug, title: 'Мактаб 1', courses: [{ id: 'c1', title: 'Курси аввал' }], quizzes: [] } },
    courses: { c1: { id: 'c1', title: 'Курси аввал', goals: [], locked: false, prerequisites: [], quizzes: [], school: { slug: BUNDLE.schools[0].slug },
      modules: [{ id: 'm', title: 'Модул', quizzes: [], topics: [{ id: 't', title: 'Мавзӯъ', quizzes: [], lessons: ids.map((id) => ({ id, title: id, locked: false })) }] }] } },
    lessons: Object.fromEntries(ids.map((id, i) => [id, lesson(id, i + 1)])),
    quizzes: Object.fromEntries([1, 2, 3].map((n) => [`q${n}`, { quiz: { id: `q${n}`, title: `Тест ${n}` }, questions: [], grading: {} }]))
  }
  await page.route('**/api/v1/bundle**', (r) => r.fulfill(json(bundle)))
  const done = (best: number) => ({ best, passed: best >= 50, tries: 1, at })
  await signedIn(page)
  await page.addInitScript((p) => localStorage.setItem('dk.progress', JSON.stringify(p)), {
    ...PROGRESS,
    lessons: { l1: { p: 100, done: at, at }, l2: { p: 100, done: at, at }, l3: { p: 100, done: at, at }, l4: { p: 20, at } },
    quizzes: { q1: done(95), q2: done(60), q3: done(30) }
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/garden')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Харитаи пешравӣ' })).toBeVisible()
  await expect(page.locator('.map-leg')).toHaveCount(1)
  await expect(page.locator('.map-head')).toContainText('Курси аввал')
  await expect(page.locator('.map-head')).toContainText('3/4')
  for (const [cls, text] of [['is-good', '95%'], ['is-fair', '60%'], ['is-weak', '30%']]) await expect(page.locator(`.map-stop.${cls} .map-dot`)).toHaveText(text)
  await expect(page.locator('.map-key.is-good')).toContainText('Олӣ · 1')
  await expect(page.locator('.map-key.is-weak')).toContainText('Бад · 1')
  // the road winds: the stops do not stand in one column, and the walked part is drawn in three colours
  const xs = await page.locator('.map-stop').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)))
  expect(new Set(xs).size).toBeGreaterThan(2)
  await expect(page.locator('.map-walked')).toHaveCount(3)
  await page.screenshot({ path: 'test-results/progress-map.png', fullPage: true })
  await page.locator('.map-stop.is-next').click()
  await expect(page).toHaveURL(/\/lesson\?id=l4$/)
  expect(errors).toEqual([])
})

test('support: each message says where it is — on its way, waiting for the internet (sent by itself), sent, or not sent (tap: again)', async ({ page, context, server: _, errors }) => {
  await signedIn(page)
  await page.addInitScript(() => localStorage.setItem('dk.support', 'b'.repeat(64)))
  const got: string[] = []
  let refuse = false
  const thread = () => ({ id: 't2', status: 'open', needs_rating: false, messages: got.map((body, i) => ({ id: `m${i}`, from_staff: false, kind: 'text', body, at })) })
  await page.route('**/api/v1/support/thread', (r) => r.fulfill(json({ thread: got.length ? thread() : null })))
  await page.route('**/api/v1/support/send', (r) => {
    if (refuse) return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    got.push((r.request().postDataJSON() as { body: string }).body)
    return r.fulfill(json(thread()))
  })
  await page.goto('/support')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const box = page.getByPlaceholder('Паём…')
  const send = page.getByRole('button', { name: 'Фиристодан' })
  // without the internet: the button still works, the message waits and goes by itself
  await context.setOffline(true)
  await box.fill('Салом, ёрӣ лозим')
  await send.click()
  await expect(page.locator('.bubble-out.is-waiting')).toContainText('Салом, ёрӣ лозим')
  await expect(page.locator('.bubble-out .msg-state')).toContainText('Интернет пайдо шавад, худаш фиристода мешавад')
  await context.setOffline(false)
  await expect.poll(() => got).toEqual(['Салом, ёрӣ лозим'])
  await expect(page.locator('.bubble-out')).toHaveCount(0)
  await expect(page.locator('.bubble .msg-state.is-sent').last()).toContainText('Фиристода шуд')
  // the server says no: not sent; tapped, it goes again
  refuse = true
  await box.fill('Паёми дуюм')
  await send.click()
  const failed = page.locator('.bubble-out.is-failed')
  await expect(failed).toContainText('Фиристода нашуд')
  refuse = false
  await failed.getByRole('button').click()
  await expect.poll(() => got).toEqual(['Салом, ёрӣ лозим', 'Паёми дуюм'])
  await expect(page.locator('.bubble-out')).toHaveCount(0)
  expect(errors).toEqual([])
})

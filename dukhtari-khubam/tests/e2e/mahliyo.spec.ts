import type { Page } from '@playwright/test'

import { expect, signedIn, test } from './fixtures'

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
type Asked = { turns: { role: string; content: string }[]; name?: string; me?: string; now?: string; tz?: string; background?: boolean; files?: { mime: string; name: string; data: string }[] }
type Answer = { tajik: boolean; reply: string; blocks: unknown[] }

const PIN: Answer = {
  tajik: true, reply: 'Пин-кодро дар «Танзимот» иваз мекунед.\n\nЧӣ тавр\n1. «Профил»-ро кушоед\n2. «Танзимот»-ро пахш кунед',
  blocks: [
    { type: 'text', text: 'Пин-кодро дар «Танзимот» иваз мекунед.' },
    { type: 'steps', title: 'Чӣ тавр', items: ['«Профил»-ро кушоед', '«Танзимот»-ро пахш кунед', '«Қулфи барнома»-ро ёбед'] },
    { type: 'screen', spot: 'settings.pin', caption: '«Қулфи барнома»-ро пахш кунед' },
    { type: 'link', to: '/settings', label: 'Ба танзимот' }
  ]
}

/**
 * A fake Mahliyo in the background: a question gets an id at once; her answer (`reply(question)`) is
 * ready `after` ms later, or never (null: she cannot answer). Stopped questions are recorded.
 */
async function fakeMahliyo(page: Page, reply: (q: string) => Answer | null, after = 600, slowNet = 0) {
  const asked: Asked[] = []
  const stopped: string[] = []
  const ready = new Map<string, { at: number; a: Answer | null }>()
  await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill(json({ ready: true })))
  await page.route('**/api/v1/mahliyo/ask', async (r) => {
    // a slow connection: the question takes a while to arrive
    if (slowNet) await new Promise((f) => setTimeout(f, slowNet))
    const body = r.request().postDataJSON() as Asked
    asked.push(body)
    const id = `00000000-0000-4000-8000-${String(asked.length).padStart(12, '0')}`
    ready.set(id, { at: Date.now() + after, a: reply(body.turns[body.turns.length - 1].content) })
    return r.fulfill(json({ id }))
  })
  await page.route('**/api/v1/mahliyo/answer', (r) => {
    const { id } = r.request().postDataJSON() as { id: string }
    const q = ready.get(id)
    if (!q) return r.fulfill(json({ error: { code: 'not_found' } }, 404))
    if (stopped.includes(id)) return r.fulfill(json({ status: 'failed', reason: 'stopped' }))
    if (Date.now() < q.at) return r.fulfill(json({ status: 'pending' }))
    return r.fulfill(json(q.a ? { status: 'done', ...q.a } : { status: 'failed', reason: 'busy' }))
  })
  await page.route('**/api/v1/mahliyo/stop', (r) => {
    stopped.push((r.request().postDataJSON() as { id: string }).id)
    return r.fulfill(json({ ok: true }))
  })
  return { asked, stopped }
}

test('Mahliyo AI: her persona rises from the tab bar; her scene greets; she answers in blocks drawn word by word', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const { asked } = await fakeMahliyo(page, (q) => (q.startsWith('Соати')
    ? { tajik: true, reply: 'Хуб!', blocks: [{ type: 'text', text: 'Хуб, ёдатон медиҳам!' }, { type: 'reminder', at: new Date(Date.now() + 3 * 3600_000).toISOString(), title: 'Вақти дарс', text: 'Малика, дарс интизор аст!' }] }
    : q.startsWith('Как') ? { tajik: true, reply: 'Язык…', blocks: [{ type: 'text', text: 'Язык меняется в «Танзимот» → «Забон».' }] }
    : PIN))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  // her persona in the middle of the tab bar: on a dome above it, her head out of her circle
  const tab = page.locator('.dock-wrap').getByRole('link', { name: 'Маҳлиё AI' })
  await expect(tab.locator('img')).toHaveAttribute('src', '/assets/mascot/persona.webp')
  const bar = (await page.locator('.dock').boundingBox())!
  const her = (await tab.boundingBox())!
  expect(her.y).toBeLessThan(bar.y - 20)
  expect(her.y + her.height).toBeGreaterThan(bar.y)
  await tab.click()
  await expect(page).toHaveURL(/\/mahliyo\/?$/)
  await expect(tab).toHaveAttribute('aria-current', 'page')
  // a plain header: her name, and only the menu (the history of chats); her lines come one after another
  await expect(page.locator('.ai-top button')).toHaveCount(1)
  await expect(page.locator('.ai-top button')).toHaveAccessibleName('Таърихи чатҳо')
  // the menu sits at the far right; no line under her greeting
  const menuBox = (await page.locator('.ai-menu').boundingBox())!
  expect(menuBox.x + menuBox.width).toBeGreaterThan(390 - 24)
  await expect(page.locator('.ai-hello')).toHaveCount(0)
  await expect(page.locator('.ai-greet')).toHaveText('Салом, Малика! Чӣ меомӯзем?')
  await expect(page.locator('.ai-greet')).toHaveText('Кофе бо Маҳлиё AI? ☕', { timeout: 6000 })
  await expect(page.getByPlaceholder('Паём ба Mahliyo AI…')).toBeVisible()
  // the short questions glide past in two rows
  await expect(page.locator('.ai-row')).toHaveCount(2)
  const x0 = (await page.locator('.ai-row').first().locator('.ai-chip').first().boundingBox())!.x
  await page.waitForTimeout(800)
  expect((await page.locator('.ai-row').first().locator('.ai-chip').first().boundingBox())!.x).not.toBe(x0)

  // a chip asks at once; she thinks (the send button stops her), then her blocks come, words one by one
  // a touch (here the pointer) holds the gliding rows still, so a chip can be tapped
  await page.locator('.ai-marquee').hover()
  const held = (await page.locator('.ai-row').first().locator('.ai-chip').first().boundingBox())!.x
  await page.waitForTimeout(400)
  expect((await page.locator('.ai-row').first().locator('.ai-chip').first().boundingBox())!.x).toBe(held)
  await page.locator('.ai-chip', { hasText: 'PIN-ро чӣ тавр иваз кунам?' }).first().click()
  await expect(page.locator('.ai-thinking')).toContainText('Маҳлиё фикр мекунад')
  await expect(page.getByRole('button', { name: 'Қатъ кардан' })).toBeVisible()
  await expect(page.locator('.ai-blocks.is-fresh .ai-w').first()).toBeVisible()
  await expect(page.locator('.ai-text').first()).toHaveText('Пин-кодро дар «Танзимот» иваз мекунед.')
  await expect(page.locator('.ai-steps li')).toHaveCount(3)
  await expect(page.locator('.ai-screen img')).toHaveAttribute('src', '/assets/ai-screens/settings.pin.webp')
  await expect(page.getByRole('link', { name: 'Ба танзимот' })).toHaveAttribute('href', '/settings')
  expect(asked[0]).toMatchObject({ name: 'Малика', background: true, turns: [{ role: 'user', content: 'PIN-ро чӣ тавр иваз кунам?' }] })
  expect(asked[0].me).toContain('Name: Малика')
  expect(asked[0].now).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/)
  // once drawn, it stays drawn
  await expect(page.locator('.ai-blocks.is-fresh')).toHaveCount(0, { timeout: 8000 })
  await page.screenshot({ path: 'test-results/mahliyo-ai.png' })

  // a reminder: on the website it cannot ring, and says so
  await page.getByPlaceholder('Паём ба Mahliyo AI…').fill('Соати 20:00 ёдам деҳ')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-reminder-state')).toHaveText('Ёдраскунӣ танҳо дар барномаи телефон занг мезанад.')
  expect(asked[1].turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user'])
  expect(asked[1].turns[1].content).toContain('1. «Профил»-ро кушоед')

  // another language: she answers in it
  await page.getByPlaceholder('Паём ба Mahliyo AI…').fill('Как поменять язык?')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-said').last()).toContainText('Язык меняется')
  await expect(page.locator('.ai-said').last().getByRole('link', { name: 'Ба мушовир нависед' })).toHaveCount(0)

  // the conversation stays on the phone; a new one starts clean (from the menu)
  await page.reload()
  await expect(page.locator('.ai-said')).toHaveCount(3)
  await page.getByRole('button', { name: 'Таърихи чатҳо' }).click()
  await page.getByRole('button', { name: 'Сӯҳбати нав' }).click()
  await expect(page.locator('.ai-said')).toHaveCount(0)
  await expect(page.locator('.ai-marquee')).toBeVisible()
  expect(errors).toEqual([])
})

test('her scene is dark, her words without boxes; the menu keeps the history of chats: open, new, remove — kept after reopening', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await fakeMahliyo(page, (q) => ({ tajik: true, reply: `Ҷавоб ба «${q}»`, blocks: [{ type: 'text', text: `Ҷавоб ба «${q}»` }] }), 300)
  await page.goto('/mahliyo')
  // dark, whatever the theme; the tab bar too; her answer is plain text on it
  await expect(page.locator('html')).toHaveClass(/ai-dark/)
  expect(await page.locator('.ai-bg').evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('ai-doodles.svg')
  const box = page.getByPlaceholder('Паём ба Mahliyo AI…')
  await box.fill('Саволи якум')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-text')).toHaveText('Ҷавоб ба «Саволи якум»', { timeout: 10_000 })
  expect(await page.locator('.ai-text').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  // a new chat from the menu; the first stays in the history
  const menu = page.getByRole('button', { name: 'Таърихи чатҳо' })
  await menu.click()
  await page.getByRole('button', { name: 'Сӯҳбати нав' }).click()
  await expect(page.locator('.ai-said')).toHaveCount(0)
  await box.fill('Саволи дуюм')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-text')).toHaveText('Ҷавоб ба «Саволи дуюм»', { timeout: 10_000 })
  await menu.click()
  const rows = page.locator('.ai-history-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('Саволи дуюм')
  await expect(rows.first()).toHaveClass(/is-open/)
  await expect(page.locator('.ai-history-day').first()).toHaveText('Имрӯз')
  // the drawer is over the tab bar
  expect(await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight - 40)?.closest('.ai-history') !== null)).toBe(true)
  await rows.nth(1).getByRole('button', { name: 'Саволи якум', exact: true }).click()
  await expect(page.locator('.ai-history')).toHaveCount(0)
  await expect(page.locator('.ai-text')).toHaveText('Ҷавоб ба «Саволи якум»')
  // kept after the app is opened again, with the chat that was open
  await page.reload()
  await expect(page.locator('.ai-text')).toHaveText('Ҷавоб ба «Саволи якум»')
  await menu.click()
  await expect(rows).toHaveCount(2)
  // plain lines, no boxes
  expect(await page.locator('.ai-history-new').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  // "⋯" → to the archive: out of the list, in the folded archive at the bottom; and back
  await rows.filter({ hasText: 'Саволи дуюм' }).getByRole('button', { name: /^Амалҳо/ }).click()
  await page.getByRole('menuitem', { name: 'Ба архив партофтан' }).click()
  await expect(page.locator('.ai-history-list').first().locator('.ai-history-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Архив · 1' }).click()
  await expect(page.locator('.ai-history-archive .ai-history-row')).toContainText('Саволи дуюм')
  await page.locator('.ai-history-archive').getByRole('button', { name: /^Амалҳо/ }).click()
  await page.getByRole('menuitem', { name: 'Аз архив баровардан' }).click()
  await expect(page.locator('.ai-history-archive')).toHaveCount(0)
  await expect(rows).toHaveCount(2)
  // "⋯" → deleted for good
  await rows.filter({ hasText: 'Саволи дуюм' }).getByRole('button', { name: /^Амалҳо/ }).click()
  await page.getByRole('menuitem', { name: 'Пурра нест кардан' }).click()
  await expect(rows).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('.ai-history')).toHaveCount(0)
  // leaving her scene: the page is light again
  await page.locator('.dock').getByRole('link', { name: /асосӣ/i }).click()
  await expect(page.locator('html')).not.toHaveClass(/ai-dark/)
  expect(errors).toEqual([])
})

test('in the background: she goes on answering while the learner is elsewhere (the tab glows, then shows a dot), even after the app is opened again', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await fakeMahliyo(page, () => PIN, 2500)
  await page.goto('/mahliyo')
  await page.getByPlaceholder('Паём ба Mahliyo AI…').fill('PIN-ро чӣ тавр иваз кунам?')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-thinking')).toBeVisible()
  // away to the schools: she keeps thinking
  await page.locator('.dock').getByRole('link', { name: /мактаб/i }).click()
  await expect(page.locator('.dock-ai.is-thinking')).toBeVisible()
  await expect(page.locator('.dock-ai-news')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.dock-ai.is-thinking')).toHaveCount(0)
  // and a note above the bar says she answered; a tap opens her chat
  await expect(page.locator('.ai-notice')).toHaveText('Ҷавоби шумо аз Маҳлиё омад')
  await page.locator('.dock-wrap').getByRole('link', { name: 'Маҳлиё AI' }).click()
  await expect(page.locator('.ai-text').first()).toHaveText('Пин-кодро дар «Танзимот» иваз мекунед.')
  await expect(page.locator('.dock-ai-news')).toHaveCount(0)

  // asked, then the app closed and opened again: her answer is fetched by the question's id
  await page.getByPlaceholder('Паём ба Mahliyo AI…').fill('Боз як савол')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-thinking')).toBeVisible()
  await page.waitForTimeout(500)
  await page.reload()
  await expect(page.locator('.ai-thinking')).toBeVisible()
  await expect(page.locator('.ai-said')).toHaveCount(2, { timeout: 10_000 })
  expect(errors).toEqual([])
})

test('stop, edit, copy; she cannot answer: a card with "try again"; no internet: the chat says so', async ({ page, context, server: _, errors }) => {
  await signedIn(page)
  let fail = true
  const { asked, stopped } = await fakeMahliyo(page, (q) => (q === 'Савол' && fail ? null : PIN), 1500)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/mahliyo')
  const box = page.getByPlaceholder('Паём ба Mahliyo AI…')

  // stopped while she thinks: the question stays, with "try again" and "edit"
  await box.fill('Пин-кодро чӣ тавр иваз кунам')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Қатъ кардан' }).click()
  await expect(page.locator('.ai-problem')).toContainText('Шумо саволро қатъ кардед.')
  await expect.poll(() => stopped.length).toBe(1)
  // edited: the question comes back into the box; sent, it replaces the old one
  await page.locator('.ai-problem').getByRole('button', { name: 'Таҳрир' }).click()
  await expect(box).toHaveValue('Пин-кодро чӣ тавр иваз кунам')
  await expect(page.locator('.ai-editing')).toContainText('Таҳрири савол')
  await box.fill('PIN-ро чӣ тавр иваз кунам?')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-said')).toHaveCount(1, { timeout: 10_000 })
  await expect(page.locator('.ai-asked')).toHaveCount(1)
  await expect(page.locator('.ai-asked .bubble')).toHaveText('PIN-ро чӣ тавр иваз кунам?')
  expect(asked[1].turns).toEqual([{ role: 'user', content: 'PIN-ро чӣ тавр иваз кунам?' }])

  // copy her answer: her words and steps, no picture markers
  await page.locator('.ai-said').getByRole('button', { name: 'Нусха' }).click()
  await expect(page.locator('.toast, [role="status"]').filter({ hasText: 'Нусха гирифта шуд' }).first()).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('1. «Профил»-ро кушоед')
  expect(copied).not.toContain('[')

  // she cannot answer: a card that says so, and "try again" asks once more
  await box.fill('Савол')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-problem')).toContainText('Бубахшед, ҳозир ҷавоб дода натавонистам.', { timeout: 10_000 })
  fail = false
  await page.locator('.ai-problem').getByRole('button', { name: 'Боз кӯшиш кунед' }).click()
  await expect(page.locator('.ai-said')).toHaveCount(2, { timeout: 10_000 })
  await expect(page.locator('.ai-asked')).toHaveCount(2)

  // no internet: a line says so, sending waits for the connection
  await context.setOffline(true)
  await expect(page.locator('.ai-offline')).toContainText('Интернет нест')
  await expect(page.getByRole('button', { name: 'Фиристодан' })).toBeDisabled()
  await context.setOffline(false)
  await expect(page.locator('.ai-offline')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('without the AI set up on the server, her scene says she is coming soon and points to the consultant', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.goto('/mahliyo')
  await expect(page.locator('.ai-hello')).toContainText('ба наздикӣ омода мешавад')
  await expect(page.locator('.ai-hero').getByRole('link', { name: 'Ба мушовир нависед' })).toHaveAttribute('href', '/support')
  await expect(page.getByPlaceholder('Паём ба Mahliyo AI…')).toBeDisabled()
  await expect(page.locator('.ai-marquee')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a slow connection: "sending…" until the question arrived, then she thinks; pictures and files go with a question', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const { asked } = await fakeMahliyo(page, () => ({ tajik: true, reply: 'Дар расм…', blocks: [{ type: 'text', text: 'Дар расм тугмаи «Танзимот» аст.' }] }), 800, 1500)
  await page.goto('/mahliyo')
  const box = page.getByPlaceholder('Паём ба Mahliyo AI…')
  await box.fill('Салом!')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  // on its way: no thinking yet
  await expect(page.locator('.ai-delivery')).toHaveText('Фиристода мешавад…')
  await expect(page.locator('.ai-status')).toHaveText('Фиристода мешавад…')
  await expect(page.locator('.ai-thinking')).toHaveCount(0)
  // arrived: she thinks
  await expect(page.locator('.ai-delivery')).toHaveText('Фиристода шуд')
  await expect(page.locator('.ai-thinking')).toBeVisible()
  await expect(page.locator('.ai-said')).toHaveCount(1, { timeout: 10_000 })
  await expect(page.locator('.ai-delivery')).toHaveCount(0)

  // a picture (made smaller, as JPEG) and a text file, without words: she is asked to look at them
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDGgAcYDBQBWHgIBf7RS3wAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'screen.png', mimeType: 'image/png', buffer: png },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Ёддошти ман') }
  ])
  await expect(page.locator('.ai-files .ai-file')).toHaveCount(2)
  await expect(page.locator('.ai-files img')).toHaveCount(1)
  // one can be taken out again, and put back
  await page.locator('.ai-file').nth(1).getByRole('button', { name: 'Нест кардан' }).click()
  await expect(page.locator('.ai-files .ai-file')).toHaveCount(1)
  await page.locator('input[type="file"]').setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Ёддошти ман') }])
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-asked').last().locator('.ai-attached img')).toBeVisible()
  await expect(page.locator('.ai-asked').last().locator('.ai-attached .ai-file-doc')).toHaveText('notes.txt')
  await expect(page.locator('.ai-said')).toHaveCount(2, { timeout: 10_000 })
  const sent = asked[1]
  expect(sent.turns[sent.turns.length - 1].content).toBe('Ба ин нигаред, лутфан.')
  expect(sent.files?.map((f) => [f.mime, f.name])).toEqual([['image/jpeg', 'screen.png'], ['text/plain', 'notes.txt']])
  expect(Buffer.from(sent.files![1].data, 'base64').toString('utf8')).toBe('Ёддошти ман')
  // a type she cannot read
  await page.locator('input[type="file"]').setInputFiles([{ name: 'a.zip', mimeType: 'application/zip', buffer: Buffer.from('PK') }])
  await expect(page.locator('.toast').filter({ hasText: 'Ин навъи файл дастгирӣ намешавад' })).toBeVisible()
  await expect(page.locator('.ai-files')).toHaveCount(0)
  // her link blocks are not like the learner's bubbles
  expect(errors).toEqual([])
})

test('Mahliyo calls at a reminder\'s time: it rings; declined, it ends; answered, she speaks (her words on the screen) until it is ended', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const plan = (id: number, title: string) => page.evaluate(([id, title]) => {
    const list = JSON.parse(localStorage.getItem('dk.ai-calls') || '[]')
    list.push({ id, at: new Date(Date.now() - 2000).toISOString(), title, text: 'Малика, дарс интизор аст!' })
    localStorage.setItem('dk.ai-calls', JSON.stringify(list))
  }, [id, title] as const)
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await plan(1, 'Вақти дарс')
  // the app comes back to the screen: the reminder is due, she calls
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  const call = page.getByRole('dialog', { name: /Занги Маҳлиё AI/ })
  await expect(call).toBeVisible()
  await expect(call.locator('.call-name')).toHaveText('Маҳлиё')
  await expect(call.locator('.call-status')).toContainText('занг мезанад')
  await expect(call.locator('.call-about')).toHaveText('Вақти дарс')
  await page.screenshot({ path: 'test-results/mahliyo-call.png' })
  // declined: the line's tones, and it closes
  await call.getByRole('button', { name: 'Рад кардан' }).click()
  await expect(call.locator('.call-status')).toHaveText('Занг анҷом ёфт')
  await expect(call).toHaveCount(0, { timeout: 5000 })
  // it rang once: it does not ring again
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(500)
  await expect(call).toHaveCount(0)

  // another: answered, she speaks; her words come on the screen; the time runs
  await plan(2, 'Такрори рӯз')
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(call).toBeVisible()
  await call.getByRole('button', { name: 'Бардоштан' }).click()
  await expect(call.locator('.call-wave')).toBeVisible()
  await expect(call.locator('.call-line')).toHaveText(/Ау!|Салом, дӯстам!/, { timeout: 8000 })
  await expect(call.locator('.call-status')).toHaveText(/^00:0[1-9]$/, { timeout: 5000 })
  await call.getByRole('button', { name: 'Анҷом' }).click()
  await expect(call).toHaveCount(0, { timeout: 5000 })
  expect(errors).toEqual([])
})

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
  // opened from her circle: the chat pours out of it, like a window from the dock
  await expect(page.locator('.ai-scene.is-genie')).toHaveCount(1)
  await expect(page.locator('.ai-scene.is-genie')).toHaveCount(0, { timeout: 3000 })
  // full screen: no tab bar; a plain header — her name, "Дугонаи донои шумо", a new chat, the menu (☰) and, at the far right, leaving (✕)
  await expect(page.locator('.dock')).toHaveCount(0)
  await expect(page.locator('.ai-status')).toHaveText('Дугонаи донои шумо')
  await expect(page.locator('.ai-top button')).toHaveCount(3)
  await expect(page.locator('.ai-top button').first()).toHaveAccessibleName('Сӯҳбати нав')
  await expect(page.locator('.ai-top button').nth(1)).toHaveAccessibleName('Таърихи чатҳо')
  const leaveBox = (await page.getByRole('button', { name: 'Баромадан' }).boundingBox())!
  expect(leaveBox.x + leaveBox.width).toBeGreaterThan(390 - 24)
  await expect(page.locator('.ai-hello')).toHaveCount(0)
  // one greeting of many, the same while the chat is open
  const greet = page.locator('.ai-greet-line')
  await expect(greet).toHaveText(/\p{L}/u)
  const said = await greet.textContent()
  expect(said).not.toContain('{name}')
  await page.waitForTimeout(4200)
  await expect(greet).toHaveText(said!)
  // the box to write in is one line, its hint never wraps
  await expect(page.getByPlaceholder('Паём ба Mahliyo AI…')).toBeVisible()
  expect((await page.getByPlaceholder('Паём ба Mahliyo AI…').boundingBox())!.height).toBeLessThan(50)
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
  // "she is thinking" is in view above the box to write in, not under it
  await page.waitForTimeout(500)
  expect((await page.locator('.ai-thinking').boundingBox())!.y + 30).toBeLessThan((await page.locator('.ai-composer').boundingBox())!.y)
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
  // the call card: its name, its time and taking it back — not the words of the notification
  await expect(page.locator('.ai-reminder')).not.toContainText('дарс интизор аст')
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
  await page.locator('.ai-history').getByRole('button', { name: 'Сӯҳбати нав' }).click()
  await expect(page.locator('.ai-said')).toHaveCount(0)
  await expect(page.locator('.ai-marquee')).toBeVisible()
  expect(errors).toEqual([])
})

test('her full screen: a soft plain colour, words without boxes; only the chat moves; the history like a phone\'s side menu: open, new, archive, delete; ✕ and back leave', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await fakeMahliyo(page, (q) => ({ tajik: true, reply: `Ҷавоб ба «${q}»`, blocks: [{ type: 'text', text: `Ҷавоб ба «${q}»` }] }), 300)
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('.dock-wrap').getByRole('link', { name: 'Маҳлиё AI' }).click()
  await expect(page).toHaveURL(/\/mahliyo\/?$/)
  // a soft plain colour (no gradient, no picture); her answer is plain text on it
  const scene = page.locator('.ai-scene')
  expect(await scene.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe('none')
  const box = page.getByPlaceholder('Паём ба Mahliyo AI…')
  await box.fill('Саволи якум')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-text')).toHaveText('Ҷавоб ба «Саволи якум»', { timeout: 10_000 })
  expect(await page.locator('.ai-text').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  // only the conversation scrolls: the page itself does not
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden')
  expect(await page.locator('.ai-scroll').evaluate((e) => getComputedStyle(e).overflowY)).toBe('auto')
  // beside "copy": select the words, share them
  await page.locator('.ai-said').getByRole('button', { name: 'Интихоби матн' }).click()
  await expect(page.locator('.ai-select-text')).toHaveValue('Ҷавоб ба «Саволи якум»')
  await page.locator('.ai-select').getByRole('button', { name: 'Пӯшидан' }).click()
  await expect(page.locator('.ai-select')).toHaveCount(0)
  await expect(page.locator('.ai-said').getByRole('button', { name: 'Мубодила' })).toBeVisible()
  // a new chat from the menu; the first stays in the history
  const menu = page.getByRole('button', { name: 'Таърихи чатҳо' })
  await menu.click()
  await page.locator('.ai-history').getByRole('button', { name: 'Сӯҳбати нав' }).click()
  await expect(page.locator('.ai-said')).toHaveCount(0)
  await box.fill('Саволи дуюм')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-text')).toHaveText('Ҷавоб ба «Саволи дуюм»', { timeout: 10_000 })
  await menu.click()
  const rows = page.locator('.ai-history-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('Саволи дуюм')
  await expect(rows.first()).toHaveClass(/is-open/)
  await expect(rows.first().locator('.ai-history-when')).toHaveText('Имрӯз')
  // over the whole screen
  expect(await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight - 40)?.closest('.ai-history') !== null)).toBe(true)
  // search
  await page.getByRole('searchbox', { name: 'Ҷустуҷӯ' }).fill('якум')
  await expect(rows).toHaveCount(1)
  await page.getByRole('searchbox', { name: 'Ҷустуҷӯ' }).fill('')
  await rows.nth(1).getByRole('button', { name: 'Саволи якум', exact: true }).click()
  await expect(page.locator('.ai-history')).toHaveCount(0)
  await expect(page.locator('.ai-text')).toHaveText('Ҷавоб ба «Саволи якум»')
  // kept after the app is opened again, with the chat that was open
  await page.reload()
  await expect(page.locator('.ai-text')).toHaveText('Ҷавоб ба «Саволи якум»')
  await menu.click()
  await expect(rows).toHaveCount(2)
  // "⋮" → to the archive: out of the list; the archive (at the bottom) shows it; and back
  await rows.filter({ hasText: 'Саволи дуюм' }).getByRole('button', { name: /^Амалҳо/ }).click()
  await page.getByRole('menuitem', { name: 'Ба архив партофтан' }).click()
  await expect(rows).toHaveCount(1)
  await page.locator('.ai-history-foot').getByRole('button', { name: 'Архив' }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Саволи дуюм')
  await rows.first().getByRole('button', { name: /^Амалҳо/ }).click()
  await page.getByRole('menuitem', { name: 'Аз архив баровардан' }).click()
  await expect(rows).toHaveCount(0)
  await page.locator('.ai-history-foot').getByRole('button', { name: 'Архив' }).click()
  await expect(rows).toHaveCount(2)
  // "⋮" → deleted for good
  await rows.filter({ hasText: 'Саволи дуюм' }).getByRole('button', { name: /^Амалҳо/ }).click()
  await page.getByRole('menuitem', { name: 'Пурра нест кардан' }).click()
  await expect(rows).toHaveCount(1)
  // back closes the history first
  await page.goBack()
  await expect(page.locator('.ai-history')).toHaveCount(0)
  // back: first it says how to leave; a second press leaves (back where she came from)
  await page.goBack()
  await expect(page.locator('.toast').filter({ hasText: 'Барои баромадан аз реҷаи экрани пурра амалро такрор кунед' })).toBeVisible()
  await expect(page).toHaveURL(/\/mahliyo\/?$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.dock')).toBeVisible()
  // ✕ leaves at once
  await page.locator('.dock-wrap').getByRole('link', { name: 'Маҳлиё AI' }).click()
  await page.getByRole('button', { name: 'Баромадан' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(errors).toEqual([])
})

test('in the background: she goes on answering while the learner is elsewhere (the tab glows, then shows a dot), even after the app is opened again', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await fakeMahliyo(page, () => PIN, 2500)
  await page.goto('/mahliyo')
  await page.getByPlaceholder('Паём ба Mahliyo AI…').fill('PIN-ро чӣ тавр иваз кунам?')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-thinking')).toBeVisible()
  // away (✕): she keeps thinking
  await page.getByRole('button', { name: 'Баромадан' }).click()
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

test('Mahliyo calls at a reminder\'s time: it rings; declined, it ends; answered, after 3 seconds she speaks, then her menu: 0 her chat, 1 the lesson, 3 ends', async ({ page, server: _, errors }) => {
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

  // another: answered, the line is silent three seconds, then she speaks; the time runs; mute, keypad, speaker
  await plan(2, 'Такрори рӯз')
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(call).toBeVisible()
  await call.getByRole('button', { name: 'Бардоштан' }).click()
  for (const name of ['Хомӯш', 'Рақамҳо', 'Динамик']) await expect(call.getByRole('button', { name })).toBeVisible()
  await page.waitForTimeout(2000)
  await expect(call.locator('.call-line')).toHaveCount(0)
  await expect(call.locator('.call-line')).toHaveText(/Ау!|Салом, дӯстам!/, { timeout: 5000 })
  await expect(call.locator('.call-status')).toHaveText(/^00:0[3-9]$/)
  const speaker = call.getByRole('button', { name: 'Динамик' })
  await speaker.click()
  await expect(speaker).toHaveAttribute('aria-pressed', 'true')
  await call.getByRole('button', { name: 'Хомӯш' }).click()
  await expect(call.getByRole('button', { name: 'Хомӯш' })).toHaveAttribute('aria-pressed', 'true')
  // after her words, her menu (no goodbye): 1 — the lesson, 0 — her chat, 3 — the call ends
  await expect(call.locator('.call-line')).toHaveText(/Барои ба дарс баргаштан 1-ро пахш кунед/, { timeout: 20_000 })
  await call.getByRole('button', { name: 'Рақамҳо' }).click()
  await expect(call.locator('.call-key')).toHaveCount(12)
  await page.screenshot({ path: 'test-results/mahliyo-call-keypad.png' })
  await call.getByRole('button', { name: '0', exact: true }).click()
  await expect(call).toHaveCount(0, { timeout: 5000 })
  await expect(page).toHaveURL(/\/mahliyo/)
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  // "1": back to learning (the lesson left unfinished, the next one, or the schools)
  await plan(3, 'Дарс')
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await call.getByRole('button', { name: 'Бардоштан' }).click()
  await call.getByRole('button', { name: 'Рақамҳо' }).click()
  await call.getByRole('button', { name: '1', exact: true }).click()
  await expect(call).toHaveCount(0, { timeout: 5000 })
  await expect(page).toHaveURL(/\/(lesson|schools)/)
  // "3": the call ends
  await plan(4, 'Дарс')
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await call.getByRole('button', { name: 'Бардоштан' }).click()
  await call.getByRole('button', { name: 'Рақамҳо' }).click()
  await call.getByRole('button', { name: '3', exact: true }).click()
  await expect(call.locator('.call-status')).toHaveText('Занг анҷом ёфт')
  await expect(call).toHaveCount(0, { timeout: 5000 })
  expect(errors).toEqual([])
})

test('a worked answer: formulas, a table and code drawn; a long question folds, fading, and opens when tapped; an unsent message stays as the chat\'s draft', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const SOLVED = '$4x^2+3x^2-2=0$ → $7x^2=2$\n\n$$x=\\pm\\sqrt{\\frac{2}{7}}$$\n\n| Қадам | Натиҷа |\n|---|---|\n| 1 | $7x^2=2$ |\n\n```python\nprint(2 / 7)\n```\n\n**Ҷавоб:** $x\\approx\\pm0{,}53$ 🎉'
  await fakeMahliyo(page, () => ({ tajik: true, reply: SOLVED, blocks: [{ type: 'text', text: SOLVED }] }), 300)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/mahliyo')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const box = page.getByPlaceholder('Паём ба Mahliyo AI…')
  const long = Array.from({ length: 14 }, (_, i) => `Сатри ${i + 1}: шарти масъала`).join('\n')
  await box.fill(long)
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  const answer = page.locator('.ai-said .ai-md')
  await expect(answer.locator('.katex-display')).toBeVisible({ timeout: 10_000 })
  await expect(answer.locator('.katex').first()).toBeVisible()
  await expect(answer.locator('.ai-table table th').first()).toHaveText('Қадам')
  await expect(answer.locator('pre code')).toHaveText('print(2 / 7)')
  await expect(answer.locator('strong')).toHaveText('Ҷавоб:')
  // her emoji are the chat's own (Fluent 3D), the same on every phone
  await expect(answer.locator('img.emo[alt="🎉"]')).toBeVisible()
  expect(await answer.locator('img.emo').first().getAttribute('src')).toBe('/assets/emoji/1f389.webp')
  expect(await answer.textContent()).not.toContain('$$')
  // her long question: its first lines, fading; tapped, whole
  const q = page.locator('.ai-q')
  await expect(q).toHaveClass(/is-long/)
  const folded = (await q.boundingBox())!.height
  await page.screenshot({ path: 'test-results/mahliyo-math.png' })
  await q.click()
  await expect(q).toHaveClass(/is-whole/)
  expect((await q.boundingBox())!.height).toBeGreaterThan(folded + 40)
  // typed, an emoji turns into the chat's own at once; the learner's bubble shows it so too
  await box.fill('Салом 😊')
  await expect(page.locator('.ai-input-copy img.emo[alt="😊"]')).toBeVisible()
  expect(await box.evaluate((e) => getComputedStyle(e).webkitTextFillColor)).toBe('rgba(0, 0, 0, 0)')
  await page.screenshot({ path: 'test-results/mahliyo-emoji-box.png' })
  // a draft: written, not sent — kept for this chat, also after the app is opened again
  await box.fill('Ҳанӯз нафиристодам')
  await page.getByRole('button', { name: 'Таърихи чатҳо' }).click()
  await page.locator('.ai-history').getByRole('button', { name: 'Сӯҳбати нав' }).click()
  await expect(box).toHaveValue('')
  await page.reload()
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Таърихи чатҳо' }).click()
  await page.locator('.ai-history').getByText(/Сатри 1/).click()
  await expect(box).toHaveValue('Ҳанӯз нафиристодам')
  expect(errors).toEqual([])
})

test('code: copy, and a web page previewed in a sealed frame; pulled down at its top, the chat lets go into a new one', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const CODE = 'Ин саҳифа 😊\n\n```html\n<h1 id="hi">Салом!</h1>\n```'
  await fakeMahliyo(page, () => ({ tajik: true, reply: CODE, blocks: [{ type: 'text', text: CODE }] }), 200)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/mahliyo')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.getByPlaceholder('Паём ба Mahliyo AI…').fill('Коди HTML нависед')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  const code = page.locator('.ai-code')
  await expect(code.locator('.ai-code-head')).toContainText('html', { timeout: 10_000 })
  await expect(code.locator('pre code')).toHaveText('<h1 id="hi">Салом!</h1>')
  await code.getByRole('button', { name: 'Нусха' }).click()
  await expect(page.locator('.toast').filter({ hasText: /Нусха гирифта шуд|дастрас нест/ })).toBeVisible()
  await code.getByRole('button', { name: 'Пешнамоиш' }).click()
  const preview = page.getByRole('dialog', { name: 'Пешнамоиш' })
  await expect(preview.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts')
  await expect(preview.frameLocator('iframe').locator('#hi')).toHaveText('Салом!')
  await page.screenshot({ path: 'test-results/mahliyo-code-preview.png' })
  await preview.getByRole('button', { name: 'Пӯшидан' }).click()
  await expect(preview).toHaveCount(0)
  // pulled down at the top: the sign fills, and let go, a new chat
  await page.locator('.ai-scroll').evaluate((el) => {
    const touch = (y: number) => new Touch({ identifier: 1, target: el, clientX: 200, clientY: y })
    const fire = (type: string, y: number) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [touch(y)], changedTouches: [touch(y)] }))
    fire('touchstart', 200)
    for (let y = 220; y <= 760; y += 30) fire('touchmove', y)
  })
  await expect(page.locator('.ai-pull')).toHaveClass(/is-ready/)
  await page.locator('.ai-scroll').evaluate((el) => el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [] })))
  await expect(page.locator('.ai-said')).toHaveCount(0, { timeout: 3000 })
  await expect(page.locator('.ai-hero')).toBeVisible()
  // the first chat is still in the history
  await page.getByRole('button', { name: 'Таърихи чатҳо' }).click()
  await expect(page.locator('.ai-history')).toContainText('Коди HTML нависед')
  // the test's own start-up script also runs in the sealed frame, where storage is closed: not the app's error
  const own = errors.filter((e) => !e.includes('sandboxed'))
  errors.splice(0, errors.length, ...own)
  expect(errors).toEqual([])
})

test('her sources small at the end of the row (a list of blue links), pictures, 👍 👎 that reach the staff, and a button back down that shows her dots', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const rated: unknown[] = []
  await page.route('**/api/v1/mahliyo/rate', (r) => { rated.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true })) })
  const long = Array.from({ length: 30 }, (_, i) => `Сатри ${i + 1} дар бораи оҳу.`).join('\n\n')
  const PIC = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#c96"/></svg>')
  await fakeMahliyo(page, (q) => (q.startsWith('Расм')
    ? { tajik: true, reply: 'Оҳу…', blocks: [
      { type: 'text', text: 'Оҳу ҳайвони зебост 🦌 — [мақола](https://tg.wikipedia.org/wiki/Оҳу)' },
      { type: 'images', items: [{ src: PIC, title: 'Оҳу', url: 'https://tg.wikipedia.org/wiki/Оҳу' }, { src: PIC, title: 'Deer', url: 'https://en.wikipedia.org/wiki/Deer' }] },
      { type: 'sources', items: [{ title: 'Оҳу', url: 'https://tg.wikipedia.org/wiki/Оҳу', site: 'tg.wikipedia.org' }, { title: 'Deer', url: 'https://en.wikipedia.org/wiki/Deer', site: 'en.wikipedia.org' }] }
    ] }
    : { tajik: true, reply: long, blocks: [{ type: 'text', text: long }] }), 300)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/mahliyo')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const box = page.getByPlaceholder('Паём ба Mahliyo AI…')
  await box.fill('Расмҳои оҳу бо манбаъ')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  const said = page.locator('.ai-said').last()
  await expect(said.locator('.ai-image img')).toHaveCount(2, { timeout: 10_000 })
  // her emoji are the iPhone's pictures; a link in her words is blue
  await expect(said.locator('img.emo[alt="🦌"]')).toHaveAttribute('src', '/assets/emoji/1f98c.webp')
  expect(await said.locator('.ai-md a').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(47, 123, 246)')
  // the sources: small, at the end of the row; tapped, the list
  const sources = said.locator('.ai-acts .ai-sources')
  await expect(sources).toContainText('Манбаъҳо')
  await expect(sources.locator('.ai-sources-marks i')).toHaveCount(2)
  await page.screenshot({ path: 'test-results/mahliyo-sources.png' })
  await sources.click()
  const sheet = page.getByRole('dialog', { name: 'Манбаъҳо' })
  await expect(sheet.getByRole('link', { name: 'Deer' })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Deer')
  await sheet.getByRole('button', { name: 'Пӯшидан' }).click()
  // 👍, then 👎, then 👎 again (taken back): each reaches the staff
  await said.getByRole('button', { name: 'Ҷавоби хуб' }).click()
  await expect(said.getByRole('button', { name: 'Ҷавоби хуб' })).toHaveAttribute('aria-pressed', 'true')
  await said.getByRole('button', { name: 'Ҷавоби бад' }).click()
  await said.getByRole('button', { name: 'Ҷавоби бад' }).click()
  await expect.poll(() => rated.map((r) => (r as { rating: number | null }).rating)).toEqual([1, -1, null])
  // a long answer read from its top: a button back down; while she writes below, it shows her dots
  await box.fill('Бисёр нависед')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-said')).toHaveCount(2, { timeout: 10_000 })
  await page.locator('.ai-scroll').evaluate((e) => e.scrollTo({ top: 0 }))
  const down = page.getByRole('button', { name: 'Ба поён' })
  await expect(down).toBeVisible()
  await down.click()
  await expect(down).toHaveCount(0)
  await box.fill('Боз нависед')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await page.locator('.ai-scroll').evaluate((e) => e.scrollTo({ top: 0 }))
  await expect(page.locator('.ai-down.is-writing .mi-dots')).toBeVisible()
  expect(errors).toEqual([])
})

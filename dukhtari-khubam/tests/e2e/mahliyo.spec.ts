import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ contentType: 'application/json', body: JSON.stringify(body) })
type Asked = { turns: { role: string; content: string }[]; name?: string; me?: string; now?: string; tz?: string }

test('Mahliyo AI: her tab in the dock opens her scene; she answers in blocks — steps, a screenshot with a pointer, a link, a reminder', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const asked: Asked[] = []
  await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill(json({ ready: true })))
  await page.route('**/api/v1/mahliyo/ask', async (r) => {
    const body = r.request().postDataJSON() as Asked
    asked.push(body)
    const last = body.turns[body.turns.length - 1].content
    await new Promise((f) => setTimeout(f, 500))
    if (last.startsWith('Как')) {
      return r.fulfill(json({ tajik: false, reply: 'Извините, мой русский не очень хороший.', blocks: [{ type: 'text', text: 'Извините, мой русский не очень хороший. Напишите свои вопросы консультанту.' }] }))
    }
    if (last.startsWith('Соати')) {
      const at = new Date(Date.now() + 3 * 3600_000).toISOString()
      return r.fulfill(json({ tajik: true, reply: 'Хуб!', blocks: [{ type: 'text', text: 'Хуб, ёдатон медиҳам!' }, { type: 'reminder', at, title: 'Вақти дарс', text: 'Малика, дарс интизор аст!' }] }))
    }
    return r.fulfill(json({ tajik: true, reply: 'Пин-кодро дар «Танзимот» иваз мекунед.\n\nЧӣ тавр\n1. «Профил»-ро кушоед\n2. «Танзимот»-ро пахш кунед', blocks: [
      { type: 'text', text: 'Пин-кодро дар «Танзимот» иваз мекунед.' },
      { type: 'steps', title: 'Чӣ тавр', items: ['«Профил»-ро кушоед', '«Танзимот»-ро пахш кунед', '«Қулфи барнома»-ро ёбед'] },
      { type: 'screen', spot: 'settings.pin', caption: '«Қулфи барнома»-ро пахш кунед' },
      { type: 'link', to: '/settings', label: 'Ба танзимот' }
    ] }))
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  // her face in the middle of the tab bar
  const tab = page.locator('.dock').getByRole('link', { name: 'Маҳлиё AI' })
  await expect(tab.locator('img')).toHaveAttribute('src', '/assets/mascot/face.webp')
  await tab.click()
  await expect(page).toHaveURL(/\/mahliyo\/?$/)
  await expect(tab).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.ai-greet')).toHaveText('Салом, Малика!')
  await expect(page.locator('.ai-orb-lg img')).toBeVisible()

  // a suggested question goes at once; she thinks (orb turning, the line shimmering), then her blocks rise
  await page.locator('.ai-chip', { hasText: 'Пин-кодро фаромӯш кардам' }).click()
  await expect(page.locator('.ai-scene.is-thinking')).toBeVisible()
  await expect(page.locator('.ai-thinking')).toContainText('Маҳлиё фикр мекунад')
  await expect(page.locator('.ai-status')).toHaveText('Маҳлиё фикр мекунад')
  await expect(page.locator('.ai-text').first()).toContainText('«Танзимот»')
  await expect(page.locator('.ai-steps li')).toHaveCount(3)
  await expect(page.locator('.ai-step-n').nth(2)).toHaveText('3')
  // the screenshot: the picture of that screen, the place marked, a pulsing pointer; a tap shows it large
  await expect(page.locator('.ai-screen img')).toHaveAttribute('src', '/assets/ai-screens/settings.pin.webp')
  await expect(page.locator('.ai-screen .ai-pointer i').first()).toBeVisible()
  expect(await page.locator('.ai-screen img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
  await page.locator('.ai-screen > button').click()
  await expect(page.locator('.ai-zoom .ai-mark')).toBeVisible()
  await page.locator('.ai-zoom').click()
  await expect(page.locator('.ai-zoom')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ба танзимот' })).toHaveAttribute('href', '/settings')
  // what the phone told her: who the learner is, her clock
  expect(asked[0]).toMatchObject({ name: 'Малика', turns: [{ role: 'user', content: 'Пин-кодро фаромӯш кардам, чӣ кунам?' }] })
  expect(asked[0].me).toContain('Name: Малика')
  expect(asked[0].now).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/)
  // "I did not understand" is one tap away
  await expect(page.locator('.ai-follow .ai-chip')).toHaveText('Нафаҳмидам, дар расм нишон диҳед')
  await page.screenshot({ path: 'test-results/mahliyo-ai.png' })

  // a reminder: on the website it cannot ring, and says so
  await page.getByPlaceholder('Бо тоҷикӣ пурсед…').fill('Соати 20:00 ёдам деҳ')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-reminder')).toContainText('Вақти дарс')
  await expect(page.locator('.ai-reminder-time')).toHaveText(/^(Имрӯз|Пагоҳ), \d\d:\d\d$/)
  await expect(page.locator('.ai-reminder-state')).toHaveText('Ёдраскунӣ танҳо дар барномаи телефон занг мезанад.')
  // her earlier answers go back as she said them
  expect(asked[1].turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user'])
  expect(asked[1].turns[1].content).toContain('1. «Профил»-ро кушоед')

  // another language: her apology in it, and the way to the consultant
  await page.getByPlaceholder('Бо тоҷикӣ пурсед…').fill('Как поменять PIN?')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-said').last()).toContainText('Извините')
  await expect(page.locator('.ai-said').last().getByRole('link', { name: 'Ба мушовир нависед' })).toHaveAttribute('href', '/support')

  // the conversation stays on the phone; a new one starts clean
  await page.reload()
  await expect(page.locator('.ai-said')).toHaveCount(3)
  await expect(page.locator('.ai-steps li')).toHaveCount(3)
  await page.getByRole('button', { name: 'Сӯҳбати нав' }).click()
  await expect(page.locator('.ai-said')).toHaveCount(0)
  await expect(page.locator('.ai-suggest')).toBeVisible()
  expect(errors).toEqual([])
})

test('without the AI set up on the server, her scene says she is coming soon and points to the consultant', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.goto('/mahliyo')
  await expect(page.locator('.ai-hello')).toContainText('ба наздикӣ омода мешавад')
  await expect(page.locator('.ai-hero').getByRole('link', { name: 'Ба мушовир нависед' })).toHaveAttribute('href', '/support')
  await expect(page.getByPlaceholder('Бо тоҷикӣ пурсед…')).toBeDisabled()
  await expect(page.locator('.ai-suggest')).toHaveCount(0)
  expect(errors).toEqual([])
})

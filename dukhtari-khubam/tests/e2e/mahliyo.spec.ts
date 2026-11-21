import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ contentType: 'application/json', body: JSON.stringify(body) })

test('Mahliyo AI: her face on home opens the chat; she answers in Tajik; another language points to the consultant', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const asked: { turns: { role: string; content: string }[]; name?: string }[] = []
  await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill(json({ ready: true })))
  await page.route('**/api/v1/mahliyo/ask', async (r) => {
    const body = r.request().postDataJSON() as { turns: { role: string; content: string }[]; name?: string }
    asked.push(body)
    const last = body.turns[body.turns.length - 1].content
    await new Promise((f) => setTimeout(f, 400))
    return r.fulfill(json(/[а-яё]/i.test(last) && !/[ӣӯқғҳҷ]/i.test(last) && last.startsWith('Как')
      ? { tajik: false, reply: 'Извините, мой русский не очень хороший. Напишите свои вопросы консультанту.' }
      : { tajik: true, reply: 'Тести ниҳоии марҳила аз тести ҳар дарс ду саволи тасодуфӣ дорад; барои гузаштан 70% лозим аст.' }))
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.getByRole('link', { name: 'Аз Маҳлиё пурсед' }).click()
  await expect(page).toHaveURL(/\/mahliyo\/?$/)
  await expect(page.locator('.ai-hello')).toContainText('Ман Маҳлиё')
  // a suggested question goes at once; her dots while she thinks, then her answer beside her face
  await page.getByRole('listitem').filter({ hasText: 'Тести ниҳоии марҳила чист?' }).click()
  await expect(page.locator('.ai-said .mi-dots')).toBeVisible()
  await expect(page.locator('.ai-said .bubble')).toContainText('70% лозим аст')
  expect(asked[0]).toMatchObject({ name: 'Малика', turns: [{ role: 'user', content: 'Тести ниҳоии марҳила чист?' }] })
  // another language: her apology in it, and the way to the consultant
  await page.getByPlaceholder('Бо тоҷикӣ пурсед…').fill('Как поменять PIN?')
  await page.getByRole('button', { name: 'Фиристодан' }).click()
  await expect(page.locator('.ai-said').last()).toContainText('Извините')
  await expect(page.getByRole('link', { name: 'Ба мушовир нависед' })).toHaveAttribute('href', '/support')
  // the conversation went with the question, and stays on the phone
  expect(asked[1].turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user'])
  await page.screenshot({ path: 'test-results/mahliyo-ai.png' })
  await page.reload()
  await expect(page.locator('.ai-said')).toHaveCount(2)
  // a new conversation
  await page.getByRole('button', { name: 'Сӯҳбати нав' }).click()
  await expect(page.locator('.ai-said')).toHaveCount(0)
  await expect(page.locator('.ai-suggest')).toBeVisible()
  expect(errors).toEqual([])
})

test('without the AI set up on the server, there is no way to her', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill(json({ ready: false })))
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.motto')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Аз Маҳлиё пурсед' })).toHaveCount(0)
  expect(errors).toEqual([])
})

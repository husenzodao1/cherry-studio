import { expect, signedIn, test } from './fixtures'

test.describe('sign-in with e-mail', () => {
  test('a new address: wrong code, right code, name and birthday, then the welcome questions', async ({ page, server, errors }) => {
    await page.goto('/start')
    await page.getByRole('textbox', { name: /почта/i }).fill('new@gmail.com')
    await page.locator('form .btn-lg').click()
    await page.locator('.otp-input').fill('111111')
    await expect(page.locator('.otp-field.is-bad')).toBeVisible()
    await expect(page.locator('.otp-field.is-bad')).toBeHidden()
    await page.locator('.otp-input').fill('222222')
    await expect(page.locator('.birthday-input')).toBeVisible()
    await page.locator('input[autocomplete=given-name]').fill('Нигина')
    // an age no learner can have is refused with its reason
    await page.locator('.birthday-input').pressSequentially('01012026')
    await expect(page.getByText(/аз 9 то 40/)).toBeVisible()
    await expect(page.locator('form .btn-lg')).toBeDisabled()
    await page.locator('.birthday-input').fill('')
    await page.locator('.birthday-input').pressSequentially('01032008')
    await expect(page.locator('.birthday-input')).toHaveValue('01.03.2008')
    await page.locator('form .btn-lg').click()
    await expect(page).toHaveURL(/\/welcome\/?$/)
    await expect(page.locator('.wl-q')).toBeVisible()
    // "your own answer" for the hours a day: 7 cannot be, 5 can
    await page.locator('.wl-option').last().click()
    await page.locator('.wl-custom').fill('7')
    await expect(page.locator('.wl-wrong')).toBeVisible()
    await expect(page.locator('.wl-next')).toBeDisabled()
    await page.locator('.wl-custom').fill('5')
    await expect(page.locator('.wl-next')).toBeEnabled()
    expect(server.codes).toEqual(['111111', '222222'])
    expect(server.pushes, 'the new profile was backed up to Supabase').toBeGreaterThan(0)
    expect(errors).toEqual([])
  })

  test('an address that keeps a profile goes straight home', async ({ page, server, errors }) => {
    server.profile = { code: '512345678901234', name: 'Зарина', data: { v: 1, born: 2008, about: { at: '2026-11-18T00:00:00Z' }, lessons: {}, quizzes: {}, bookmarks: {}, achievements: {}, days: [], review: {} } }
    await page.goto('/start')
    await page.getByRole('textbox', { name: /почта/i }).fill('old@gmail.com')
    await page.locator('form .btn-lg').click()
    await page.locator('.otp-input').fill('222222')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('.greet')).toContainText('Зарина')
    expect(errors).toEqual([])
  })

  test('the opening screen hides itself and stays in the page (React owns it)', async ({ page, errors }) => {
    await page.goto('/start')
    await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
    await expect(page.locator('#splash')).toHaveCount(1)
    expect(errors).toEqual([])
  })
})

test('a new phone starts in Russian; the language icon opens a centred list and switches at once', async ({ page, server: _, errors }) => {
  // a phone that never chose a language (the fixture's Tajik is taken away before the first page)
  await page.addInitScript(() => { if (!sessionStorage.getItem('fresh')) { sessionStorage.setItem('fresh', '1'); localStorage.removeItem('dk.prefs') } })
  await page.goto('/start')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.locator('.google-btn')).toContainText('Google')
  await expect(page.locator('form .btn-lg')).toHaveText(/Далее/)
  await page.locator('.start-lang').click()
  const box = page.getByRole('dialog')
  await expect(box).toBeVisible()
  // centred on the screen, over the whole page
  const r = await box.boundingBox()
  const vw = page.viewportSize()!.width
  expect(Math.abs(r!.x + r!.width / 2 - vw / 2)).toBeLessThan(2)
  await box.getByRole('radio', { name: 'Тоҷикӣ' }).click()
  await expect(box).toBeHidden()
  await expect(page.locator('form .btn-lg')).toHaveText(/Давом/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'tg')
  expect(errors).toEqual([])
})

test('PIN recovery by e-mail: the six code boxes keep their size (they used to shrink to thin lines)', async ({ page, server: _, errors }) => {
  await signedIn(page)
  // a PIN is set: the app opens behind the PIN pad
  await page.addInitScript(() => localStorage.setItem('dk.pin', JSON.stringify({ salt: '00', hash: 'x', fails: 0, until: 0 })))
  await page.goto('/')
  await page.getByRole('button', { name: 'Тасдиқ бо почта' }).click()
  const boxes = page.locator('.recovery .otp-boxes span')
  await expect(boxes).toHaveCount(6)
  for (let i = 0; i < 6; i++) expect((await boxes.nth(i).boundingBox())!.width).toBeGreaterThan(36)
  // with a digit typed, all six stay the same size
  await page.locator('.recovery .otp-input').fill('5')
  // after the little pop of the filled box
  await page.waitForTimeout(500)
  const widths = await boxes.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)))
  expect(new Set(widths).size).toBe(1)
  expect(widths[0]).toBeGreaterThan(36)
  await page.screenshot({ path: 'test-results/pin-email-code.png' })
  expect(errors).toEqual([])
})

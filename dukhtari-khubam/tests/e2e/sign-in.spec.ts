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
    // Mahliyo meets her first; a tap writes all her words at once and "Бале" opens the questions
    await expect(page.locator('.mahliyo-intro')).toBeVisible()
    await page.locator('.mi-stage').click()
    await page.getByRole('button', { name: /Бале/ }).click()
    await expect(page.locator('.wl-q')).toBeVisible({ timeout: 10_000 })
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

test('sign-in screen: Mahliyo with her book in the middle, eight objects come out and settle around her, none on her face', async ({ page, server: _, errors }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/start')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const girl = page.locator('.ss-mahliyo')
  await expect(girl.locator('video')).toHaveAttribute('src', '/assets/mahliyo/signin.webm')
  // her clip plays and loops (with its sound once the browser allows it)
  await expect.poll(() => girl.locator('video').evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0.3 && v.loop), { timeout: 8000 }).toBe(true)
  const objects = page.locator('.ss-obj')
  await expect(objects).toHaveCount(8)
  await page.waitForTimeout(2600)
  const g = (await girl.boundingBox())!
  const face = { x: g.x + g.width * 0.3, y: g.y, w: g.width * 0.4, h: g.height * 0.42 }
  const boxes = await objects.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, o: getComputedStyle(e).opacity } }))
  for (const b of boxes) {
    expect(b.o).toBe('1')
    expect(b.w).toBeLessThan(50)
    // inside the screen, never over her face
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.w).toBeLessThanOrEqual(390)
    const apart = b.x + b.w * 0.8 <= face.x || b.x + b.w * 0.2 >= face.x + face.w || b.y + b.h * 0.8 <= face.y || b.y + b.h * 0.2 >= face.y + face.h
    expect(apart).toBe(true)
  }
  // half on her left, half on her right, as drawn
  const middle = g.x + g.width / 2
  expect(boxes.filter((b) => b.x + b.w / 2 < middle)).toHaveLength(4)
  await page.screenshot({ path: 'test-results/sign-in-mahliyo.png' })
  expect(errors).toEqual([])
})

test('Mahliyo meets a new learner: her words come as she says them, "Бале", she claps, then the questions', async ({ page, server: _, errors }) => {
  await signedIn(page, { name: 'Нигина' })
  await page.addInitScript(() => { const p = JSON.parse(localStorage.getItem('dk.progress')!); delete p.about; localStorage.setItem('dk.progress', JSON.stringify(p)) })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/welcome')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const talk = page.locator('video.is-talk')
  await expect(talk).toHaveAttribute('src', '/assets/mahliyo/intro.webm')
  const typed = page.locator('.mi-typed')
  // nothing is written before she speaks; then her greeting with the learner's name, as she says it
  await expect(typed.first()).toHaveText('Салом, Нигина!', { timeout: 6000 })
  const at = await talk.evaluate((v: HTMLVideoElement) => v.currentTime)
  expect(at).toBeGreaterThan(1.2)
  await expect(page.getByRole('button', { name: /Бале/ })).toBeHidden()
  // the last sentence, then "Бале"
  await expect(typed.last()).toHaveText('Омодаед оғоз кунем?', { timeout: 12_000 })
  await expect(page.getByRole('button', { name: /Бале/ })).toBeVisible()
  // her words sit above her, never over her face
  const say = (await page.locator('.mi-say').boundingBox())!
  const stage = (await page.locator('.mi-stage').boundingBox())!
  expect(say.y + say.height).toBeLessThanOrEqual(stage.y + stage.height * 0.06)
  await page.screenshot({ path: 'test-results/intro-words.png' })
  await page.getByRole('button', { name: /Бале/ }).click()
  // she claps (her second clip takes over), then the first question
  await expect(page.locator('.mahliyo-intro')).toHaveClass(/is-yes-on/, { timeout: 4000 })
  await expect.poll(() => page.locator('video.is-yes').evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 4000 }).toBeGreaterThan(0.5)
  await page.screenshot({ path: 'test-results/intro-clap.png' })
  await expect(page.locator('.wl-q')).toBeVisible({ timeout: 10_000 })
  expect(errors).toEqual([])
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
  // no life questions chosen: "Forgot it?" goes straight to the e-mail way
  await page.getByRole('button', { name: 'Фаромӯш кардед?' }).click()
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

test('PIN pad: "Фаромӯш кардед?" opens the life questions, with the e-mail way small below them', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.addInitScript(() => {
    localStorage.setItem('dk.pin', JSON.stringify({ salt: '00', hash: 'x', fails: 0, until: 0 }))
    const item = (q: string) => ({ q, salt: '00', hash: 'x' })
    localStorage.setItem('dk.pin_recovery', JSON.stringify({ items: [item('food'), item('teacher'), item('city')], fails: 0, until: 0 }))
  })
  await page.goto('/')
  // the pad says "Forgot it?", not "confirm by e-mail"
  await expect(page.getByRole('button', { name: 'Тасдиқ бо почта' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Фаромӯш кардед?' }).click()
  await expect(page.getByRole('heading', { name: 'Саволҳои ҳаётӣ' })).toBeVisible()
  // the e-mail way: small, below the questions
  const small = page.locator('.recovery-foot .pin-small')
  await expect(small).toHaveText('Тасдиқ бо почта')
  await small.click()
  await expect(page.getByRole('heading', { name: 'Тасдиқ бо почтаи электронӣ' })).toBeVisible()
  await expect(page.locator('.recovery .otp-boxes span')).toHaveCount(6)
  expect(errors).toEqual([])
})

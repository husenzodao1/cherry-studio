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

test('Mahliyo meets a new learner: her Tajik words rise one by one as she says them, "Бале", "Офарин!", she claps, then the questions', async ({ page, server: _, errors }) => {
  await signedIn(page, { name: 'Нигина' })
  await page.addInitScript(() => { const p = JSON.parse(localStorage.getItem('dk.progress')!); delete p.about; localStorage.setItem('dk.progress', JSON.stringify(p)) })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/welcome')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const talk = page.locator('video.is-talk')
  await expect(talk).toHaveAttribute('src', '/assets/mahliyo/intro.webm')
  await expect(page.locator('.mi-name')).toHaveText('Маҳлиё')
  const shown = page.locator('.mi-w.is-in')
  // before her first word: three dots; her first word comes with her voice
  await expect(page.locator('.mi-dots')).toBeVisible()
  await expect(shown.first()).toHaveText('Салом,', { timeout: 6000 })
  expect(await talk.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.95)
  // while she speaks, the word she says glows and her voice wave moves
  await expect(page.locator('.mi-w.is-now')).toHaveCount(1, { timeout: 4000 })
  await expect(page.locator('.mi-wave.is-on')).toBeVisible()
  await expect(page.getByRole('button', { name: /Бале/ })).toBeHidden()
  // all of it, then "Бале"
  await expect(page.locator('.mi-ask')).toHaveText('Омодаед оғоз кунем?', { timeout: 14_000 })
  await expect(page.locator('.mi-w:not(.is-in)')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Бале/ })).toBeVisible()
  await expect(page.locator('.mi-lines')).toContainText('Салом, дӯсти азиз! Ман омӯзгори шумо ҳастам.')
  // her words sit above her, never over her face
  const say = (await page.locator('.mi-say').boundingBox())!
  const stage = (await page.locator('.mi-stage').boundingBox())!
  expect(say.y + say.height).toBeLessThanOrEqual(stage.y + stage.height * 0.06)
  await page.screenshot({ path: 'test-results/intro-words.png' })
  await page.getByRole('button', { name: /Бале/ }).click()
  // her second clip takes over: "Офарин! Пас, рафтем! …" the same way, then she claps, then the first question
  await expect(page.locator('.mahliyo-intro')).toHaveClass(/is-yes-on/, { timeout: 4000 })
  await expect(shown.first()).toHaveText('Офарин!', { timeout: 6000 })
  await expect(page.locator('.mi-lines')).toContainText('Шуморо чизҳои нав интизоранд!', { timeout: 8000 })
  await page.screenshot({ path: 'test-results/intro-bravo.png' })
  await expect(page.locator('.wl-q')).toBeVisible({ timeout: 12_000 })
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

test('PIN pad: "Фаромӯш кардед?" opens the life questions; "Ҷавобҳоро низ дар хотир надоред?" the e-mail code; "Ба почта низ дастрасӣ нест?" support', async ({ page, server: _, errors }) => {
  const sent: string[] = []
  const thread = (body: string) => ({ id: 't1', status: 'open', needs_rating: false, messages: [
    { id: 'm1', from_staff: false, kind: 'text', body, at: new Date().toISOString() },
    { id: 'm2', from_staff: true, kind: 'bot', body: 'Салом! …', at: new Date().toISOString() }] })
  await page.route('**/api/v1/support/send', (r) => {
    const body = (r.request().postDataJSON() as { body: string }).body
    sent.push(body)
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(thread(body)) })
  })
  await page.route('**/api/v1/support/thread', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ thread: sent.length ? thread(sent[0]) : null }) }))
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
  await expect(small).toHaveText('Ҷавобҳоро низ дар хотир надоред?')
  await small.click()
  await expect(page.getByRole('heading', { name: 'Тасдиқ бо почтаи электронӣ' })).toBeVisible()
  await expect(page.locator('.recovery .otp-boxes span')).toHaveCount(6)
  // no access to the e-mail either: support opens with her request already sent, and Mahliyo answers
  await page.getByRole('button', { name: 'Ба почта низ дастрасӣ нест?' }).click()
  await expect(page).toHaveURL(/\/support\/?$/)
  await expect.poll(() => sent).toEqual(['Салом! Ман ба почтаи m@gmail.com дастрасӣ надорам, лутфан кӯмак мекардед?'])
  await expect(page.locator('.bubble-bot')).toContainText('Маҳлиё AI')
  await expect(page.locator('.bubble-bot')).toContainText('ҳамаи мушовирони нуқтаи дастгирӣ банданд')
  // the PIN still guards the app: leaving support goes back behind it
  await page.getByRole('button', { name: 'Бозгашт' }).click()
  await expect(page.getByRole('button', { name: 'Фаромӯш кардед?' })).toBeVisible()
  // opened again, the request is not sent twice
  await page.goto('/support?help=email')
  await expect(page.locator('.bubble-bot')).toBeVisible()
  expect(sent).toHaveLength(1)
  expect(errors).toEqual([])
})

test('PIN pad: "Нест кардан бо тасдиқи почта" in sight for an account signed in with Google too; it opens the e-mail code', async ({ page, server: _, errors }) => {
  // signed in with Google: her address is her Google account's
  await signedIn(page, { email: null, google: 'malika@gmail.com' })
  await page.addInitScript(() => localStorage.setItem('dk.pin', JSON.stringify({ salt: '00', hash: 'x', fails: 0, until: 0 })))
  await page.goto('/')
  const byEmail = page.getByRole('button', { name: 'Нест кардан бо тасдиқи почта' })
  await expect(byEmail).toBeVisible()
  await byEmail.click()
  await expect(page.locator('.recovery .otp-boxes span')).toHaveCount(6)
  await expect(page.locator('.pin-screen')).toContainText('malika@gmail.com')
  expect(errors).toEqual([])
})

test("support's help, carried out by the phone: a new PIN opens the lock; the PIN off opens the app; the account's new e-mail is kept", async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.addInitScript(() => {
    localStorage.setItem('dk.support', 'a'.repeat(64))
    if (!sessionStorage.getItem('e2e.pin')) {
      sessionStorage.setItem('e2e.pin', '1')
      localStorage.setItem('dk.pin', JSON.stringify({ salt: '00', hash: 'x', fails: 0, until: 0 }))
    }
  })
  const at = new Date().toISOString()
  let messages: unknown[] = [{ id: 'h1', from_staff: true, kind: 'text', action: 'pin', body: '4821', at }]
  const sent: { email?: string }[] = []
  await page.route('**/api/v1/support/thread', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ thread: { id: 't', status: 'open', messages } }) }))
  await page.route('**/api/v1/support/send', (r) => {
    sent.push(r.request().postDataJSON())
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 't', status: 'open', messages }) })
  })
  // locked, she writes to support (it opens over the lock)
  await page.goto('/support')
  await expect(page.locator('.bubble-help')).toContainText('PIN-и нави шумо: 4821')
  // the account she writes for goes with her message
  await page.locator('.chat-form textarea, .chat-form input').last().fill('Ёрӣ диҳед')
  await page.locator('.chat-form').getByRole('button').last().click()
  await expect.poll(() => sent.length).toBe(1)
  expect(sent[0].email).toBe('m@gmail.com')
  // back at the lock: the new PIN opens it
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/locked/)
  await page.keyboard.type('4821')
  await expect(page.locator('html')).not.toHaveClass(/locked/, { timeout: 5000 })
  // the PIN off and a new e-mail: the phone does both by itself
  messages = [...messages, { id: 'h2', from_staff: true, kind: 'text', action: 'unlock', body: 'unlock', at }, { id: 'h3', from_staff: true, kind: 'text', action: 'email', body: 'new@gmail.com', at }]
  await page.goto('/support')
  await expect(page.locator('.bubble-help')).toHaveCount(3)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dk.pin'))).toBeNull()
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('dk.learner') ?? '{}') as { email?: string }).email)).toBe('new@gmail.com')
  expect(errors).toEqual([])
})

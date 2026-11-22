import { BUNDLE, expect, signedIn, test } from './fixtures'

test.describe('main screens of a signed-in learner', () => {
  for (const [path, sel] of [['/', '.motto'], ['/schools', '.tile-verse'], ['/profile', '.profile-head'], ['/settings', '.theme-box'], ['/garden', 'main'], ['/review', 'main'], ['/search', 'main'], ['/saved', 'main']] as const) {
    test(`${path} draws without errors`, async ({ page, server: _, errors }) => {
      await signedIn(page)
      await page.goto(path)
      await expect(page.locator(sel).first()).toBeVisible()
      await expect(page.locator('.heal')).toHaveCount(0)
      expect(errors).toEqual([])
    })
  }

  test('moving between screens keeps working (client navigation)', async ({ page, server: _, errors }) => {
    await signedIn(page)
    await page.goto('/')
    for (const name of [/мактаб/i, /захира/i, /профил/i, /асосӣ/i]) {
      await page.locator('.dock').getByRole('link', { name }).click()
      await page.waitForTimeout(400)
    }
    await expect(page.locator('.motto')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('every language draws the home screen; Persian and Dari read right to left', async ({ page, server: _, errors }) => {
    await signedIn(page)
    await page.goto('/settings')
    for (const [label, dir] of [['English', 'ltr'], ['فارسی', 'rtl'], ['دری', 'rtl'], ['Oʻzbekcha', 'ltr'], ['Türkçe', 'ltr'], ['Русский', 'ltr'], ['Тоҷикӣ', 'ltr']]) {
      await page.locator('.theme-head').first().click()
      await page.locator('.lang-pick', { hasText: label }).click()
      await expect(page.locator('html')).toHaveAttribute('dir', dir)
      await expect(page.locator('.theme-box.is-open')).toHaveCount(0) // the list folds itself after a choice
    }
    await page.goto('/')
    await expect(page.locator('.motto')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('home: what moves by itself (the schools touring, the words rising) never pauses the animations', async ({ page, server: _, errors }) => {
    await signedIn(page)
    await page.goto('/')
    await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
    await page.waitForTimeout(5000)
    await expect(page.locator('html')).not.toHaveClass(/is-scrolling/)
    // the label's wipe leaves room for hanging letters (the «з» of «рӯз»)
    const clip = await page.locator('.words-label').evaluate((e) => getComputedStyle(e).clipPath)
    expect(clip === 'none' || /inset\(-60%/.test(clip)).toBe(true)
    expect(errors).toEqual([])
  })

  test('settings: Mahliyo AI first in the list, Support last just above signing out', async ({ page, server: _, errors }) => {
    await signedIn(page)
    await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ready: true }) }))
    await page.goto('/settings')
    const rows = page.locator('.menu .menu-row')
    await expect(rows.first()).toContainText('Маҳлиё AI')
    const names = await rows.allInnerTexts()
    const support = names.findIndex((n) => n.includes('Дастгирӣ'))
    expect(support).toBe(names.length - 2)
    expect(names[names.length - 1]).toContain('Баромадан')
    expect(errors).toEqual([])
  })

  test('rating the app: a sheet with five faces and a comment, then a thank-you', async ({ page, server, errors }) => {
    await signedIn(page)
    await page.goto('/settings')
    await page.locator('.rate-box').first().click()
    const sheet = page.locator('.rate-sheet')
    await expect(sheet).toBeVisible()
    await expect(sheet.locator('.rate-face')).toHaveCount(5)
    await sheet.locator('.rate-face').nth(4).click()
    await expect(sheet.locator('.rate-face[aria-checked="true"]')).toHaveCount(1)
    // meaningless or rude text is not sent
    await sheet.locator('.rate-comment').fill('фывапролд')
    await sheet.locator('.btn-lg').click()
    await expect(sheet.getByText(/калимаҳои воқеӣ/)).toBeVisible()
    expect(server.ratings).toEqual([])
    await sheet.locator('.rate-comment').fill('Хеле зебо!')
    await page.screenshot({ path: 'test-results/rate-sheet.png' })
    await sheet.locator('.btn-lg').click()
    await expect(sheet.locator('.rate-thanks')).toBeVisible()
    expect(server.ratings).toEqual([{ p_stars: 5, p_comment: 'Хеле зебо!', p_version: expect.any(String), p_platform: 'web' }])
    await expect(sheet).toBeHidden({ timeout: 5000 })
    expect(errors).toEqual([])
  })

  test('profile: the faint signature is there, nothing written over the photo', async ({ page, server: _, errors }) => {
    await signedIn(page)
    await page.goto('/profile')
    await expect(page.locator('.studio-ghost')).toBeAttached()
    await expect(page.locator('.studio-arc')).toHaveCount(0)
    await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
    await page.screenshot({ path: 'test-results/profile.png' })
    expect(errors).toEqual([])
  })

  test('"Гулбоғи эҷод": the tile opens poems (a line per row) and stories (lines flow on)', async ({ page, server: _, errors }) => {
    await signedIn(page)
    await page.goto('/schools')
    const tile = page.locator('.tile-verse')
    await expect(tile).toContainText('2')
    await expect(page.locator('.verse-line')).toHaveCount(0) // nothing of the works on the tile itself
    await tile.click()
    await expect(page).toHaveURL(/\/verse\/?$/)
    await expect(page.locator('.verse-card')).toHaveCount(2)
    await expect(page.locator('.verse-line')).toHaveCount(2)
    await expect(page.locator('.verse-card.is-story .verse-body p')).toHaveText(['Як рӯз духтарак ба боғ рафт.', 'Дар он ҷо гул шукуфта буд.'])
    await page.locator('.segmented [role=tab]').nth(2).click()
    await expect(page.locator('.verse-card')).toHaveCount(1)
    await page.screenshot({ path: 'test-results/verse.png' })
    expect(errors).toEqual([])
  })

  test('light mode (weaker phones): no live blur anywhere, screens still draw', async ({ page, server: _, errors }) => {
    await page.addInitScript(() => localStorage.setItem('dk.lite', '1'))
    await signedIn(page)
    for (const path of ['/', '/schools', '/settings']) {
      await page.goto(path)
      await expect(page.locator('html')).toHaveClass(/\blite\b/)
      await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
      const blurred = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => {
        const cs = getComputedStyle(el)
        return (cs.backdropFilter && cs.backdropFilter !== 'none') || ((cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter ?? 'none') !== 'none'
      }).length)
      expect(blurred, `blurred elements on ${path}`).toBe(0)
    }
    expect(errors).toEqual([])
  })

  test('website: the top install button downloads the Android app straight from the GitHub raw file', async ({ page, server: _, errors }) => {
    await signedIn(page)
    await page.goto('/')
    const link = page.locator('a.install-btn')
    await expect(link).toHaveAttribute('href', /^https:\/\/raw\.githubusercontent\.com\/.+\.apk$/)
    await expect(link).toHaveAttribute('download', 'dukhtari-khubam.apk')
    expect(errors).toEqual([])
  })

  test('nothing found: the words under a moving magnifying glass', async ({ page, server: _, errors }) => {
    await signedIn(page)
    await page.goto('/search')
    await page.locator('input[type=search]').fill('ззззззз')
    const glass = page.locator('.lens-glass')
    await expect(glass).toBeVisible()
    const a = await glass.evaluate((el) => el.style.transform)
    await page.waitForTimeout(600)
    expect(await glass.evaluate((el) => el.style.transform)).not.toBe(a)
    // the view through the glass is drawn (some pixels of the words are in it)
    await expect.poll(() => page.locator('.lens-view').evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      let n = 0
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++
      return n
    })).toBeGreaterThan(20)
    // the hand's strokes reach past the letters' boxes: the line keeps room for them, so the first and
    // the last letter are never cut (the tail of «д» in «нашуд» used to be)
    await page.evaluate(() => document.fonts.ready)
    const room = await page.locator('.lens-text > .lens-line').evaluate((el) => {
      const cs = getComputedStyle(el)
      const ctx = document.createElement('canvas').getContext('2d')!
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      const m = ctx.measureText(el.textContent ?? '')
      return { left: parseFloat(cs.paddingLeft) - m.actualBoundingBoxLeft, right: parseFloat(cs.paddingRight) - (m.actualBoundingBoxRight - m.width) }
    })
    expect(room.left).toBeGreaterThanOrEqual(0)
    expect(room.right).toBeGreaterThanOrEqual(0)
    expect(errors).toEqual([])
  })
})

test('words of the day: a long poem keeps its lines, shows four and scrolls upward', async ({ page, server: _, errors }) => {
  const poem = ['Бӯи ҷӯи Мӯлиён ояд ҳаме,', 'Ёди ёри меҳрубон ояд ҳаме.', 'Реги Омую дуруштиҳои ӯ', 'Зери поям парниён ояд ҳаме.',
    'Оби Ҷайҳун аз нишоти рӯи дӯст', 'Хинги моро то миён ояд ҳаме.', 'Эй Бухоро, шод бошу дер зӣ,', 'Мир зи ту шодмон ояд ҳаме.'].join('\n')
  await page.route('**/api/v1/bundle**', (r) => r.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ ...BUNDLE, inspirations: [{ id: 'long', body: poem, author_name: 'Рӯдакӣ', source_title: null }] }) }))
  await signedIn(page)
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  const text = page.locator('.words-item.is-in .words-text')
  await expect(text).toHaveClass(/is-rising/)
  const quote = text.locator('blockquote')
  // the poem's own line breaks are kept
  expect(await quote.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('pre')
  // the window holds four lines
  const lines = await text.evaluate((el) => el.clientHeight / parseFloat(getComputedStyle(el.querySelector('blockquote')!).lineHeight))
  expect(Math.round(lines)).toBe(4)
  // first the beginning is read, unshaded; then it scrolls up slowly and the top line is shaded
  await expect(text).toHaveClass(/at-top/)
  await expect.poll(() => text.evaluate((el) => el.scrollTop), { timeout: 15_000 }).toBeGreaterThan(8)
  await expect(text).not.toHaveClass(/at-top/)
  await page.waitForTimeout(2500)
  await page.locator('.words').screenshot({ path: 'test-results/words-rise.png' })
  const t0 = await text.evaluate((el) => el.scrollTop)
  await page.waitForTimeout(1000)
  const t1 = await text.evaluate((el) => el.scrollTop)
  // slowly: about 9 px a second
  expect(t1 - t0).toBeGreaterThan(3)
  expect(t1 - t0).toBeLessThan(20)
  // a finger takes over: while it holds, nothing moves by itself and the quote stays
  await text.dispatchEvent('pointerdown')
  const h0 = await text.evaluate((el) => el.scrollTop)
  await page.waitForTimeout(1200)
  expect(await text.evaluate((el) => el.scrollTop)).toBe(h0)
  // the finger scrolls back to the beginning: no shade at the top again
  await text.evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')) })
  await expect(text).toHaveClass(/at-top/)
  expect(errors).toEqual([])
})

test('the "new version" note stays inside the screen, centred (it used to slide half off to the left)', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.goto('/')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  // the note itself shows only in the Android app: the same element with the same styles is placed here
  await page.evaluate(() => {
    const el = document.createElement('div')
    el.className = 'update-note glass'
    el.innerHTML = '<span class="update-icon"></span><span class="update-text">Версияи нав дастрас аст <b>1.14.7</b></span><a class="btn update-go">Навсозӣ</a>'
    document.body.appendChild(el)
  })
  await page.waitForTimeout(700)
  const box = (await page.locator('.update-note').boundingBox())!
  const vw = page.viewportSize()!.width
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vw)
  expect(Math.abs(box.x + box.width / 2 - vw / 2)).toBeLessThan(2)
  expect(errors).toEqual([])
})

test('every profile picture wears the little gold crown, tilted to one side', async ({ page, server: _, errors }) => {
  await signedIn(page)
  for (const path of ['/', '/profile']) {
    await page.goto(path)
    await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
    const crown = page.locator('.avatar-crown').first()
    await expect(crown).toBeVisible()
    await expect.poll(() => crown.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(300)
    // slipped to the left of the head and tilted, not straight on top
    await expect.poll(() => crown.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).b)).toBeLessThan(-0.3)
  }
  expect(errors).toEqual([])
})

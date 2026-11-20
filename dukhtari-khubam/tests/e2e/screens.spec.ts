import { expect, signedIn, test } from './fixtures'

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
})

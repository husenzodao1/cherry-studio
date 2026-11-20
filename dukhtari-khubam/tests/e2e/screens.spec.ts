import { expect, signedIn, test } from './fixtures'

test.describe('main screens of a signed-in learner', () => {
  for (const [path, sel] of [['/', '.motto'], ['/schools', '.poem-tile'], ['/profile', '.profile-head'], ['/settings', '.theme-box'], ['/garden', 'main'], ['/review', 'main'], ['/search', 'main'], ['/saved', 'main']] as const) {
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
})

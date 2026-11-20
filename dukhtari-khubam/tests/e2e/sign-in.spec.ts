import { expect, test } from './fixtures'

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

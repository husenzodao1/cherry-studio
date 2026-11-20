import { expect, signedIn, test } from './fixtures'

/** Touch events as a finger makes them (the pull is touch-only, like on a phone). */
async function touch(page: import('@playwright/test').Page, type: 'touchstart' | 'touchmove' | 'touchend', y: number) {
  await page.evaluate(([t, yy]) => {
    const target = document.querySelector('main.app') as HTMLElement
    const point = new Touch({ identifier: 1, target, clientX: 200, clientY: yy as number })
    const list = t === 'touchend' ? [] : [point]
    target.dispatchEvent(new TouchEvent(t as string, { touches: list, changedTouches: [point], bubbles: true, cancelable: true }))
  }, [type, y] as const)
}

test('pulling down at the top writes "Gratorslab", then hearts fly out and the space closes', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await page.goto('/profile')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.waitForTimeout(1500)
  // a short swipe opens nothing (the first stretch of finger travel is ignored)
  await touch(page, 'touchstart', 150)
  await touch(page, 'touchmove', 190)
  expect(await page.locator('.pull-sign').evaluate((el) => el.getBoundingClientRect().height)).toBe(0)
  await touch(page, 'touchend', 190)
  await page.waitForTimeout(600)
  // a long, held pull opens it fully
  await touch(page, 'touchstart', 150)
  for (let y = 170; y <= 900; y += 30) await touch(page, 'touchmove', y)
  await page.waitForTimeout(250)
  const open = await page.locator('.pull-sign').evaluate((el) => el.getBoundingClientRect().height)
  expect(open).toBeGreaterThan(70)
  await page.screenshot({ path: 'test-results/pull-1.png' })
  await touch(page, 'touchend', 900)
  await page.waitForTimeout(820)
  await page.screenshot({ path: 'test-results/pull-2.png' })
  await page.waitForTimeout(1200)
  await expect.poll(() => page.locator('main.app').evaluate((el) => el.style.transform)).toBe('')
  await expect.poll(() => page.locator('.pull-sign').evaluate((el) => el.getBoundingClientRect().height)).toBe(0)
  expect(errors).toEqual([])
})

test('the sign-in screen fits and stays perfectly still: no bounce up or down', async ({ page, server: _, errors }) => {
  await page.goto('/start')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('html')).toHaveClass(/\bfits\b/)
  for (const [from, to] of [[200, 900], [700, 100]]) {
    await touch(page, 'touchstart', from)
    for (let y = from; from < to ? y <= to : y >= to; y += from < to ? 40 : -40) await touch(page, 'touchmove', y)
    expect(await page.locator('main.app').evaluate((el) => el.style.transform)).toBe('')
    expect(await page.locator('.pull-sign').evaluate((el) => el.getBoundingClientRect().height)).toBe(0)
    await touch(page, 'touchend', to)
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  expect(errors).toEqual([])
})

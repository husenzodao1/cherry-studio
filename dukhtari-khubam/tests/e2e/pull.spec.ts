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
  // the word gathers, the hearts come out in a row …
  await page.waitForTimeout(950)
  await page.screenshot({ path: 'test-results/pull-2.png' })
  // … and then come forward: they grow over the page and stay visible before they fade
  const heart = page.locator('.ps-heart').nth(2)
  const look = () => heart.evaluate((el) => ({ scale: new DOMMatrix(getComputedStyle(el).transform).a, opacity: Number(getComputedStyle(el).opacity) }))
  await expect.poll(async () => { const h = await look(); return h.scale > 1.8 && h.opacity > 0.4 }, { intervals: [40], timeout: 2000 }).toBe(true)
  await page.screenshot({ path: 'test-results/pull-3.png' })
  await page.waitForTimeout(1200)
  await expect.poll(() => page.locator('main.app').evaluate((el) => el.style.transform)).toBe('')
  await expect.poll(() => page.locator('.pull-sign').evaluate((el) => el.getBoundingClientRect().height)).toBe(0)
  expect(errors).toEqual([])
})

test('a screen that fits never scrolls: a drag only stretches it like rubber and it springs back', async ({ page, server: _, errors }) => {
  await page.goto('/start')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('html')).toHaveClass(/\bfits\b/)
  const shift = () => page.locator('main.app').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42)
  for (const [from, to] of [[200, 900], [700, 100]]) {
    await touch(page, 'touchstart', from)
    for (let y = from; from < to ? y <= to : y >= to; y += from < to ? 40 : -40) await touch(page, 'touchmove', y)
    const d = await shift()
    // it follows the finger a little, never further than the rubber allows
    expect(Math.abs(d)).toBeGreaterThan(20)
    expect(Math.abs(d)).toBeLessThanOrEqual(64)
    expect(Math.sign(d)).toBe(Math.sign(to - from))
    // no signature space on the sign-in screen
    expect(await page.locator('.pull-sign').evaluate((el) => el.getBoundingClientRect().height)).toBe(0)
    await touch(page, 'touchend', to)
    await expect.poll(shift).toBe(0)
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  expect(errors).toEqual([])
})

test('the welcome questions fit every phone: top and button always in view, nothing scrolls', async ({ page, server: _, errors }) => {
  await signedIn(page)
  // a learner who has not answered them yet
  await page.addInitScript(() => { const p = JSON.parse(localStorage.getItem('dk.progress')!); delete p.about; localStorage.setItem('dk.progress', JSON.stringify(p)) })
  for (const [w, h] of [[411, 891], [360, 740]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/welcome')
    await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
    // Mahliyo's greeting first: it fits too
    await expect(page.locator('.mahliyo-intro')).toBeVisible()
    await page.locator('.mi-stage').click()
    await expect(page.getByRole('button', { name: /Бале/ })).toBeVisible()
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => document.querySelector('main.app')!.scrollHeight)).toBeLessThanOrEqual(h + 2)
    const yes = (await page.getByRole('button', { name: /Бале/ }).boundingBox())!
    expect(yes.y + yes.height).toBeLessThanOrEqual(h)
    expect((await page.locator('.mi-say').boundingBox())!.y).toBeGreaterThanOrEqual(0)
    await page.getByRole('button', { name: /Бале/ }).click()
    await page.locator('.wl-option').first().click()
    await page.locator('.wl-next').click()
    // the seven schools: the longest step
    await expect(page.locator('.wl-school')).toHaveCount(7)
    await page.waitForTimeout(800)
    await expect(page.locator('html')).toHaveClass(/\bfits\b/)
    expect(await page.evaluate(() => document.querySelector('main.app')!.scrollHeight)).toBeLessThanOrEqual(h + 2)
    expect((await page.locator('.wl-top').boundingBox())!.y).toBeGreaterThanOrEqual(0)
    const next = (await page.locator('.wl-school-next').boundingBox())!
    expect(next.y + next.height).toBeLessThanOrEqual(h)
  }
  expect(errors).toEqual([])
})

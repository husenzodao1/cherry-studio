import type { Page } from '@playwright/test'

import { expect, signedIn, test } from './fixtures'
import { asPhone } from './phone'

const log = (page: Page) => page.evaluate(() => (window as unknown as { __hey: { said: string[]; timers: number[]; calls: string[]; prints: number; started: boolean } }).__hey)
const hear = (page: Page, ...texts: string[]) => page.evaluate((t) => (window as unknown as { __hear: string[] }).__hear.push(...t), texts)

test('"Эй Маҳлиё" set up: the Tajik model, the microphone, three phrases in her voice (a badly heard one is asked again), then on', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await asPhone(page)
  await page.goto('/hey')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  // Tajik always (her name is heard by it), and another language chosen
  await expect(page.getByRole('checkbox', { name: /Тоҷикӣ/ })).toBeDisabled()
  await page.getByRole('checkbox', { name: /Русский/ }).click()
  await page.screenshot({ path: 'test-results/hey-langs.png' })
  await page.getByRole('button', { name: /Боргирӣ · 112 МБ/ }).click()
  await page.getByRole('button', { name: 'Иҷозат додан' }).click()
  await expect(page.locator('.hey-phrase')).toHaveText('«Эй Маҳлиё, имрӯз обу ҳаво чӣ гуна аст?»')
  // heard badly: asked again, the step stays
  await hear(page, 'салом салом')
  await page.getByRole('button', { name: 'Гап задан' }).click()
  await expect(page.locator('.hey-miss')).toBeVisible()
  await expect(page.locator('.hey-phrase')).toContainText('обу ҳаво')
  await hear(page, 'эй маҳлиё имрӯз обу ҳаво чӣ гуна аст')
  await page.getByRole('button', { name: 'Гап задан' }).click()
  await expect(page.locator('.hey-phrase')).toHaveText('«Эй Маҳлиё, соат чанд шуд?»')
  await page.screenshot({ path: 'test-results/hey-enrol.png' })
  await hear(page, 'эй маҳлиё соат чанд шуд')
  await page.getByRole('button', { name: 'Гап задан' }).click()
  await expect(page.locator('.hey-phrase')).toHaveText('«Эй Маҳлиё, маро ба хона бубар.»')
  await hear(page, 'эй маҳлиё маро ба хона бубар')
  await page.getByRole('button', { name: 'Гап задан' }).click()
  await expect(page.getByRole('switch', { name: '«Эй Маҳлиё» фаъол' })).toBeChecked()
  expect(await log(page)).toMatchObject({ prints: 3, started: true })
  await page.screenshot({ path: 'test-results/hey-on.png' })
  expect(errors).toEqual([])
})

test('"Эй Маҳлиё" listening: the time and a timer said, a contact called — each in the phone\'s voice', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await asPhone(page)
  await page.addInitScript(() => (window as unknown as { __hear: string[] }).__hear.push('эй маҳлиё соат чанд'))
  await page.goto('/voice')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.voice-said')).toHaveText('эй маҳлиё соат чанд')
  await expect.poll(async () => (await log(page)).said[0] ?? '').toMatch(/^Ҳоло соат \d{1,2}:\d{2}$/)
  await page.screenshot({ path: 'test-results/voice.png' })

  await hear(page, 'таймер бисту панҷ дақиқа')
  await page.getByRole('button', { name: 'Гап задан' }).click()
  await expect.poll(async () => (await log(page)).timers).toEqual([1500])
  await expect(page.locator('.voice-answer')).toHaveText('Таймер ба 25 дақ гузошта шуд.')

  // a contact by name, as said (an ending, Tajik letters against Russian ones)
  await hear(page, 'ба шаҳнозаро занг зан')
  await page.getByRole('button', { name: 'Гап задан' }).click()
  await expect.poll(async () => (await log(page)).calls).toEqual(['+992900000002'])
  expect((await log(page)).said).toContain('Ба Шахноза занг мезанам.')
  // a number said aloud
  await hear(page, 'ба нӯҳсаду ду бисту се чилу панҷ шасту ҳафт занг зан')
  await page.getByRole('button', { name: 'Гап задан' }).click()
  await expect.poll(async () => (await log(page)).calls).toEqual(['+992900000002', '902234567'])
  expect(errors).toEqual([])
})

test('"Эй Маҳлиё" online: the recording is heard again by the server\'s AI, in her language', async ({ page, server: _, errors }) => {
  await signedIn(page)
  await asPhone(page)
  const sent: { lang: string; wav: string }[] = []
  await page.route('**/api/v1/voice/hear', (r) => { sent.push(r.request().postDataJSON()); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'эй маҳлиё таймер даҳ дақиқа' }) }) })
  // the phone's small model heard it badly
  await page.addInitScript(() => (window as unknown as { __hear: string[] }).__hear.push('эй маҳлиё тайм даҳ дақ'))
  await page.goto('/voice')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await expect.poll(async () => (await log(page)).timers).toEqual([600])
  await expect(page.locator('.voice-said')).toHaveText('эй маҳлиё таймер даҳ дақиқа')
  expect(sent[0]).toMatchObject({ lang: 'tg' })
  expect(errors).toEqual([])
})

import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
/** a quarter second of silence as a WAV */
function silence(): string {
  const pcm = Buffer.alloc(12_000)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(24_000, 24); h.writeUInt32LE(48_000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm]).toString('base64')
}

test('a podcast from a lecture: the script in two voices, played part by part, kept to listen again', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const voiced: number[] = []
  let asked: Record<string, unknown> | null = null
  const parts = [
    { lines: [{ who: 'A', text: 'Салом! Имрӯз дар бораи фотосинтез.' }, { who: 'B', text: 'Ин чист?' }], exp: Date.now() + 3600_000, sig: 'a'.repeat(64) },
    { lines: [{ who: 'A', text: 'Растанӣ аз нур ғизо месозад.' }, { who: 'B', text: 'Пас се нуқта: нур, об, гази карбонат.' }], exp: Date.now() + 3600_000, sig: 'b'.repeat(64) }
  ]
  await page.route('**/api/v1/study/podcast', (r) => { asked = r.request().postDataJSON() as Record<string, unknown>; return r.fulfill(json({ title: 'Фотосинтез', parts })) })
  await page.route('**/api/v1/study/podcast/voice', (r) => {
    voiced.push(parts.findIndex((p) => p.sig === (r.request().postDataJSON() as { part: { sig: string } }).part.sig))
    return r.fulfill(json({ wav: silence() }))
  })
  await page.goto('/schools')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.locator('.tool-tile[href="/podcast"]').click()
  await page.getByLabel('Матн', { exact: true }).fill('Фотосинтез — раванде, ки дар он растаниҳо бо ёрии нури офтоб аз об ва гази карбонат моддаҳои органикӣ месозанд ва оксиген хориҷ мекунанд.')
  await page.getByRole('button', { name: '3 дақ' }).click()
  await page.getByRole('button', { name: '🎙️ Сохтани подкаст' }).click()
  expect(asked).toMatchObject({ lang: 'tg', minutes: 3 })

  // the first part voiced, the next one asked for while it plays
  await expect(page.locator('.pod-line')).toHaveCount(4)
  await expect.poll(() => voiced.sort()).toEqual([0, 1])
  await page.screenshot({ path: 'test-results/podcast.png' })
  // part after part, to the end
  await expect(page.getByText('Тамом шуд')).toBeVisible({ timeout: 10_000 })

  // kept on the phone: listened to again without asking the server
  await page.reload()
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.getByRole('button', { name: /Фотосинтез/ }).click()
  await expect(page.getByRole('button', { name: 'Пахш' }).or(page.getByRole('button', { name: 'Таваққуф' }))).toBeEnabled()
  expect(voiced).toHaveLength(2)
  expect(errors).toEqual([])
})

import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

test('flashcards: the AI makes a deck from a text, she reviews it with FSRS, the deck is backed up by her code', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const puts: Record<string, unknown>[] = []
  let made: Record<string, unknown> | null = null
  await page.route('**/rest/v1/rpc/api_decks**', (r) => r.fulfill(json([])))
  await page.route('**/rest/v1/rpc/api_deck_put**', (r) => { puts.push(r.request().postDataJSON() as Record<string, unknown>); return r.fulfill(json({ kept: true })) })
  await page.route('**/api/v1/study/cards', (r) => {
    made = r.request().postDataJSON() as Record<string, unknown>
    return r.fulfill(json({ cards: [{ front: 'H₂O чист?', back: 'Об' }, { front: 'NaCl', back: 'Намаки ош' }, { front: 'h₂o чист?', back: 'такрор' }] }))
  })
  await page.goto('/schools')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  await page.screenshot({ path: 'test-results/schools-tools.png' })
  await page.locator('.tool-tile[href="/cards"]').click()
  await expect(page.getByText('Имрӯз корт нест — офарин!')).toBeVisible()
  await page.getByRole('button', { name: 'Кортҳои нав бо AI' }).click()
  await page.getByLabel('Номи маҷмӯа (ихтиёрӣ)').fill('Химия')
  await page.getByLabel('Матн', { exact: true }).fill('Об (H₂O) — моеъ аст. Намаки ош (NaCl) — модда аст, ки дар хӯрок истифода мешавад.')
  await page.getByRole('button', { name: '10 корт' }).click()
  await page.getByRole('button', { name: '✨ Сохтани кортҳо' }).click()
  expect(made).toMatchObject({ lang: 'tg', count: 10 })

  // the deck: two cards (the repeated one left out), both new
  await expect(page.locator('.cards-row')).toHaveCount(2)
  await expect(page.locator('.cards-stats')).toContainText('2нав')
  await page.getByRole('button', { name: 'Такрор' }).click()
  await expect(page.locator('.flashcard-front')).toHaveText('H₂O чист?')
  await page.locator('.flashcard').click()
  await expect(page.locator('.flashcard-back')).toHaveText('Об')
  // each answer says when the card returns: "Again" now, the others later and later
  await expect(page.locator('.flashcard-btn.is-1')).toContainText('ҳозир')
  await expect(page.locator('.flashcard-btn.is-3')).toContainText(/\d+ рӯз/)
  await page.screenshot({ path: 'test-results/cards-study.png' })
  await page.locator('.flashcard-btn.is-3').click()
  await expect(page.locator('.flashcard-front')).toHaveText('NaCl')
  await page.locator('.flashcard').click()
  await page.locator('.flashcard-btn.is-1').click()
  // forgotten: once more today
  await expect(page.locator('.flashcard-front')).toHaveText('NaCl')
  await page.locator('.flashcard').click()
  await page.locator('.flashcard-btn.is-3').click()
  await expect(page.getByText('Тайёр! 3 ҷавоб')).toBeVisible()

  // backed up by her code, the memory states with it
  type Put = { p_code: string; p_title: string; p_cards: { f: string; st?: { due: string } }[] }
  // sent a moment after the last answer
  await expect.poll(() => (puts.at(-1) as Put | undefined)?.p_cards.every((c) => c.st) ?? false, { timeout: 8000 }).toBe(true)
  const last = puts.at(-1) as Put
  expect(last.p_code).toBe('512345678901234')
  expect(last.p_title).toBe('Химия')
  expect(errors).toEqual([])
})

/**
 * The plans' screen's pictures (public/assets/paywall/<locale>): the app at work in each of its languages, shot
 * from the app itself with Mahliyo's answers played back. Run only on purpose: SHOTS=1 npx playwright test paywall-shots
 */
import { mkdirSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { LOCALES, type Locale } from '../../src/web/i18n'
import { signedIn, test } from './fixtures'
import { SHOT_TEXT } from './paywall-shots.content'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const OUT = process.env.SHOTS_OUT ?? 'test-results/paywall'

test.skip(!process.env.SHOTS, 'pictures for the plans screen: SHOTS=1')

/** the app in this language */
const inLocale = (page: Page, locale: Locale) =>
  page.addInitScript((l) => localStorage.setItem('dk.prefs', JSON.stringify({ locale: l, mode: 'girl', theme: 'peach' })), locale)

async function answered(page: Page, locale: Locale, question: string, blocks: unknown[]) {
  await inLocale(page, locale)
  let n = 0
  await page.route('**/api/v1/mahliyo/status', (r) => r.fulfill(json({ ready: true })))
  await page.route('**/api/v1/mahliyo/ask', (r) => r.fulfill(json({ id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` })))
  const done = json({ status: 'done', tajik: true, reply: '', blocks })
  await page.route('**/api/v1/mahliyo/answer', (r) => r.fulfill(done))
  await page.route('**/rest/v1/rpc/api_mahliyo_result', (r) => r.fulfill(done))
  await page.goto('/mahliyo')
  await page.locator('#splash').waitFor({ state: 'hidden', timeout: 15_000 })
  const box = page.locator('textarea.ai-input')
  await box.fill(question)
  await box.press('Enter')
  await page.locator('.ai-said').first().waitFor({ timeout: 15_000 })
  // her words come in one after another: until all are there
  await page.waitForTimeout(5000)
}
const shot = async (page: Page, locale: Locale, name: string) => {
  mkdirSync(`${OUT}/${locale}`, { recursive: true })
  await page.screenshot({ path: `${OUT}/${locale}/${name}.png` })
}

test.use({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 2 })

for (const locale of LOCALES) {
  const x = SHOT_TEXT[locale]
  test.describe(locale, () => {
    test('chat', async ({ page }) => {
      await signedIn(page)
      await answered(page, locale, x.chat.q, [
        { type: 'text', text: x.chat.text },
        { type: 'steps', title: x.chat.stepsTitle, items: x.chat.steps },
        { type: 'callout', tone: 'tip', title: x.chat.tipTitle, text: x.chat.tip }
      ])
      await shot(page, locale, 'chat')
    })

    test('slides', async ({ page }) => {
      await signedIn(page)
      const s = x.slides
      await answered(page, locale, s.q, [
        { type: 'text', text: s.text },
        { type: 'file', name: `${s.name}.pptx`, title: s.title, about: s.about, style: 's07', content: s.md },
        { type: 'file', name: `${s.name}.pdf`, title: s.title, about: s.pdfAbout, content: s.pdf }
      ])
      await shot(page, locale, 'slides')
    })

    test('song', async ({ page }) => {
      await signedIn(page)
      await page.route('**/api/v1/mahliyo/music', () => undefined)
      await answered(page, locale, x.song.q, [
        { type: 'text', text: x.song.text },
        { type: 'music', title: x.song.title, genre: 'Pop ballad', prompt: 'Warm patriotic ballad, 92 BPM, rubob, doira, piano and strings, female voice', instrumental: false, lyrics: x.song.lyrics }
      ])
      await shot(page, locale, 'song')
    })

    test('quiz', async ({ page }) => {
      await signedIn(page)
      const q = x.quiz
      await answered(page, locale, q.q, [
        { type: 'quiz', title: q.title, intro: q.intro, comment: '', task: '', questions: [
          { question: '½ + ¼ = ?', options: ['¾', '⅔', '2/6'], answer: 0, explanation: q.e1 },
          { question: q.q2, options: ['1/5', '1/4', '1/2'], answer: 1, explanation: q.e2 },
          { question: q.q3, options: ['10', '12', '15'], answer: 1, explanation: q.e3 }
        ] }
      ])
      await shot(page, locale, 'quiz')
    })

    test('lawyer', async ({ page }) => {
      await signedIn(page)
      const l = x.lawyer
      await answered(page, locale, l.q, [
        { type: 'text', text: l.text },
        { type: 'steps', title: l.stepsTitle, items: l.steps },
        { type: 'callout', tone: 'warning', title: l.warnTitle, text: l.warn },
        { type: 'text', text: l.summary }
      ])
      await shot(page, locale, 'lawyer')
    })

    test('mmt', async ({ page }) => {
      await signedIn(page)
      const m = x.mmt
      const badges = ['92%', '81%', '74%'], tones = ['best', 'good', 'good']
      await answered(page, locale, m.q, [
        { type: 'text', text: m.text },
        { type: 'choices', title: m.title, intro: '', items: m.items.map(([name, points], i) => ({ name, badge: badges[i], tone: tones[i], points, note: '' })) },
        { type: 'callout', tone: 'tip', title: m.tipTitle, text: m.tip }
      ])
      await shot(page, locale, 'mmt')
    })

    test('call', async ({ page }) => {
      await signedIn(page)
      await inLocale(page, locale)
      await page.addInitScript((c) => {
        localStorage.setItem('dk.ai-calls', JSON.stringify([{ id: 301, at: new Date(Date.now() - 1000).toISOString(), title: c.title, text: c.text }]))
      }, x.call)
      await page.goto('/')
      await page.locator('#splash').waitFor({ state: 'hidden', timeout: 15_000 })
      await page.waitForTimeout(3500)
      await shot(page, locale, 'call')
    })
  })
}

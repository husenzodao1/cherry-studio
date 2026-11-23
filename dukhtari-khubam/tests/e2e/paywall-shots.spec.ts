/**
 * The plans' screen's pictures (public/assets/paywall): the app at work, shot from the app itself with
 * Mahliyo's answers played back. Run only on purpose: SHOTS=1 npx playwright test paywall-shots
 */
import { mkdirSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const OUT = process.env.SHOTS_OUT ?? 'test-results/paywall'

test.skip(!process.env.SHOTS, 'pictures for the plans screen: SHOTS=1')

async function answered(page: Page, question: string, blocks: unknown[]) {
  await tajik(page)
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
/** the app in Tajik */
const tajik = (page: Page) => page.addInitScript(() => localStorage.setItem('dk.prefs', JSON.stringify({ locale: 'tg', mode: 'girl', theme: 'peach' })))
const shot = async (page: Page, name: string) => {
  mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

test.use({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 2 })

test('chat', async ({ page }) => {
  await signedIn(page)
  await answered(page, 'Чаро осмон кабуд аст?', [
    { type: 'text', text: 'Осмон кабуд менамояд, зеро нури офтоб дар атмосфера **пароканда** мешавад — ин ҳодисаро **пароканиши Рэлей** меноманд. 🌍☀️' },
    { type: 'steps', title: 'Чӣ рӯй медиҳад', items: ['Нури сафед аз ҳамаи рангҳо иборат аст', 'Молекулаҳои ҳаво мавҷҳои кӯтоҳро (кабуд) бештар мепароканад', 'Ин нури кабуд аз ҳар тараф ба чашми мо мерасад'] },
    { type: 'callout', tone: 'tip', title: 'Ҷолиб', text: 'Ғуруби офтоб сурх аст, чунки нур роҳи дарозтарро тай мекунад ва кабуд пароканда мешавад.' }
  ])
  await shot(page, 'chat')
})

test('slides', async ({ page }) => {
  await signedIn(page)
  await answered(page, 'Дар бораи Рӯдакӣ слайдҳо ва PDF лозим', [
    { type: 'text', text: 'Тайёр! Презентатсияи 8 слайдӣ бо услуби «Шоҳона» 👑' },
    { type: 'file', name: 'Рӯдакӣ.pptx', title: 'Абӯабдуллоҳи Рӯдакӣ', about: '8 слайд: ҳаёт, ашъор, мерос ва хулоса', style: 's07', content: '# Абӯабдуллоҳи Рӯдакӣ\n## Падари шеъри форсу тоҷик\n---\n# Ҳаёт\n- Таваллуд дар Панҷрӯд\n- Шоири дарбори Сомониён' },
    { type: 'file', name: 'Рӯдакӣ.pdf', title: 'Абӯабдуллоҳи Рӯдакӣ', about: 'ҳамон матн барои чоп', content: '# Абӯабдуллоҳи Рӯдакӣ\n\nРӯдакӣ — падари шеъри форсу тоҷик.' }
  ])
  await shot(page, 'slides')
})

test('song', async ({ page }) => {
  await signedIn(page)
  await page.route('**/api/v1/mahliyo/music', () => undefined)
  await answered(page, 'Суруд дар бораи Ватан бисоз', [
    { type: 'text', text: 'Суруди шумо омода мешавад 🎶' },
    { type: 'music', title: 'Ватани ман', genre: 'Tajik pop', prompt: 'Warm patriotic ballad, 92 BPM, rubob, doira, piano and strings, female voice', instrumental: false,
      lyrics: '[Verse 1]\nКӯҳсорони ту баланд, дарёҳоят зулол,\nЗери осмони ту ман ёфтам хаёл.\n[Chorus]\nВатан, эй Ватан, дили ман аз туст,\nҲар субҳу шомам бо номи ту хуш.' }
  ])
  await shot(page, 'song')
})

test('quiz', async ({ page }) => {
  await signedIn(page)
  await answered(page, 'Маро аз математика санҷед', [
    { type: 'quiz', title: 'Санҷиши хурд: касрҳо', intro: 'Се савол — биёед бубинем!', comment: '', task: '', questions: [
      { question: '½ + ¼ = ?', options: ['¾', '⅔', '2/6'], answer: 0, explanation: '½ = 2/4, пас 2/4 + 1/4 = 3/4.' },
      { question: '0,25 ба кадом каср баробар аст?', options: ['1/5', '1/4', '1/2'], answer: 1, explanation: '25/100 = 1/4.' },
      { question: '3/5 аз 20 чанд аст?', options: ['10', '12', '15'], answer: 1, explanation: '20 : 5 × 3 = 12.' }
    ] }
  ])
  await shot(page, 'quiz')
})

test('lawyer', async ({ page }) => {
  await signedIn(page)
  await answered(page, 'Агар корфармо маошро 2 моҳ надиҳад, чӣ кор кунам?', [
    { type: 'text', text: 'Мувофиқи **Кодекси меҳнати Ҷумҳурии Тоҷикистон**, корфармо вазифадор аст музди меҳнатро на камтар аз ду маротиба дар як моҳ пардохт кунад.' },
    { type: 'steps', title: 'Чӣ бояд кард', items: ['Ба корфармо аризаи хаттӣ диҳед (нусхаашро нигоҳ доред)', 'Ба Нозироти давлатии меҳнат шикоят кунед', 'Дар муддати муқарраршуда ба суд муроҷиат намоед'] },
    { type: 'callout', tone: 'warning', title: 'Мӯҳлатҳоро гум накунед', text: 'Барои баҳсҳои меҳнатӣ мӯҳлатҳои муайян ҳаст — бо ҳуқуқшинос маслиҳат кунед.' },
    { type: 'text', text: '**Хулоса:** ҳуқуқи шумо ҳимоя шудааст — қарзро бо фоизаш талаб кунед.' }
  ])
  await shot(page, 'lawyer')
})

test('mmt', async ({ page }) => {
  await signedIn(page)
  await answered(page, 'Барои ММТ аз химия маро омода кун', [
    { type: 'text', text: 'Аз рӯи маводи расмӣ ва саволҳои 10 соли охир, ин мавзӯъҳо **бештар** меоянд 🎯' },
    { type: 'choices', title: 'Мавзӯъҳои эҳтимолӣ', intro: '', items: [
      { name: 'Ҷадвали даврии элементҳо', badge: '92%', tone: 'best', points: ['Валентнокӣ', 'Хосиятҳои гурӯҳҳо'], note: '' },
      { name: 'Реаксияҳои оксидшавӣ', badge: '81%', tone: 'good', points: ['Коэффитсиентҳо', 'Электронҳо'], note: '' },
      { name: 'Маҳлулҳо ва консентратсия', badge: '74%', tone: 'good', points: ['Ҳиссаи массавӣ'], note: '' }
    ] },
    { type: 'callout', tone: 'tip', title: 'Нақша', text: 'Курси 45-рӯза то 400 хол — ҳар рӯз 40 дақиқа.' }
  ])
  await shot(page, 'mmt')
})

test('call', async ({ page }) => {
  await signedIn(page)
  await tajik(page)
  await page.addInitScript(() => {
    localStorage.setItem('dk.ai-calls', JSON.stringify([{ id: 301, at: new Date(Date.now() - 1000).toISOString(), title: 'Занги Маҳлиё', text: 'Вақти дарс расид! 📚' }]))
  })
  await page.goto('/')
  await page.locator('#splash').waitFor({ state: 'hidden', timeout: 15_000 })
  await page.waitForTimeout(3500)
  await shot(page, 'call')
})

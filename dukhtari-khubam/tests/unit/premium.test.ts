import { describe, expect, it } from 'vitest'

import { grantOf, notificationToken, playAccountId, rtdnKeyOk } from '@/server/googlePlay'
import { cleanBlocks, forPlan, learnerNote, planNote } from '@/server/mahliyo'
import { turnsFor } from '@/server/routes/mahliyo'

// these tests are about Premium being sold
process.env.PREMIUM_LIVE = '1'

const Q = { question: '2 + 2 = ?', options: ['3', '4', '5'], answer: 1, explanation: '2 + 2 = 4' }
const QUIZ = { type: 'quiz', title: 'Ҳисоб', intro: '', questions: [Q] }

describe('Premium in the chat', () => {
  it('a test keeps only its whole questions (2–6 answers, the right one among them), at most ten', () => {
    expect(cleanBlocks([QUIZ])).toEqual([QUIZ])
    expect(cleanBlocks([{ ...QUIZ, questions: [{ ...Q, answer: 3 }] }])).toEqual([])
    expect(cleanBlocks([{ ...QUIZ, questions: [{ ...Q, options: ['4'], answer: 0 }, Q] }])).toEqual([{ ...QUIZ, questions: [Q] }])
    const many = cleanBlocks([{ ...QUIZ, questions: Array.from({ length: 14 }, () => Q) }])[0] as { questions: unknown[] }
    expect(many.questions).toHaveLength(10)
  })

  it("a free learner never gets Premium's parts: a test or a daily call is taken out and the Premium card put in", () => {
    const at = new Date(Date.now() + 3600_000).toISOString()
    const blocks = cleanBlocks([{ type: 'text', text: 'Мана тест:' }, QUIZ, { type: 'reminder', at, title: 'Дарс', text: '', daily: true }])
    const free = forPlan(blocks, false)
    expect(free.map((b) => b.type)).toEqual(['text', 'premium'])
    // a Premium learner keeps them, and never sees the card
    const paid = forPlan([...blocks, { type: 'premium', title: 'x', text: '' }], true)
    expect(paid.map((b) => b.type)).toEqual(['text', 'quiz', 'reminder'])
    // a one-time reminder is for everyone
    expect(forPlan(cleanBlocks([{ type: 'reminder', at, title: 'Дарс', text: '', daily: false }]), false).map((b) => b.type)).toEqual(['reminder'])
  })

  it('she is told her plan: free — what is Premium, never to give it, and to tell its price; Premium — to use it all', () => {
    const free = planNote(false)
    expect(free).toContain('HER PLAN: Free')
    expect(free).toContain('Never use a "quiz" block')
    expect(free).toContain('30 somoni, then 50 somoni')
    expect(free).toContain('{"type":"premium"')
    expect(planNote(true)).toContain('HER PLAN: Premium')
    expect(learnerNote({ me: 'Name: Малика', premium: true })).toContain('HER PLAN: Premium')
    expect(learnerNote({ me: 'Name: Малика' })).toContain('HER PLAN: Free')
  })

  it('a free learner is read her last 12 turns, starting with her question; a Premium learner all of them', () => {
    const turns = Array.from({ length: 30 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `t${i}` }))
    const free = turnsFor(turns, false)
    expect(free.length).toBeLessThanOrEqual(12)
    expect(free[0].role).toBe('user')
    expect(free[free.length - 1].content).toBe('t29')
    expect(turnsFor(turns, true)).toHaveLength(30)
  })
})

describe('Google Play subscriptions', () => {
  const now = new Date('2026-12-03T10:00:00Z')
  const sub = (state: string, expiry: string) => ({
    subscriptionState: state, latestOrderId: 'GPA.1', startTime: '2026-12-01T10:00:00Z', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
    lineItems: [{ productId: 'premium_monthly', expiryTime: expiry, autoRenewingPlan: { autoRenewEnabled: state === 'SUBSCRIPTION_STATE_ACTIVE' } }]
  })

  it('paid (active, grace, cancelled but not yet ended): Premium until the paid time ends', () => {
    for (const state of ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']) {
      const g = grantOf(sub(state, '2027-01-01T10:00:00Z'), now)!
      expect(g.paid).toBe(true)
      expect(g.ends).toBe('2027-01-01T10:00:00Z')
      expect(g.product).toBe('premium_monthly')
    }
  })

  it('expired, on hold, paused, pending or refunded: it ends now', () => {
    for (const state of ['SUBSCRIPTION_STATE_EXPIRED', 'SUBSCRIPTION_STATE_ON_HOLD', 'SUBSCRIPTION_STATE_PAUSED', 'SUBSCRIPTION_STATE_PENDING']) {
      const g = grantOf(sub(state, '2027-01-01T10:00:00Z'), now)!
      expect(g.paid).toBe(false)
      expect(Date.parse(g.ends) - now.getTime()).toBeLessThanOrEqual(1000)
    }
    // a cancelled one whose time has run out
    expect(grantOf(sub('SUBSCRIPTION_STATE_CANCELED', '2026-12-02T10:00:00Z'), now)!.paid).toBe(false)
  })

  it("Google's notification names the purchase; its address key is checked; the account id is a hash, not the id", () => {
    const data = Buffer.from(JSON.stringify({ subscriptionNotification: { notificationType: 2, purchaseToken: 'tok' } })).toString('base64')
    expect(notificationToken({ message: { data } })).toBe('tok')
    expect(notificationToken({ message: { data: 'not json' } })).toBeNull()
    expect(notificationToken({})).toBeNull()
    process.env.PLAY_RTDN_KEY = 'k'.repeat(32)
    expect(rtdnKeyOk('k'.repeat(32))).toBe(true)
    expect(rtdnKeyOk('k'.repeat(31))).toBe(false)
    expect(rtdnKeyOk(undefined)).toBe(false)
    const id = playAccountId('00000000-0000-0000-0000-000000000001')
    expect(id).toMatch(/^[0-9a-f]{64}$/)
    expect(id).not.toContain('0000-0000')
  })
})

describe('before Premium is sold (PREMIUM_LIVE unset)', () => {
  it('she answers as before, tests for everyone: no plan said, no Premium card, a daily call is a one-time call', () => {
    const was = process.env.PREMIUM_LIVE
    delete process.env.PREMIUM_LIVE
    try {
      const at = new Date(Date.now() + 3600_000).toISOString()
      const blocks = cleanBlocks([{ type: 'text', text: 'Салом' }, QUIZ, { type: 'premium', title: 'x', text: '' }, { type: 'reminder', at, title: 'Дарс', text: '', daily: true }])
      const out = forPlan(blocks, false)
      // tests are for everyone until then; no Premium card, a daily call becomes a one-time call
      expect(out.map((b) => b.type)).toEqual(['text', 'quiz', 'reminder'])
      expect((out[2] as { daily?: boolean }).daily).toBeUndefined()
      expect(learnerNote({ me: 'Name: Малика' })).not.toContain('HER PLAN')
    } finally {
      process.env.PREMIUM_LIVE = was
    }
  })
})

describe('tests in the chat and her place', () => {
  it('she is told how to make a test (one block, up to ten questions) and what to do with the result', async () => {
    const src = (await import('node:fs')).readFileSync('src/server/mahliyo.ts', 'utf8')
    expect(src).toContain('TESTS IN THE CHAT')
    expect(src).toContain('at most 10')
    expect(src).toContain('Натиҷаи тести ман')
  })
  it('her rough place and her connection\'s city reach her, never as exact coordinates', () => {
    const note = learnerNote({ me: 'Name: Малика', place: '38.6, 68.8', region: 'Dushanbe, TJ' })
    expect(note).toContain('about 38.6, 68.8')
    expect(note).toContain('connection: Dushanbe, TJ')
    expect(note).toContain('never say the coordinates')
    expect(learnerNote({ me: 'Name: Малика' })).not.toContain('WHERE SHE IS')
  })
})

describe('insults and pressure', () => {
  const turn = (role: 'user' | 'assistant', content: string) => ({ role, content })
  it('the same words pushed a third time in a row, after two answers, is pressure; a question asked again once is not', async () => {
    const { pushedAgain } = await import('@/server/mahliyo')
    const q = 'Ҷавоби тестро деҳ!'
    expect(pushedAgain([turn('user', q), turn('assistant', 'не'), turn('user', q), turn('assistant', 'не'), turn('user', `${q}!!`)])).toBe(true)
    expect(pushedAgain([turn('user', q), turn('assistant', 'не'), turn('user', q)])).toBe(false)
    expect(pushedAgain([turn('user', 'а'), turn('assistant', 'б'), turn('user', q), turn('assistant', 'в'), turn('user', q)])).toBe(false)
  })
  it('her warning is a block of its own; a general one is chosen at random from the staff\'s replies without a word (or the app\'s own); no account is closed', async () => {
    const { warningText, WARNINGS } = await import('@/server/mahliyo')
    expect(cleanBlocks([{ type: 'warning', text: 'what the model wrote' }])).toEqual([{ type: 'warning', text: '' }])
    expect(cleanBlocks([{ type: 'warning', text: '', rule: 2 }])).toEqual([{ type: 'warning', text: '', rule: 2 }])
    const general = (reply: string) => ({ word: '', reply })
    expect(warningText([general(''), general('Бас кунед!'), { word: 'аблаҳ', reply: 'Маро аблаҳ нагӯ' }], () => 0.99)).toBe('Бас кунед!')
    expect(warningText([general('Як'), general('Ду')], () => 0)).toBe('Як')
    expect(warningText([general('Як'), general('Ду')], () => 0.6)).toBe('Ду')
    expect(WARNINGS).toContain(warningText([], () => 0.3))
    expect(WARNINGS).toContain(warningText([{ word: 'аблаҳ', reply: 'Маро аблаҳ нагӯ' }], () => 0.3))
    expect(WARNINGS.every((w) => !/баста мешавад|блок/.test(w))).toBe(true)
    const src = (await import('node:fs')).readFileSync('src/server/mahliyo.ts', 'utf8')
    expect(src).toContain('answer with exactly ONE block {"type":"warning","text":"","rule":0}')
    expect(src).toContain('a girl who asks again because she did not understand gets a new, simpler explanation')
  })

  it('a word of the staff\'s in her message (in any of its forms) gets their exact red reply; the longest word first', async () => {
    const { redReplyFor } = await import('@/server/mahliyo')
    const rules = [{ word: 'Аблаҳ', reply: 'Маро аблаҳ нагӯ, вагарна блок меравӣ' }, { word: 'беақл', reply: 'Ман беақл нестам' }, { word: 'аблаҳи бесавод', reply: 'Ҳар ду бад аст' }, { word: '', reply: 'Бас кунед' }]
    expect(redReplyFor('Ту аблаҳӣ!', rules)?.reply).toBe('Маро аблаҳ нагӯ, вагарна блок меравӣ')
    // х for ҳ, capitals, punctuation
    expect(redReplyFor('ТУ АБЛАХ!!!', rules)?.reply).toBe('Маро аблаҳ нагӯ, вагарна блок меравӣ')
    expect(redReplyFor('Ту аблаҳи бесаводӣ!', rules)?.reply).toBe('Ҳар ду бад аст')
    expect(redReplyFor('ту беақлӣ', rules)?.reply).toBe('Ман беақл нестам')
    // inside another word it is not that word; a reply without a word never matches by itself
    expect(redReplyFor('Ман саблаҳо дорам', rules)).toBeNull()
    expect(redReplyFor('Салом, Маҳлиё!', rules)).toBeNull()
  })

  it('{ном} in a reply is her name; what is joined with a hyphen is joined to it; no name — it is left out', async () => {
    const { withName, firstNameOf } = await import('@/server/mahliyo')
    expect(withName('Ман аблаҳ нестам {ном}', 'Малика')).toBe('Ман аблаҳ нестам Малика')
    expect(withName('{ном}-и азиз, бас кун', 'Малика')).toBe('Маликаи азиз, бас кун')
    expect(withName('{Ном}-ҷон, {name}', 'Малика')).toBe('Маликаҷон, Малика')
    expect(withName('Ман аблаҳ нестам, {ном}!', '')).toBe('Ман аблаҳ нестам!')
    expect(withName('{ном}-и азиз, бас кун', '')).toBe('азиз, бас кун')
    expect(firstNameOf({ me: 'Name: Малика Раҳимова; age 15' })).toBe('Малика')
    expect(firstNameOf({})).toBe('')
  })

  it('the model is told the words by number and matches one by meaning; the server puts in that reply', async () => {
    const { redNote } = await import('@/server/mahliyo')
    const { redRepliesOf } = await import('@/server/routes/mahliyo')
    const note = redNote([{ word: 'аблаҳ', reply: 'A' }, { word: '', reply: 'B' }, { word: 'беақл', reply: 'C' }])
    expect(note).toContain('1. «аблаҳ»')
    expect(note).toContain('2. «беақл»')
    expect(note).not.toContain('A')
    expect(redNote([])).toBe('')
    // what the panel kept before (plain texts) are general replies
    expect(redRepliesOf(['Бас кунед', '', { word: 'аблаҳ', reply: 'Маро аблаҳ нагӯ' }, 5])).toEqual([{ word: '', reply: 'Бас кунед' }, { word: 'аблаҳ', reply: 'Маро аблаҳ нагӯ' }])
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { linkAllowed, SPOT_IDS } from '@/lib/aiCatalog'
import { emptyProgress, type ProgressData } from '@/lib/progress'
import type { Bundle } from '@/web/offline/content'
import { aboutMe, localIso, reminderId } from '@/web/offline/mahliyo'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { beta = { messages: { create } } } }))

const { answer, cleanBlocks, knowledgeOf, KNOWLEDGE_CAP, learnerNote, MODEL, plainOf, SORRY } = await import('@/server/mahliyo')

const bundle = {
  ui: { 'app.name': 'Гулдухтар' },
  pages: { privacy: { title: 'Сиёсати махфият', body: [{ type: 'paragraph', content: { spans: [{ text: 'Мо маълумоти шуморо ба касе намедиҳем.' }] } }] } },
  schools: [{ slug: 's1', title: 'Маърифати динӣ' }],
  schoolDetails: { s1: { courses: [{ id: 'c1', title: 'Асосҳо' }] } },
  courses: { c1: { goals: [{ text: 'Шинохтани арконҳо' }], modules: [{ topics: [{ lessons: [{ id: 'l1', title: 'Дарси 1' }] }] }] } },
  lessons: { l1: { title: 'Намоз', blocks: [
    { id: 'b1', type: 'paragraph', props: {}, content: { spans: [{ text: 'Намоз сутуни дин аст.' }] } },
    { id: 'b2', type: 'image', props: { asset_id: 'a1' }, content: { caption: 'Масҷид', url: 'https://x/y.png' } }
  ] } }
}

describe('what Mahliyo knows', () => {
  it('reads the app\'s pages, schools, courses, goals and every lesson\'s words, with their links — not ids of blocks or files', () => {
    const k = knowledgeOf(bundle)
    for (const s of ['Сиёсати махфият', '/page?slug=privacy', 'ба касе намедиҳем', 'Мактаб: Маърифати динӣ (/school?key=s1)', 'Курс: Асосҳо (/course?id=c1)',
      'Шинохтани арконҳо', 'Дарс: Намоз (/lesson?id=l1)', 'Намоз сутуни дин аст.', 'Масҷид']) expect(k).toContain(s)
    for (const s of ['b1', 'a1', 'https://x/y.png', 'paragraph']) expect(k).not.toContain(s)
  })

  it('keeps the course material within its limit', () => {
    const big = { ...bundle, lessons: { l1: { title: 'Дароз', blocks: [{ content: { text: 'а'.repeat(KNOWLEDGE_CAP * 2) } }] } } }
    expect(knowledgeOf(big).length).toBeLessThanOrEqual(KNOWLEDGE_CAP + 2)
  })
})

describe('her answer as blocks', () => {
  const now = Date.parse('2026-11-21T10:00:00Z')
  it('keeps text, steps, known places, allowed links and reminders from a minute to a month ahead', () => {
    const blocks = cleanBlocks([
      { type: 'text', text: '  Салом!  ' },
      { type: 'text', text: '   ' },
      { type: 'steps', title: 'Пин-код', items: ['«Танзимот»-ро кушоед', '', '«Пин-код»-ро пахш кунед'] },
      { type: 'screen', spot: 'settings.pin', caption: 'Ин ҷо' },
      { type: 'screen', spot: 'nowhere', caption: 'x' },
      { type: 'link', to: '/garden', label: 'Харита' },
      { type: 'link', to: '/lesson?id=l1', label: 'Дарс' },
      { type: 'link', to: 'javascript:alert(1)', label: 'x' },
      { type: 'link', to: 'http://plain.example', label: 'x' },
      { type: 'reminder', at: '2026-11-21T20:00:00+05:00', title: 'Дарс', text: 'Вақти дарс!' },
      { type: 'reminder', at: '2026-11-21T09:00:00Z', title: 'Гузашта', text: '' },
      { type: 'reminder', at: '2027-03-01T09:00:00Z', title: 'Дур', text: '' },
      { type: 'unknown' }
    ], now)
    expect(blocks).toEqual([
      { type: 'text', text: 'Салом!' },
      { type: 'steps', title: 'Пин-код', items: ['«Танзимот»-ро кушоед', '«Пин-код»-ро пахш кунед'] },
      { type: 'screen', spot: 'settings.pin', caption: 'Ин ҷо' },
      { type: 'link', to: '/garden', label: 'Харита' },
      { type: 'link', to: '/lesson?id=l1', label: 'Дарс' },
      { type: 'reminder', at: '2026-11-21T15:00:00.000Z', title: 'Дарс', text: 'Вақти дарс!' }
    ])
    expect(plainOf(blocks)).toContain('1. «Танзимот»-ро кушоед\n2. «Пин-код»-ро пахш кунед')
    expect(cleanBlocks('не рӯйхат')).toEqual([])
  })

  it('links: the app\'s pages, a lesson, a course or a school, and https addresses only', () => {
    for (const ok of ['/', '/support', '/page?slug=privacy', '/course?id=abc-1', '/school?key=marifati-dini', 'https://example.com/a']) expect(linkAllowed(ok)).toBe(true)
    for (const bad of ['/admin', '/lesson?id=<x>', 'http://example.com', 'javascript:alert(1)', 'mailto:a@b.c', '//evil.com']) expect(linkAllowed(bad)).toBe(false)
    expect(SPOT_IDS).toContain('lock.no_answers')
  })

  it('tells her the learner\'s clock and summary (or that nothing is known yet)', () => {
    expect(learnerNote({ me: 'Name: Малика', now: '2026-11-21T20:00:00+05:00', tz: 'Asia/Dushanbe' })).toContain('HER CURRENT TIME: 2026-11-21T20:00:00+05:00 (Asia/Dushanbe)')
    expect(learnerNote({ me: 'Name: Малика' })).toContain('Name: Малика')
    expect(learnerNote({}, new Date('2026-11-21T10:00:00Z'))).toMatch(/HER CURRENT TIME: 2026-11-21T10:00:00.000Z[\s\S]*Nothing is known yet/)
  })
})

describe('asking Mahliyo', () => {
  beforeEach(() => create.mockReset())
  const turns = [{ role: 'user' as const, content: 'Тести марҳила чист?' }]

  it('asks the most capable model with fallbacks, cached guide and material, the learner after the cache; reads her blocks', async () => {
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify({ tajik: true, blocks: [{ type: 'text', text: 'Тести охири марҳила…' }, { type: 'link', to: '/garden', label: 'Харита' }] }) }] })
    const a = await answer(turns, 'Гулдухтар', 'ДОНИШ', { me: 'Name: Малика', now: '2026-11-21T20:00:00+05:00' })
    expect(a.blocks).toEqual([{ type: 'text', text: 'Тести охири марҳила…' }, { type: 'link', to: '/garden', label: 'Харита' }])
    expect(a).toMatchObject({ tajik: true, reply: 'Тести охири марҳила…\n\n[Пайванд: Харита → /garden]' })
    const req = create.mock.calls[0][0]
    expect(MODEL).toBe('claude-fable-5-2')
    expect(req).toMatchObject({ model: MODEL, fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'], output_config: { effort: 'low', format: { type: 'json_schema' } } })
    expect(req.thinking).toBeUndefined()
    expect(req.system[0].text).toContain('«Гулдухтар»')
    expect(req.system[0].text).toContain('Gratorslab')
    expect(req.system[0].text).toContain('- settings.pin:')
    expect(req.system[0].text).not.toMatch(/\{(APP|SPOTS|ROUTES)\}/)
    expect(req.system[1]).toMatchObject({ cache_control: { type: 'ephemeral' } })
    expect(req.system[1].text).toContain('ДОНИШ')
    expect(req.system[1].text).toContain('Ҳусейнзода Руслани Анвар')
    expect(req.system[2].cache_control).toBeUndefined()
    expect(req.system[2].text).toContain('Name: Малика')
    expect(req.messages).toEqual([{ role: 'user', content: 'Тести марҳила чист?' }])
  })

  it('another language: tajik false, her reply as given', async () => {
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"tajik":false,"blocks":[{"type":"text","text":"Извините, мой русский не очень хороший."}]}' }] })
    expect(await answer([{ role: 'user', content: 'Привет' }], 'Г', '')).toEqual({ tajik: false, blocks: [{ type: 'text', text: 'Извините, мой русский не очень хороший.' }], reply: 'Извините, мой русский не очень хороший.' })
  })

  it('declined, unreadable or empty: a kind Tajik apology that points to the consultant', async () => {
    const sorry = { tajik: true, blocks: [{ type: 'text', text: SORRY }], reply: SORRY }
    create.mockResolvedValue({ stop_reason: 'refusal', content: [] })
    expect(await answer(turns, 'Г', '')).toEqual(sorry)
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'не JSON' }] })
    expect(await answer(turns, 'Г', '')).toEqual(sorry)
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"tajik":true,"blocks":[]}' }] })
    expect(await answer(turns, 'Г', '')).toEqual(sorry)
  })
})

describe('what the phone tells her about the learner', () => {
  const b = {
    schools: [{ slug: 's1', title: 'Маърифат' }], schoolDetails: { s1: { courses: [{ id: 'c1' }] } },
    courses: { c1: { id: 'c1', title: 'Асосҳо', quizzes: [], modules: [{ quizzes: [], topics: [{ quizzes: [], lessons: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }] }] }] } },
    lessons: {
      l1: { id: 'l1', title: 'Намоз', quizzes: [{ id: 'q1' }] }, l2: { id: 'l2', title: 'Рӯза', quizzes: [{ id: 'q2' }] },
      l3: { id: 'l3', title: 'Закот' }, l4: { id: 'l4', title: 'Ҳаҷ' }
    },
    quizzes: { q1: { questions: [], grading: {} }, q2: { questions: [], grading: {} } }
  } as unknown as Bundle
  const p: ProgressData = {
    ...emptyProgress(), born: 2008, birthday: '2008-03-01', days: ['2026-11-20', '2026-11-21'],
    lessons: { l1: { p: 100, done: '2026-11-20', at: '2026-11-20' }, l2: { p: 100, done: '2026-11-21', at: '2026-11-21' }, l3: { p: 40, at: '2026-11-21' } },
    quizzes: { q1: { best: 35, passed: false, tries: 2, at: '2026-11-20' }, q2: { best: 70, passed: true, tries: 1, at: '2026-11-21' } },
    about: { time: '15 дақиқа', schools: ['s1'], source: 'дӯстон', at: '2026-11-18' }
  }

  it('her name, age, streak, welcome answers, each course with the next lesson, and her weak, fair and unfinished lessons', () => {
    const me = aboutMe('Малика', p, b, new Date(2026, 10, 21, 12))
    for (const s of ['Name: Малика; age 18', 'streak now: 2 day(s)', 'time a day 15 дақиқа; chosen schools Маърифат', 'tests taken: 2 (average best 53%, passed 1)',
      'Progress map: green (80%+) 0, yellow (50–79%) 1, red (below 50%) 1', 'Course "Асосҳо" (Маърифат): 2/4 lessons; next: "Закот" (/lesson?id=l3)',
      'Weak (red, repeat these): "Намоз" (/lesson?id=l1) 35%', 'Fair (yellow): "Рӯза" (/lesson?id=l2) 70%', 'Unfinished: "Закот" (/lesson?id=l3) read 40%']) expect(me).toContain(s)
    // nothing secret goes to her
    expect(me).not.toMatch(/@|512345678901234/)
    expect(aboutMe(undefined, emptyProgress(), null).length).toBeLessThanOrEqual(4000)
  })

  it('her clock with its UTC offset; one notification per reminder time', () => {
    expect(localIso(new Date(2026, 10, 21, 8, 5, 9))).toMatch(/^2026-11-21T08:05:09[+-]\d{2}:\d{2}$/)
    expect(reminderId('2026-11-21T15:00:00.000Z')).toBe(reminderId('2026-11-21T20:00:00+05:00'))
    expect(reminderId('2026-11-21T15:00:00.000Z')).not.toBe(reminderId('2026-11-21T15:01:00.000Z'))
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { linkAllowed, SPOT_IDS } from '@/lib/aiCatalog'
import { emptyProgress, type ProgressData } from '@/lib/progress'
import type { Bundle } from '@/web/offline/content'
import { aboutMe, localIso, reminderId } from '@/web/offline/mahliyo'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { beta = { messages: { create } } } }))
const generate = vi.fn()
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: generate } }, ThinkingLevel: { LOW: 'LOW', MINIMAL: 'MINIMAL', MEDIUM: 'MEDIUM' } }))

const { answer, cleanBlocks, configured, fixLatex, GEMINI_MODELS, isProblem, knowledgeOf, knowledgePartsOf, knowledgeText, KNOWLEDGE_CAP, languageOf, learnerNote, MODEL, plainOf, provider, quizText, reminderAsked, SORRY } = await import('@/server/mahliyo')

const bundle = {
  ui: { 'app.name': 'Гулдухтар' },
  pages: { privacy: { title: 'Сиёсати махфият', body: [{ type: 'paragraph', content: { spans: [{ text: 'Мо маълумоти шуморо ба касе намедиҳем.' }] } }] } },
  schools: [{ slug: 's1', title: 'Маърифати динӣ' }],
  schoolDetails: { s1: { courses: [{ id: 'c1', title: 'Асосҳо' }] } },
  courses: { c1: { goals: [{ text: 'Шинохтани арконҳо' }], modules: [{ topics: [{ lessons: [{ id: 'l1', title: 'Дарси 1' }] }] }] } },
  lessons: { l1: { title: 'Намоз', blocks: [
    { id: 'b1', type: 'paragraph', props: {}, content: { spans: [{ text: 'Намоз сутуни дин аст.' }] } },
    { id: 'b2', type: 'image', props: { asset_id: 'a1' }, content: { caption: 'Масҷид', url: 'https://x/y.png' } }
  ], quizzes: [{ id: 'q1' }] } },
  quizzes: { q1: {
    quiz: { id: 'q1', title: 'Тести намоз', pass_score_percent: 70 },
    questions: [{ id: 'x1', type: 'single_choice', prompt: 'Намоз дар як рӯз чанд маротиба аст?', options: [{ id: 'o1', text: 'Се' }, { id: 'o2', text: 'Панҷ' }] }],
    grading: { x1: { key: { correct_option_ids: ['o2'], accepted_answers: {}, correct_order: [], matching: {} }, explanation_correct: 'Панҷ намози фарз.' } }
  } }
}

describe('what Mahliyo knows', () => {
  it('reads the app\'s pages, schools, courses, goals and every lesson\'s words, with their links — not ids of blocks or files', () => {
    const k = knowledgeOf(bundle)
    for (const s of ['Сиёсати махфият', '/page?slug=privacy', 'ба касе намедиҳем', 'Мактаб: Маърифати динӣ (/school?key=s1)', 'Курс: Асосҳо (/course?id=c1)',
      'Шинохтани арконҳо', 'Дарс: Намоз (/lesson?id=l1)', 'Намоз сутуни дин аст.', 'Масҷид']) expect(k).toContain(s)
    for (const s of ['b1', 'a1', 'https://x/y.png', 'paragraph']) expect(k).not.toContain(s)
  })

  it('reads every test the staff published: its questions, answers, the right one and the explanation', () => {
    const k = knowledgeOf(bundle)
    for (const s of ['Тест «Тести намоз» (барои гузаштан 70%)', '1. Намоз дар як рӯз чанд маротиба аст?', 'Ҷавобҳо: Се; Панҷ', 'Ҷавоби дуруст: Панҷ', 'Шарҳ: Панҷ намози фарз.']) expect(k).toContain(s)
    expect(quizText({ quiz: { title: 'T' }, questions: [{ id: 'a', prompt: 'Пойтахт?' }], grading: { a: { key: { accepted_answers: { tg: ['Душанбе'] } } } } })).toContain('Ҷавоби дуруст: Душанбе')
  })

  it('too much material: the outline always, then the lessons nearest her question (typed with Russian letters too)', () => {
    const lessons = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`l${i}`, { title: `Дарси ${i}`, blocks: [{ content: { text: `${i === 17 ? 'Наврӯз ҷашни баҳор аст. ' : ''}${'матн '.repeat(400)}` } }] }]))
    const many = { ...bundle, quizzes: {}, lessons, courses: { c1: { modules: [{ topics: [{ lessons: Object.keys(lessons).map((id) => ({ id, title: id })) }] }] } } }
    const k = knowledgePartsOf(many)
    const small = knowledgeText(k, 'навруз чист?', 8000)
    expect(small.length).toBeLessThanOrEqual(8000)
    expect(small).toContain('Наврӯз ҷашни баҳор аст.')
    expect(small).toContain('Дарс: Дарси 29 (/lesson?id=l29)')
    // all of it fits: everything, in the same order whatever is asked
    expect(knowledgeText(k, 'навруз')).toBe(knowledgeText(k, 'намоз'))
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
  beforeEach(() => {
    create.mockReset()
    vi.stubEnv('ANTHROPIC_API_KEY', 'k')
    vi.stubEnv('GEMINI_API_KEY', '')
  })
  afterEach(() => vi.unstubAllEnvs())
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
    expect(req.system[0].text).toContain('It was earlier called «Духтари хубам»')
    expect(req.system[0].text).toContain('Gratorslab')
    // she is only Mahliyo AI: the model behind her is not named to her learners
    expect(req.system[0].text).toContain('Never name or hint at the technology')
    expect(req.system[0].text).toContain('When she argues or insists about who made you')
    // the app is for girls and young women: their everyday questions (cooking, home, beauty, health…) are answered fully
    expect(req.system[0].text).toContain('The everyday life of girls and young women')
    expect(req.system[0].text).toContain('are never off topic')
    expect(req.system[0].text).not.toMatch(/runs on|\{ENGINE\}/)
    expect(req.system[0].text).toContain('- settings.pin:')
    expect(req.system[0].text).not.toMatch(/\{(APP|SPOTS|ROUTES)\}/)
    expect(req.system[1]).toMatchObject({ cache_control: { type: 'ephemeral' } })
    expect(req.system[1].text).toContain('ДОНИШ')
    expect(req.system[1].text).toContain('Ҳусейнзода Руслани Анвар')
    expect(req.system[2].cache_control).toBeUndefined()
    expect(req.system[2].text).toContain('Name: Малика')
    expect(generate).not.toHaveBeenCalled()
    expect(req.messages).toEqual([{ role: 'user', content: 'Тести марҳила чист?' }])
  })

  it('every language: she answers in it (never sent to the consultant for its language)', async () => {
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"tajik":false,"blocks":[{"type":"text","text":"Язык меняется в «Танзимот» → «Забон»."}]}' }] })
    expect(await answer([{ role: 'user', content: 'Как поменять язык?' }], 'Г', '')).toEqual({ tajik: true, blocks: [{ type: 'text', text: 'Язык меняется в «Танзимот» → «Забон».' }], reply: 'Язык меняется в «Танзимот» → «Забон».' })
    expect(create.mock.calls[0][0].system[0].text).toContain('Answer in the language of her LAST message')
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

describe('Mahliyo on Gemini (only a Google AI Studio key set)', () => {
  const turns = [{ role: 'user' as const, content: 'Мҳлиё, пин кодро чи хел иваз кунам?' }, { role: 'assistant' as const, content: 'Аввал…' }, { role: 'user' as const, content: 'Нафаҳмидам' }]
  const me = { me: 'Name: Малика; age 17; birthday 03-01\nStudy days: 5', now: '2026-11-21T14:00:00+05:00' }
  const ok = (blocks: unknown[]) => ({ text: JSON.stringify({ tajik: true, blocks }), candidates: [{ finishReason: 'STOP' }] })
  beforeEach(() => {
    generate.mockReset()
    create.mockReset()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    vi.stubEnv('GEMINI_API_KEY', 'g')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('who answers: Claude when its key is set, otherwise Gemini, otherwise no one', () => {
    expect(provider()).toBe('gemini')
    vi.stubEnv('ANTHROPIC_API_KEY', 'k')
    expect(provider()).toBe('claude')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    vi.stubEnv('GEMINI_API_KEY', '')
    expect(provider()).toBeNull()
    expect(configured()).toBe(false)
  })

  it('asks the best free model with the same rules and blocks; she knows the learner\'s name, not her age or birthday', async () => {
    generate.mockResolvedValue(ok([{ type: 'text', text: 'Ба «Танзимот» дароед.' }, { type: 'screen', spot: 'settings.pin', caption: 'Инҷо' }]))
    const a = await answer(turns, 'Гулдухтар', 'ДОНИШ', me)
    expect(a).toMatchObject({ tajik: true, blocks: [{ type: 'text', text: 'Ба «Танзимот» дароед.' }, { type: 'screen', spot: 'settings.pin', caption: 'Инҷо' }] })
    const req = generate.mock.calls[0][0]
    expect(GEMINI_MODELS[0]).toBe('gemini-3.1-flash-lite')
    expect(req.model).toBe('gemini-3.1-flash-lite')
    expect(req.contents).toEqual([
      { role: 'user', parts: [{ text: 'Мҳлиё, пин кодро чи хел иваз кунам?' }] },
      { role: 'model', parts: [{ text: 'Аввал…' }] },
      { role: 'user', parts: [{ text: 'Нафаҳмидам' }] }
    ])
    expect(req.config).toMatchObject({ responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'MINIMAL' } })
    expect(req.config.responseJsonSchema.properties.blocks.items.anyOf).toHaveLength(5)
    const system = req.config.systemInstruction as string
    for (const s of ['«Гулдухтар»', 'Gratorslab', 'AS LONG AS THE QUESTION NEEDS', 'ДОНИШ', 'Study days: 5', 'HER CURRENT TIME: 2026-11-21T14:00:00+05:00']) expect(system).toContain(s)
    // her name: she is greeted by it; her age and birthday stay with the app
    expect(system).toContain('HER NAME: Малика')
    for (const s of ['age 17', '03-01', '{ENGINE}', 'runs on']) expect(system).not.toContain(s)
    expect(create).not.toHaveBeenCalled()
  })

  it('a busy model: the next one answers', async () => {
    generate.mockRejectedValueOnce(new Error('503 high demand')).mockResolvedValueOnce(ok([{ type: 'text', text: 'Салом!' }]))
    expect((await answer(turns, 'Г', '', me)).blocks).toEqual([{ type: 'text', text: 'Салом!' }])
    expect(generate.mock.calls.map((c) => c[0].model)).toEqual(GEMINI_MODELS.slice(0, 2))
  })

  it('every model over its quota: each asked once, then an error; all busy: asked again in rounds; blocked: her kind apology', async () => {
    generate.mockRejectedValue(new Error('{"error":{"code":429,"message":"quota"}}'))
    await expect(answer(turns, 'Г', '', me)).rejects.toThrow('quota')
    expect(generate).toHaveBeenCalledTimes(GEMINI_MODELS.length)
    // busy (503) everywhere in the first round: the second round finds one free
    generate.mockReset()
    vi.useFakeTimers()
    for (let i = 0; i < GEMINI_MODELS.length; i++) generate.mockRejectedValueOnce(new Error('{"error":{"code":503,"message":"high demand"}}'))
    generate.mockResolvedValueOnce(ok([{ type: 'text', text: 'Ниҳоят!' }]))
    const late = answer(turns, 'Г', '', me)
    await vi.runAllTimersAsync()
    expect((await late).blocks).toEqual([{ type: 'text', text: 'Ниҳоят!' }])
    expect(generate).toHaveBeenCalledTimes(GEMINI_MODELS.length + 1)
    vi.useRealTimers()
    generate.mockReset()
    generate.mockResolvedValue({ text: '', candidates: [{ finishReason: 'SAFETY' }] })
    expect((await answer(turns, 'Г', '', me)).reply).toBe(SORRY)
    generate.mockResolvedValue({ text: '', promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } })
    expect((await answer(turns, 'Г', '', me)).reply).toBe(SORRY)
  })

  it('pictures and files go with the last question, before its words (a text file as its text)', async () => {
    generate.mockResolvedValue(ok([{ type: 'text', text: 'Дар расм тугмаи «Танзимот» аст.' }]))
    const files = [
      { mime: 'image/jpeg' as const, name: 'screen.jpg', data: 'AAAA' },
      { mime: 'application/pdf' as const, name: 'dars.pdf', data: 'BBBB' },
      { mime: 'text/plain' as const, name: 'notes.txt', data: Buffer.from('Ёддошти ман').toString('base64') }
    ]
    await answer(turns, 'Г', '', me, files)
    const req = generate.mock.calls[0][0]
    expect(req.contents[0].parts).toEqual([{ text: 'Мҳлиё, пин кодро чи хел иваз кунам?' }])
    expect(req.contents[2].parts).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } },
      { inlineData: { mimeType: 'application/pdf', data: 'BBBB' } },
      { text: 'Файл «notes.txt»:\nЁддошти ман' },
      { text: 'Нафаҳмидам' }
    ])
    expect(req.config.systemInstruction).toContain('Pictures and files she sends')
    // and to Claude
    vi.stubEnv('ANTHROPIC_API_KEY', 'k')
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"tajik":true,"blocks":[{"type":"text","text":"Ҳа"}]}' }] })
    await answer(turns, 'Г', '', me, files)
    const msgs = create.mock.calls[0][0].messages
    expect(msgs[0]).toEqual({ role: 'user', content: 'Мҳлиё, пин кодро чи хел иваз кунам?' })
    expect(msgs[2].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'BBBB' } },
      { type: 'text', text: 'Файл «notes.txt»:\nЁддошти ман' },
      { type: 'text', text: 'Нафаҳмидам' }
    ])
  })

  it('three keys: the questions are spread over them; a request that hangs gets another beside it, the first answer wins', async () => {
    vi.stubEnv('GEMINI_API_KEY_2', 'g2')
    vi.stubEnv('GEMINI_API_KEY_3', 'g3')
    vi.useFakeTimers()
    const aborted: boolean[] = []
    generate.mockImplementationOnce(({ config }) => new Promise((_, no) => config.abortSignal.addEventListener('abort', () => { aborted.push(true); no(new Error('aborted')) })))
      .mockResolvedValueOnce(ok([{ type: 'text', text: 'Тез!' }]))
    const late = answer(turns, 'Г', '', me)
    await vi.advanceTimersByTimeAsync(5_900)
    expect(generate).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(200)
    expect((await late).blocks).toEqual([{ type: 'text', text: 'Тез!' }])
    expect(generate).toHaveBeenCalledTimes(2)
    expect(aborted).toEqual([true])
    vi.useRealTimers()
    // over one key's quota: the next model, with the next key
    generate.mockReset()
    generate.mockRejectedValueOnce(new Error('{"error":{"code":429}}')).mockResolvedValueOnce(ok([{ type: 'text', text: 'Ҳа' }]))
    await answer(turns, 'Г', '', me)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('asked to call in 4 minutes, she confirmed without the reminder: it is set all the same', async () => {
    const now = Date.parse('2026-11-21T15:00:00Z')
    expect(reminderAsked('Баъди 4 дақиқа ба ман занг занед', now)).toMatchObject({ type: 'reminder', at: '2026-11-21T15:04:00.000Z', title: 'Занги Маҳлиё' })
    expect(reminderAsked('Напомни через 2 часа', now)?.at).toBe('2026-11-21T17:00:00.000Z')
    expect(reminderAsked('4 дақиқа дарс хондам', now)).toBeNull()
    generate.mockResolvedValue(ok([{ type: 'text', text: 'Хуб, баъди 4 дақиқа ба шумо занг мезанам! 😊📞' }]))
    const a = await answer([{ role: 'user', content: 'Баъди 4 дақиқа ба ман занг занед' }], 'Г', '', me)
    expect(a.blocks.map((b) => b.type)).toEqual(['text', 'reminder'])
  })

  it('a problem to solve is thought through more; LaTeX whose backslash was lost is mended', async () => {
    expect(isProblem('Муодилаи квадратиро ёбед: 4x²+3x²-2=0')).toBe(true)
    expect(isProblem('2+2')).toBe(true)
    expect(isProblem('Пин-кодро чӣ тавр иваз кунам?')).toBe(false)
    generate.mockResolvedValue(ok([{ type: 'text', text: '$$x=\frac{1}{2}$$' }]))
    await answer([{ role: 'user', content: 'Ҳал кунед: 2x=1' }], 'Г', '', me)
    expect(generate.mock.calls[0][0].config.thinkingConfig.thinkingLevel).toBe('LOW')
    expect(fixLatex('$\u000crac{1}{2} \u0009imes 3$')).toBe('$\\frac{1}{2} \\times 3$')
  })

  it('a question about the world is looked up on the internet (Wikipedia): her sources come as links under her answer, pictures when asked', async () => {
    const page = (title: string, lang: string, image?: string) => ({ index: 1, title, fullurl: `https://${lang}.wikipedia.org/wiki/${title}`, extract: `${title} — мақолаи кӯтоҳ.`, ...(image ? { thumbnail: { source: image } } : {}) })
    const fetched: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      fetched.push(url)
      const lang = new URL(url).hostname.split('.')[0]
      return { ok: true, json: async () => ({ query: { pages: { 1: page(lang === 'tg' ? 'Оҳу' : 'Deer', lang, `https://upload.wikimedia.org/${lang}.jpg`) } } }) }
    }))
    generate.mockResolvedValue({ text: JSON.stringify({ tajik: true, blocks: [{ type: 'text', text: 'Оҳу ҳайвони зебост 🦌' }], sources: [1, 2] }), candidates: [{ finishReason: 'STOP' }] })
    const a = await answer([{ role: 'user', content: 'Расмҳои оҳу ва дар бораи онҳо бо манбаъ' }], 'Г', 'ДОНИШ', me)
    expect(fetched.map((u) => new URL(u).hostname)).toEqual(['tg.wikipedia.org', 'en.wikipedia.org'])
    expect(new URL(fetched[0]).searchParams.get('gsrsearch')).toBe('оҳу')
    const system = generate.mock.calls[0][0].config.systemInstruction as string
    expect(system).toContain('WEB RESULTS')
    expect(system).toContain('[1] Оҳу — https://tg.wikipedia.org/wiki/Оҳу')
    expect(a.blocks).toEqual([
      { type: 'text', text: 'Оҳу ҳайвони зебост 🦌' },
      { type: 'images', items: [{ src: 'https://upload.wikimedia.org/tg.jpg', title: 'Оҳу', url: 'https://tg.wikipedia.org/wiki/Оҳу' }, { src: 'https://upload.wikimedia.org/en.jpg', title: 'Deer', url: 'https://en.wikipedia.org/wiki/Deer' }] },
      { type: 'sources', items: [{ title: 'Оҳу', url: 'https://tg.wikipedia.org/wiki/Оҳу', site: 'tg.wikipedia.org' }, { title: 'Deer', url: 'https://en.wikipedia.org/wiki/Deer', site: 'en.wikipedia.org' }] }
    ])
    // about the app, a greeting: no search
    fetched.length = 0
    await answer([{ role: 'user', content: 'Пин-кодро чӣ тавр иваз кунам?' }], 'Г', '', me)
    await answer([{ role: 'user', content: 'Салом, чӣ хелӣ?' }], 'Г', '', me)
    expect(fetched).toEqual([])
    // Ruslan only when asked
    expect(system).toContain('never bring up his life')
    vi.unstubAllGlobals()
  })

  it('the quick model thinks least; the others from "low"', async () => {
    generate.mockRejectedValueOnce(new Error('busy')).mockResolvedValueOnce(ok([{ type: 'text', text: 'Ҳа' }]))
    await answer(turns, 'Г', '', me)
    expect(generate.mock.calls.map((c) => [c[0].model, c[0].config.thinkingConfig.thinkingLevel])).toEqual([['gemini-3.1-flash-lite', 'MINIMAL'], ['gemini-3.5-flash', 'LOW']])
  })

    it('the language of her last message is said last: Tajik (also typed with Russian letters), Russian, Persian, Latin', async () => {
    expect(languageOf('Пин-кодро чӣ тавр иваз кунам?')).toBe('Tajik (Cyrillic)')
    expect(languageOf('чи хел пин кодро иваз кунам')).toBeNull()
    expect(languageOf('Как поменять язык приложения?')).toBe('Russian')
    expect(languageOf('Ты Gemini от Google?')).toBe('Russian')
    expect(languageOf('زبان را چطور عوض کنم؟')).toMatch(/^Persian .*not in Tajik Cyrillic/)
    expect(languageOf('كيف أغير اللغة؟')).toMatch(/^Arabic/)
    expect(languageOf('How do I change my PIN?')).toMatch(/Latin letters/)
    generate.mockResolvedValue(ok([{ type: 'text', text: 'Язык меняется в «Танзимот».' }]))
    await answer([{ role: 'user', content: 'Как поменять язык?' }], 'Г', '', me)
    expect(generate.mock.calls[0][0].config.systemInstruction).toMatch(/REPLY LANGUAGE: write every text of your answer in Russian\.$/)
  })

    it('Persian answered in Tajik Cyrillic by the quick model: the next model answers', async () => {
    generate.mockResolvedValueOnce(ok([{ type: 'text', text: 'Барои тағйири забон…' }])).mockResolvedValueOnce(ok([{ type: 'text', text: 'برای تغییر زبان…' }]))
    const a = await answer([{ role: 'user', content: 'زبان را چطور عوض کنم؟' }], 'Г', '', me)
    expect(a.blocks).toEqual([{ type: 'text', text: 'برای تغییر زبان…' }])
    expect(generate).toHaveBeenCalledTimes(2)
  })

    it('without "private" the learner note keeps her name (for Claude)', () => {
    expect(learnerNote(me)).toContain('Name: Малика')
    expect(learnerNote(me, new Date(), { private: true })).toContain('not shared with you')
  })
})

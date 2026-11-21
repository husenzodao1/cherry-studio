import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { beta = { messages: { create } } } }))

const { answer, knowledgeOf, KNOWLEDGE_CAP, MODEL, SORRY } = await import('@/server/mahliyo')

const bundle = {
  ui: { 'app.name': 'Гулдухтар' },
  schools: [{ slug: 's1', title: 'Маърифати динӣ' }],
  schoolDetails: { s1: { courses: [{ id: 'c1', title: 'Асосҳо' }] } },
  courses: { c1: { goals: [{ text: 'Шинохтани арконҳо' }], modules: [{ topics: [{ lessons: [{ id: 'l1', title: 'Дарси 1' }] }] }] } },
  lessons: { l1: { title: 'Намоз', blocks: [
    { id: 'b1', type: 'paragraph', props: {}, content: { spans: [{ text: 'Намоз сутуни дин аст.' }] } },
    { id: 'b2', type: 'image', props: { asset_id: 'a1' }, content: { caption: 'Масҷид', url: 'https://x/y.png' } }
  ] } }
}

describe('what Mahliyo knows', () => {
  it('reads schools, courses, goals and every lesson\'s words — not ids or links', () => {
    const k = knowledgeOf(bundle)
    for (const s of ['Мактаб: Маърифати динӣ', 'Курс: Асосҳо', 'Шинохтани арконҳо', 'Дарс: Намоз', 'Намоз сутуни дин аст.', 'Масҷид']) expect(k).toContain(s)
    for (const s of ['b1', 'a1', 'https://x/y.png', 'paragraph']) expect(k).not.toContain(s)
  })

  it('keeps the course material within its limit', () => {
    const big = { ...bundle, lessons: { l1: { title: 'Дароз', blocks: [{ content: { text: 'а'.repeat(KNOWLEDGE_CAP * 2) } }] } } }
    expect(knowledgeOf(big).length).toBeLessThanOrEqual(KNOWLEDGE_CAP + 2)
  })
})

describe('asking Mahliyo', () => {
  beforeEach(() => create.mockReset())
  const turns = [{ role: 'user' as const, content: 'Тести марҳила чист?' }]

  it('asks the current Opus with fallbacks, a cached guide and a JSON answer; reads her reply', async () => {
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"tajik":true,"reply":"Тести охири марҳила…"}' }] })
    expect(await answer(turns, 'Гулдухтар', 'ДОНИШ')).toEqual({ tajik: true, reply: 'Тести охири марҳила…' })
    const req = create.mock.calls[0][0]
    expect(req).toMatchObject({ model: MODEL, fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'], output_config: { effort: 'low', format: { type: 'json_schema' } } })
    expect(MODEL).toBe('claude-opus-5-5')
    expect(req.system[0].text).toContain('«Гулдухтар»')
    expect(req.system[1]).toMatchObject({ cache_control: { type: 'ephemeral' } })
    expect(req.system[1].text).toContain('ДОНИШ')
    expect(req.messages).toEqual([{ role: 'user', content: 'Тести марҳила чист?' }])
  })

  it('another language: tajik false, her reply as given', async () => {
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"tajik":false,"reply":"Извините, мой русский не очень хороший."}' }] })
    expect(await answer([{ role: 'user', content: 'Привет' }], 'Г', '')).toEqual({ tajik: false, reply: 'Извините, мой русский не очень хороший.' })
  })

  it('declined or unreadable: a kind Tajik apology that points to the consultant', async () => {
    create.mockResolvedValue({ stop_reason: 'refusal', content: [] })
    expect(await answer(turns, 'Г', '')).toEqual({ tajik: true, reply: SORRY })
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'не JSON' }] })
    expect(await answer(turns, 'Г', '')).toEqual({ tajik: true, reply: SORRY })
  })
})

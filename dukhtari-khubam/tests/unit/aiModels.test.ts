import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const generate = vi.fn()
vi.mock('@google/genai', () => ({ GoogleGenAI: class { constructor(public o: { apiKey: string }) {} models = { generateContent: (r: unknown) => generate(r, this.o.apiKey) } }, ThinkingLevel: { LOW: 'LOW', MINIMAL: 'MINIMAL', MEDIUM: 'MEDIUM' } }))
const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { constructor(public o?: { apiKey?: string }) {} beta = { messages: { create: (r: unknown) => create(r, this.o?.apiKey) } } } }))

const { bookQuery, openKey, sealKey } = await import('@/server/aiModels')
const { answer } = await import('@/server/mahliyo')
const { passagesOf } = await import('@/web/files/bookText')

const ok = (blocks: unknown[], sources?: number[]) => ({ text: JSON.stringify({ tajik: true, blocks, ...(sources ? { sources } : {}) }), candidates: [{ finishReason: 'STOP' }] })
const turns = [{ role: 'user' as const, content: 'Одоби меҳмондорӣ чист?' }]

describe('the models the staff choose', () => {
  beforeEach(() => {
    vi.stubEnv('MAHLIYO_SERVER_SECRET', 'x'.repeat(64))
    vi.stubEnv('GEMINI_API_KEY', 'g')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    generate.mockReset()
    create.mockReset()
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('a key is kept only encrypted, and opened only with the server\'s secret', () => {
    const sealed = sealKey('sk-secret-123456')
    expect(sealed).not.toContain('sk-secret')
    expect(openKey(sealed)).toBe('sk-secret-123456')
    vi.stubEnv('MAHLIYO_SERVER_SECRET', 'y'.repeat(64))
    expect(() => openKey(sealed)).toThrow()
  })

  it('an OpenAI-compatible model (DeepSeek) answers with her rules; when it fails, the default answers', async () => {
    const sent: { url: string; body: Record<string, unknown>; auth: string }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string; headers: Record<string, string> }) => {
      sent.push({ url, body: JSON.parse(init.body), auth: init.headers.authorization })
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ tajik: true, blocks: [{ type: 'text', text: 'Меҳмон азиз аст 😊' }] }) }, finish_reason: 'stop' }] }) }
    }))
    const a = await answer(turns, 'Г', 'ДОНИШ', {}, [], { active: { provider: 'deepseek', model: 'deepseek-chat', key: 'dk-1' } })
    expect(a.blocks).toEqual([{ type: 'text', text: 'Меҳмон азиз аст 😊' }])
    expect(sent[0].url).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(sent[0].auth).toBe('Bearer dk-1')
    expect(sent[0].body).toMatchObject({ model: 'deepseek-chat', response_format: { type: 'json_object' } })
    const system = (sent[0].body.messages as { content: string }[])[0].content
    for (const s of ['ANSWER FORMAT', 'ДОНИШ', 'Gratorslab']) expect(system).toContain(s)
    expect(generate).not.toHaveBeenCalled()
    // the provider fails: the app's own default (Gemini) answers
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => 'down' })))
    generate.mockResolvedValue(ok([{ type: 'text', text: 'Ҷавоби пешфарз' }]))
    expect((await answer(turns, 'Г', '', {}, [], { active: { provider: 'deepseek', model: 'deepseek-chat', key: 'dk-1' } })).blocks).toEqual([{ type: 'text', text: 'Ҷавоби пешфарз' }])
  })

  it('Gemini or Claude with the staff\'s key and model', async () => {
    generate.mockResolvedValue(ok([{ type: 'text', text: 'Ҳа' }]))
    await answer(turns, 'Г', '', {}, [], { active: { provider: 'google', model: 'gemini-3.5-flash', key: 'staff-g' } })
    expect(generate.mock.calls[0][0].model).toBe('gemini-3.5-flash')
    expect(generate.mock.calls[0][1]).toBe('staff-g')
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"tajik":true,"blocks":[{"type":"text","text":"Ҳа"}]}' }] })
    await answer(turns, 'Г', '', {}, [], { active: { provider: 'anthropic', model: 'claude-sonnet-5-5', key: 'staff-a' } })
    expect(create.mock.calls[0][0]).toMatchObject({ model: 'claude-sonnet-5-5' })
    expect(create.mock.calls[0][0].fallbacks).toBeUndefined()
    expect(create.mock.calls[0][1]).toBe('staff-a')
  })
})

describe('the books she learnt from', () => {
  beforeEach(() => { vi.stubEnv('GEMINI_API_KEY', 'g'); vi.stubEnv('ANTHROPIC_API_KEY', ''); generate.mockReset() })
  afterEach(() => vi.unstubAllEnvs())

  it('a book is cut into passages of about a thousand characters, at sentences, with their pages', () => {
    const page = Array.from({ length: 40 }, (_, i) => `Ҷумлаи ${i + 1} дар бораи одоби меҳмондорӣ ва эҳтиром.`).join(' ')
    const p = passagesOf([page, 'Саҳифаи дуюм: хулоса ва маслиҳатҳо барои ҳаёт.'])
    expect(p.length).toBeGreaterThan(2)
    expect(p.every((x) => x.text.length <= 1100)).toBe(true)
    expect(p[0].text.endsWith('.')).toBe(true)
    expect(p[0].page).toBe(1)
    expect(p[p.length - 1]).toMatchObject({ page: 2, text: 'Саҳифаи дуюм: хулоса ва маслиҳатҳо барои ҳаёт.' })
    expect(p.map((x) => x.n)).toEqual(p.map((_, i) => i))
  })

  it('a question becomes the beginnings of its words, Tajik letters as typed with Russian ones; asking words left out', () => {
    expect(bookQuery('Одоби меҳмондорӣ чист?')).toBe('одоби:* | мехмон:*')
    expect(bookQuery('чи')).toBe('')
  })

  it('her answer uses the books\' passages first and names the book as its source', async () => {
    generate.mockResolvedValue(ok([{ type: 'text', text: 'Меҳмонро бо хурсандӣ пешвоз мегиранд.' }], [1]))
    const a = await answer(turns, 'Г', '', {}, [], { books: [{ book: 'Одоби духтар', page: 12, text: 'Меҳмонро бо хурсандӣ пешвоз гиред.' }] })
    const system = generate.mock.calls[0][0].config.systemInstruction as string
    expect(system).toContain('OFFICIAL BOOKS')
    expect(system).toContain('[1] Одоби духтар, саҳ. 12\nМеҳмонро бо хурсандӣ пешвоз гиред.')
    expect(a.blocks[a.blocks.length - 1]).toEqual({ type: 'sources', items: [{ title: 'Одоби духтар, саҳ. 12', url: '', site: 'Китоби расмӣ' }] })
  })
})

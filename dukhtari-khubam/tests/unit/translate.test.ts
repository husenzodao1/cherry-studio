import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const generate = vi.fn()
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: generate } }, ThinkingLevel: { LOW: 'LOW', MINIMAL: 'MINIMAL', MEDIUM: 'MEDIUM' } }))

const { fillTranslations, hashOf, replaced, stringsOf, translateBundle } = await import('@/server/translate')

const bundle = {
  version: 'v1', locale: 'tg', ui: { 'app.name': 'LifeHub' },
  schools: [{ id: 's1', slug: 'din', title: 'Маърифати динӣ', icon: 'mosque' }],
  lessons: { l1: { id: 'l1', title: 'Намоз', blocks: [{ id: 'b1', type: 'paragraph', content: { spans: [{ text: 'Намоз сутуни дин аст.' }] } }, { id: 'b2', type: 'image', props: { asset_id: 'a1' }, content: { url: 'https://x/y.png', caption: 'Масҷид' } }] } }
}

describe('the catalogue in every language', () => {
  beforeEach(() => { vi.stubEnv('MAHLIYO_SERVER_SECRET', 'x'.repeat(64)); vi.stubEnv('GEMINI_API_KEY', 'g'); generate.mockReset() })
  afterEach(() => vi.unstubAllEnvs())

  it('finds the words for people (not ids, links, kinds or the interface strings); Russian only where Tajik was left', () => {
    expect([...stringsOf(bundle, 'en')].sort()).toEqual(['Масҷид', 'Маърифати динӣ', 'Намоз', 'Намоз сутуни дин аст.'].sort())
    expect([...stringsOf({ a: { title: 'Молитва' }, b: { title: 'Намози субҳ' } }, 'ru')]).toEqual(['Намози субҳ'])
    const out = replaced(bundle, new Map([['Намоз', 'Prayer'], ['Масҷид', 'Mosque']]))
    expect(out.lessons.l1.title).toBe('Prayer')
    expect(out.lessons.l1.blocks[1].content).toEqual({ url: 'https://x/y.png', caption: 'Mosque' })
    expect(out.schools[0].slug).toBe('din')
  })

  it('saved translations are used at once; the missing ones are translated carefully, in batches, and saved', async () => {
    const calls: { fn: string; args: Record<string, unknown> }[] = []
    const sb = { rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      if (fn === 'api_mt_get') return { data: { [hashOf('Намоз')]: 'Prayer' }, error: null }
      return { data: 1, error: null }
    }) }
    const t = await translateBundle(sb as never, bundle, 'en')
    expect(t.bundle.lessons.l1.title).toBe('Prayer')
    expect(t.missing.sort()).toEqual(['Масҷид', 'Маърифати динӣ', 'Намоз сутуни дин аст.'].sort())
    generate.mockImplementation(async (req: { contents: string; config: { systemInstruction: string } }) => ({ text: JSON.stringify((JSON.parse(req.contents) as string[]).map((s) => `EN:${s}`)) }))
    await fillTranslations(sb as never, 'en', t.missing)
    const rules = generate.mock.calls[0][0].config.systemInstruction as string
    for (const s of ['from Tajik into English', 'exactly and faithfully', 'Quran', 'LaTeX']) expect(rules).toContain(s)
    const put = calls.find((c) => c.fn === 'api_mt_put')!
    expect(put.args.p_locale).toBe('en')
    expect(put.args.p_items).toContainEqual({ h: hashOf('Масҷид'), t: 'EN:Масҷид' })
  })
})

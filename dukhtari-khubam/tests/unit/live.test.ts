import { afterEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
vi.mock('@google/genai', async (orig) => {
  const real = await orig<typeof import('@google/genai')>()
  return { ...real, GoogleGenAI: vi.fn(function (this: unknown, o: unknown) { return { options: o, authTokens: { create } } }) }
})

const { liveConfig, liveInstruction, liveToken, LIVE_MODEL, LIVE_TOOLS, CHUNK_SECONDS } = await import('@/server/live')

describe("Mahliyo's live voice", () => {
  afterEach(() => { create.mockReset(); vi.unstubAllEnvs() })

  it('her settings: audio, transcripts both ways, her tools and Google, compression for the camera, the conversation resumed', () => {
    const c = liveConfig({ mode: 'camera', lang: 'tg', name: 'Малика', handle: 'h-1' })
    expect(c.responseModalities).toEqual(['AUDIO'])
    expect(c.inputAudioTranscription).toEqual({})
    expect(c.outputAudioTranscription).toEqual({})
    expect(c.contextWindowCompression).toEqual({ slidingWindow: {} })
    expect(c.sessionResumption).toEqual({ handle: 'h-1' })
    expect(c.tools).toEqual([{ functionDeclarations: LIVE_TOOLS }, { googleSearch: {} }])
    expect(LIVE_TOOLS.map((t) => t.name)).toEqual(['set_timer', 'call_contact', 'play_song', 'navigate', 'weather', 'open_page', 'end_conversation'])
    expect(String(c.systemInstruction)).toContain('CAMERA')
    expect(String(c.systemInstruction)).toContain('called Малика')
    expect(liveConfig({ mode: 'assistant', lang: 'ru' }).sessionResumption).toEqual({})
  })

  it('the speaking coach: a scenario and a report with her level at the end; never naming the model', () => {
    const t = liveInstruction({ mode: 'coach', scenario: 'ielts', lang: 'tg' })
    expect(t).toContain('IELTS Speaking examiner')
    expect(t).toContain('CEFR A1–C2')
    expect(t).toContain('Never name or hint at the technology')
    expect(liveInstruction({ mode: 'assistant', lang: 'tg', boy: true })).toContain('a young man')
  })

  it('a one-use token, a minute to start and two and a half to talk, everything locked in it', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'k1')
    create.mockResolvedValue({ name: 'auth_tokens/abc' })
    const now = Date.parse('2026-11-24T10:00:00Z')
    const t = await liveToken(liveConfig({ mode: 'assistant', lang: 'tg' }), now, ['k1'])
    expect(t).toEqual({ token: 'auth_tokens/abc', model: LIVE_MODEL(), expires: '2026-11-24T10:02:30.000Z' })
    const cfg = create.mock.calls[0][0].config
    expect(cfg).toMatchObject({ uses: 1, newSessionExpireTime: '2026-11-24T10:01:00.000Z', liveConnectConstraints: { model: 'gemini-3.8-live' } })
    expect(cfg.liveConnectConstraints.config.tools).toHaveLength(2)
    expect(CHUNK_SECONDS).toBe(120)
  })

  it('a key that fails: the next one', async () => {
    create.mockRejectedValueOnce(new Error('429')).mockResolvedValueOnce({ name: 'auth_tokens/two' })
    expect((await liveToken(liveConfig({ mode: 'assistant', lang: 'tg' }), Date.now(), ['a', 'b'])).token).toBe('auth_tokens/two')
  })
})

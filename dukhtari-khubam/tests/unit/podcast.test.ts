import { afterEach, describe, expect, it, vi } from 'vitest'

import { partsOf, scriptFrom, scriptRules, signedPart, TTS_MODELS, wavOf } from '@/server/podcast'

const SECRET = 's'.repeat(40)

describe('the lecture podcast', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('the script: two voices, the material\'s facts only, her language and length', () => {
    const r = scriptRules('ru', 5)
    expect(r).toContain('about 700 words')
    expect(r).toContain('never invent facts')
    expect(r).toContain('Write in Russian')
    const s = scriptFrom({ title: 'Фотосинтез', lines: [{ who: 'A', text: '**Салом!**' }, { who: 'X', text: 'Салом' }, { who: 'B', text: '  ' }] })
    expect(s).toEqual({ title: 'Фотосинтез', lines: [{ who: 'A', text: 'Салом!' }, { who: 'A', text: 'Салом' }] })
    expect(scriptFrom({ lines: [{ who: 'A', text: 'x' }] })).toBeNull()
  })

  it('parts of about half a minute, signed; a changed or old part is refused', () => {
    vi.stubEnv('MAHLIYO_SERVER_SECRET', SECRET)
    const lines = Array.from({ length: 12 }, (_, i) => ({ who: (i % 2 ? 'B' : 'A') as 'A' | 'B', text: 'Ҷумла '.repeat(30) }))
    const now = Date.parse('2026-11-24T10:00:00Z')
    const parts = partsOf(lines, now)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.flatMap((p) => p.lines)).toEqual(lines)
    expect(parts.every((p) => p.lines.reduce((n, l) => n + l.text.length, 0) <= 900 || p.lines.length === 1)).toBe(true)
    expect(signedPart(parts[0], now)).toBe(true)
    expect(signedPart({ ...parts[0], lines: [{ who: 'A', text: 'другое' }] }, now)).toBe(false)
    expect(signedPart(parts[0], now + 7 * 3600_000)).toBe(false)
    vi.stubEnv('MAHLIYO_SERVER_SECRET', 'x'.repeat(40))
    expect(signedPart(parts[0], now)).toBe(false)
  })

  it('a WAV around the speech model\'s PCM; the model chosen by the setting first', () => {
    const wav = wavOf(Buffer.alloc(48_000), 24_000)
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.readUInt32LE(24)).toBe(24_000)
    expect(wav.readUInt32LE(40)).toBe(48_000)
    vi.stubEnv('GEMINI_TTS_MODEL', 'my-tts')
    expect(TTS_MODELS()[0]).toBe('my-tts')
  })
})

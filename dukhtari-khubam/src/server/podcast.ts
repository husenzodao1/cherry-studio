import { createHmac, timingSafeEqual } from 'node:crypto'

import { GoogleGenAI } from '@google/genai'

import { secret } from './aiModels'
import { geminiKeys } from './mahliyo'

/**
 * A podcast from a lecture: the AI turns her material (a lecture's text, notes, a photo of a page) into a
 * lively conversation between Mahliyo (who explains) and Sitora (a curious student who asks what she would
 * ask), and the voices are made by Gemini's speech model, a few lines at a time so each part is small and
 * starts playing at once. Each part of the script comes signed by this server: only the script it wrote is
 * voiced, and only for a few hours.
 */

export interface Line { who: 'A' | 'B'; text: string }
export interface Script { title: string; lines: Line[] }
export interface Part { lines: Line[]; exp: number; sig: string }

const LANGS: Record<string, string> = { tg: 'Tajik', ru: 'Russian', en: 'English', uz: 'Uzbek (Latin)', tr: 'Turkish', fa: 'Persian', prs: 'Dari' }
const SCRIPT_MODELS = ['gemini-3.5-flash', 'gemini-flash-latest']
export const TTS_MODELS = () => [process.env.GEMINI_TTS_MODEL?.trim(), 'gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview'].filter((m): m is string => !!m)
export const NAMES = { A: 'Mahliyo', B: 'Sitora' } as const
/** the voices of the speech model (prebuilt voices): a warm explainer and a bright young one */
const VOICES = { A: 'Kore', B: 'Leda' } as const
/** a part's lines (about half a minute of speech) */
const PART_CHARS = 900
const TTL_MS = 6 * 3600_000

export function scriptRules(lang: string, minutes: number) {
  const words = minutes * 140
  return `Turn the study material into a podcast script of about ${words} words (${minutes} minutes): a warm, lively conversation between two voices.
"A" is Mahliyo, a kind, clever teacher who explains; "B" is Sitora, a curious 16-year-old student who asks the questions a learner would ask, says what confuses her, and sums up in her own words.
Cover ALL the key ideas of the material in a sensible order, with simple examples and one memorable comparison; end with Sitora summing up the 3 main points and Mahliyo giving one question to think about.
Keep to the material's facts — never invent facts, numbers or dates. Short lines (1–3 sentences), natural spoken language, no stage directions, no emoji, no markdown.
Write in ${LANGS[lang] ?? 'Tajik'}. Return JSON: { "title": a short title, "lines": [{ "who": "A" | "B", "text": "…" }] }.`
}

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    lines: { type: 'array', items: { type: 'object', properties: { who: { type: 'string', enum: ['A', 'B'] }, text: { type: 'string' } }, required: ['who', 'text'] } }
  },
  required: ['title', 'lines']
}

/** the script, cleaned: who is who, no empty lines, not too long */
export function scriptFrom(raw: unknown): Script | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const lines = (Array.isArray(o.lines) ? o.lines : []).flatMap((l) => {
    const x = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>
    const text = String(x.text ?? '').replace(/[*_#`]/g, '').trim().slice(0, 600)
    return text ? [{ who: x.who === 'B' ? 'B' as const : 'A' as const, text }] : []
  }).slice(0, 200)
  return lines.length >= 2 ? { title: String(o.title ?? '').trim().slice(0, 120) || '—', lines } : null
}

export async function writeScript(o: { text?: string; image?: { mime: string; data: string }; lang: string; minutes: number }, keys = geminiKeys()): Promise<Script | null> {
  const parts = [...(o.image ? [{ inlineData: { mimeType: o.image.mime, data: o.image.data } }] : []), { text: o.text ? `MATERIAL:\n${o.text}` : 'The material is the photo.' }]
  for (const model of SCRIPT_MODELS) {
    for (const key of keys) {
      try {
        const r = await new GoogleGenAI({ apiKey: key, httpOptions: { retryOptions: { attempts: 1 } } }).models.generateContent({
          model, contents: [{ role: 'user', parts }],
          config: { systemInstruction: scriptRules(o.lang, o.minutes), responseMimeType: 'application/json', responseJsonSchema: SCHEMA, temperature: 0.7, httpOptions: { timeout: 120_000 } }
        })
        const s = scriptFrom(JSON.parse(r.text ?? '{}'))
        if (s) return s
      } catch (e) {
        console.warn('[podcast] script', model, String(e instanceof Error ? e.message : e).slice(0, 160))
      }
    }
  }
  return null
}

const mac = (exp: number, lines: Line[]) => createHmac('sha256', `${secret()}:podcast`).update(`${exp}|${JSON.stringify(lines)}`).digest('hex')

/** the script in parts of about half a minute, each signed */
export function partsOf(lines: Line[], now = Date.now()): Part[] {
  const out: Line[][] = [[]]
  let size = 0
  for (const l of lines) {
    if (size + l.text.length > PART_CHARS && out[out.length - 1].length) { out.push([]); size = 0 }
    out[out.length - 1].push(l)
    size += l.text.length
  }
  const exp = now + TTL_MS
  return out.map((p) => ({ lines: p, exp, sig: mac(exp, p) }))
}

/** whether a part is one this server wrote, and still fresh */
export function signedPart(p: Part, now = Date.now()): boolean {
  if (!secret() || p.exp < now || p.exp > now + TTL_MS + 60_000 || !/^[0-9a-f]{64}$/.test(p.sig)) return false
  const want = Buffer.from(mac(p.exp, p.lines), 'hex')
  return timingSafeEqual(want, Buffer.from(p.sig, 'hex'))
}

/** 16-bit mono PCM (as the speech model gives it) in a WAV file */
export function wavOf(pcm: Buffer, rate = 24_000): Buffer {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

/** a part voiced: a WAV (base64), or null when no speech model answered */
export async function voicePart(lines: Line[], lang: string, keys = geminiKeys()): Promise<string | null> {
  const text = `Read this conversation aloud in ${LANGS[lang] ?? 'Tajik'}, naturally, as a friendly educational podcast. ${NAMES.A} speaks warmly and clearly; ${NAMES.B} is young, curious and lively.\n\n${lines.map((l) => `${NAMES[l.who]}: ${l.text}`).join('\n')}`
  for (const model of TTS_MODELS()) {
    for (const key of keys) {
      try {
        const r = await new GoogleGenAI({ apiKey: key, httpOptions: { retryOptions: { attempts: 1 } } }).models.generateContent({
          model, contents: [{ role: 'user', parts: [{ text }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs: (['A', 'B'] as const).map((w) => ({ speaker: NAMES[w], voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[w] } } })) } },
            httpOptions: { timeout: 90_000 }
          }
        })
        const data = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData
        if (!data?.data) continue
        const rate = Number(/rate=(\d+)/.exec(data.mimeType ?? '')?.[1] ?? 24_000)
        return wavOf(Buffer.from(data.data, 'base64'), rate).toString('base64')
      } catch (e) {
        console.warn('[podcast] voice', model, String(e instanceof Error ? e.message : e).slice(0, 160))
      }
    }
  }
  return null
}

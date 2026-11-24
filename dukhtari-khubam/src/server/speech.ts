import { GoogleGenAI } from '@google/genai'

import { GEMINI_MODELS, geminiKeys } from './mahliyo'

/**
 * "Эй Маҳлиё" online: what she said, heard by the server's AI (Gemini hears speech in all the app's seven
 * languages, Tajik too, much better than the phone's small offline models). The phone sends a short WAV
 * (16 kHz mono); the words come back in her language's own script. Without a key, or when no model answers,
 * the phone keeps what its own model heard.
 */

const LANGS: Record<string, string> = {
  tg: 'Tajik (written in Tajik Cyrillic: ҳ, қ, ҷ, ғ, ӣ, ӯ)', ru: 'Russian', en: 'English', uz: 'Uzbek (Latin script)',
  tr: 'Turkish', fa: 'Persian (Farsi, Arabic script)', prs: 'Dari (Persian, Arabic script)'
}
const WAIT_MS = 15_000

/** the words to write down: the spoken language named, the app's assistant's name spelled as it is */
export function hearingPrompt(lang: string): string {
  return [
    `Transcribe exactly what is said in this audio. The speaker most likely speaks ${LANGS[lang] ?? LANGS.tg}, but may mix in Russian or another language: write each word as it was said, in its usual script.`,
    'The assistant is called Mahliyo: write her name as "Маҳлиё" in Tajik, "Махлиё" in Russian, "Mahliyo" in Latin scripts.',
    'Write numbers as digits. Answer with the words only — no quotes, no notes. Silence or noise: answer with nothing.'
  ].join('\n')
}

export async function transcribe(wav: string, lang: string, keys = geminiKeys(), models = GEMINI_MODELS): Promise<string | null> {
  if (!keys.length) return null
  const started = Date.now()
  // the quick models first: a few words need no thinking
  const order = [...models.filter((m) => m.includes('lite')), ...models.filter((m) => !m.includes('lite'))]
  for (const model of order) {
    for (const key of keys) {
      const left = WAIT_MS * 2 - (Date.now() - started)
      if (left < 10_000) return null
      try {
        const r = await new GoogleGenAI({ apiKey: key, httpOptions: { retryOptions: { attempts: 1 } } }).models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'audio/wav', data: wav } }, { text: hearingPrompt(lang) }] }],
          config: { maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 }, httpOptions: { timeout: Math.max(10_000, Math.min(WAIT_MS, left)) } }
        })
        return (r.text ?? '').replace(/^["«]|["»]$/g, '').trim()
      } catch (e) {
        console.warn('[speech]', model, 'failed:', String(e instanceof Error ? e.message : e).slice(0, 160))
      }
    }
  }
  return null
}

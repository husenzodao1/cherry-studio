import { GoogleGenAI } from '@google/genai'

import { geminiKeys } from './mahliyo'
import type { WebSource } from './webSearch'

/**
 * Fresh facts from Google Search, through Gemini's "grounding with Google Search": news, prices and rates,
 * announcements, today's events — what Wikipedia does not have yet. It is a paid feature of the Gemini API
 * (not in the free tier), so it is used only when the staff turn it on: WEB_SEARCH=google. The facts found and
 * their pages go to Mahliyo with the question, and come back to the learner as sources; Google's own search
 * for them is linked too (as Google asks of grounded answers).
 */

export const googleSearchOn = () => process.env.WEB_SEARCH?.trim() === 'google' && geminiKeys().length > 0
const MODEL = () => process.env.WEB_SEARCH_MODEL?.trim() || 'gemini-3.1-flash-lite'
const WAIT_MS = 9000

/** questions about what is happening now: news, prices, rates, weather, announcements, results, schedules */
const FRESH = /(хабар|навигар|имрӯз|ҳозир|ҳоло|дирӯз|ин\s*ҳафта|нарх|қурб|курс\s*(и\s*)?(доллар|рубл|сомон)|эълон|озмун|натиҷа|ҷадвал|новост|сегодня|вчера|сейчас|цен[аыу]|курс|объявлен|конкурс|результат|расписан|news|today|yesterday|latest|price|rate|announce|result|schedule|yangilik|bugun|narx|haber|bugün|fiyat|خبر|امروز|قیمت)/i
export const wantsFresh = (question: string) => question.trim().length >= 6 && FRESH.test(question)

interface Grounded {
  text?: string
  candidates?: { groundingMetadata?: { webSearchQueries?: string[]; groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[]
}

/** what Google finds for her question: a short summary with dates, its pages, and Google's own search for it */
export function sourcesOf(r: Grounded): WebSource[] {
  const meta = r.candidates?.[0]?.groundingMetadata
  const summary = (r.text ?? '').trim().slice(0, 2500)
  if (!summary) return []
  const pages = (meta?.groundingChunks ?? []).flatMap((c) => (c.web?.uri ? [{ uri: c.web.uri, title: c.web.title ?? '' }] : []))
  const seen = new Set<string>()
  const out: WebSource[] = pages.filter((p) => !seen.has(p.title) && seen.add(p.title)).slice(0, 4)
    .map((p, i) => ({ title: p.title || 'Google', url: p.uri, site: p.title || 'google.com', text: i === 0 ? summary : '' }))
  const query = meta?.webSearchQueries?.[0]
  if (query) out.push({ title: `Google: ${query}`, url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, site: 'google.com', text: out.length ? '' : summary })
  return out
}

export async function searchGoogle(question: string, lang: string, keys = geminiKeys()): Promise<WebSource[]> {
  for (const key of keys) {
    try {
      const r = await new GoogleGenAI({ apiKey: key, httpOptions: { retryOptions: { attempts: 1 } } }).models.generateContent({
        model: MODEL(),
        contents: [{ role: 'user', parts: [{ text: `Find current, reliable facts for this question (answer language: ${lang}). Reply with the facts only, in short points, each with its date when it matters; prefer official and well-known local sources (Tajikistan first when it is about Tajikistan).\n\nQuestion: ${question.slice(0, 800)}` }] }],
        config: { tools: [{ googleSearch: {} }], maxOutputTokens: 900, httpOptions: { timeout: WAIT_MS } }
      })
      return sourcesOf(r as Grounded)
    } catch (e) {
      console.warn('[web] google search failed:', String(e instanceof Error ? e.message : e).slice(0, 160))
    }
  }
  return []
}

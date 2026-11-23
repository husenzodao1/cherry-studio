import { createHash } from 'node:crypto'

import { GoogleGenAI } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'

import { secret, serverReady } from './aiModels'
import { geminiKeys } from './mahliyo'
import { call } from './util'

/**
 * The catalogue in every interface language. Schools, courses, lessons, tests and the words of the day are
 * written in Tajik (and Russian); for the other languages each of their texts is translated by the AI once —
 * carefully, the meaning kept exactly — and kept in the database (api_mt_get / api_mt_put), so a bundle is
 * put together from saved translations at once. Texts not translated yet stay in Tajik in that bundle
 * (marked `translating`), are translated right after, and the phone asks again until all are there.
 */

export const MT_LOCALES = ['ru', 'en', 'uz', 'tr', 'fa', 'prs'] as const
export type MtLocale = (typeof MT_LOCALES)[number]
const NAMES: Record<MtLocale, string> = {
  ru: 'Russian', en: 'English', uz: 'Uzbek (Latin script)', tr: 'Turkish', fa: 'Persian (Farsi, Iranian)', prs: 'Dari (Afghan Persian)'
}

/** keys whose strings are not words for people: ids, links, files, kinds, settings */
const SKIP = new Set(['id', 'url', 'href', 'src', 'asset_id', 'mime_type', 'bucket', 'path', 'type', 'variant', 'kind', 'ref', 'slug', 'locale',
  'at', 'schema_version', 'status', 'tier', 'icon', 'color', 'version', 'generated_at', 'created_at', 'updated_at', 'published_at', 'starts_at', 'ends_at',
  'lang', 'language', 'code', 'key', 'side', 'show_explanations', 'show_correct_answers', 'placement', 'ui', 'media', 'thumb', 'poster', 'provider', 'role'])

/** what is to be translated: Tajik words (for Russian, only texts still left in Tajik) */
const wants = (text: string, locale: MtLocale) => (locale === 'ru' ? /[ӣӯқҳҷғ]/i.test(text) : /[а-яёӣӯқҳҷғ]/i.test(text))
export const hashOf = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 32)

type Json = unknown
/** Every translatable string of a bundle (once each). */
export function stringsOf(x: Json, locale: MtLocale, out = new Set<string>(), key?: string): Set<string> {
  if (typeof x === 'string') { if (!(key && SKIP.has(key)) && x.trim() && wants(x, locale)) out.add(x) }
  else if (Array.isArray(x)) for (const v of x) stringsOf(v, locale, out, key)
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (!SKIP.has(k)) stringsOf(v, locale, out, k)
  return out
}
/** The bundle with every string that has a translation replaced by it. */
export function replaced<T>(x: T, done: Map<string, string>, key?: string): T {
  if (typeof x === 'string') return (key && SKIP.has(key) ? x : done.get(x) ?? x) as T
  if (Array.isArray(x)) return x.map((v) => replaced(v, done, key)) as T
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, SKIP.has(k) ? v : replaced(v, done, k)])) as T
  return x
}

/** The saved translations of these texts. */
async function saved(sb: SupabaseClient, locale: MtLocale, texts: string[]): Promise<Map<string, string>> {
  const done = new Map<string, string>()
  for (let i = 0; i < texts.length; i += 400) {
    const part = texts.slice(i, i + 400)
    const byHash = await call<Record<string, string>>(sb, 'api_mt_get', { p_proof: secret(), p_locale: locale, p_hashes: part.map(hashOf) })
    for (const t of part) { const tr = byHash[hashOf(t)]; if (tr) done.set(t, tr) }
  }
  return done
}

/**
 * A bundle in `locale`: its texts replaced by their saved translations; `missing`: those not translated yet.
 */
export async function translateBundle<T extends object>(sb: SupabaseClient, bundle: T, locale: MtLocale): Promise<{ bundle: T; missing: string[] }> {
  const texts = [...stringsOf(bundle, locale)]
  if (!texts.length || !serverReady()) return { bundle, missing: serverReady() ? [] : texts }
  const done = await saved(sb, locale, texts)
  return { bundle: replaced(bundle, done), missing: texts.filter((t) => !done.has(t)) }
}

const RULES = (lang: string) => `You translate the texts of «LifeHub», an educational app for girls and boys in Tajikistan (seven schools: religious knowledge, manners and ethics, Tajik culture, family and relationships, science and health, personal growth, modern life), from Tajik into ${lang}.
- Translate exactly and faithfully: keep the full meaning, tone and every detail; add nothing, leave nothing out, do not explain or comment.
- Natural, correct, educated ${lang}, warm and respectful, as a careful human translator would write for young readers.
- Keep names of people, places and books (transliterate them in the usual way of ${lang}); keep Quran and hadith references (sura:verse, collections) exactly; Islamic terms in the forms usual in ${lang}.
- Keep every formatting mark unchanged: Markdown (**, *, -, #, links), LaTeX ($…$), placeholders like {name}, line breaks, emoji, numbers.
- A poem stays a poem: keep its lines (one per line), translate its meaning beautifully.
- Input: a JSON array of texts. Output: a JSON array of the translations, the same length and order, nothing else.`

let ai: GoogleGenAI[] | null = null
/** The models that translate, the most careful first. */
const MODELS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite']

async function translateBatch(texts: string[], locale: MtLocale, round: number): Promise<string[] | null> {
  const keys = geminiKeys()
  if (!keys.length) return null
  ai ??= keys.map((k) => new GoogleGenAI({ apiKey: k, httpOptions: { retryOptions: { attempts: 1 } } }))
  for (let i = 0; i < MODELS.length * ai.length; i++) {
    const model = MODELS[Math.floor(i / ai.length) % MODELS.length]
    const client = ai[(i + round) % ai.length]
    try {
      const r = await client.models.generateContent({
        model,
        contents: JSON.stringify(texts),
        config: { systemInstruction: RULES(NAMES[locale]), responseMimeType: 'application/json', responseJsonSchema: { type: 'array', items: { type: 'string' } }, httpOptions: { timeout: 90_000 } }
      })
      const out = JSON.parse(r.text ?? '[]') as unknown
      if (Array.isArray(out) && out.length === texts.length && out.every((t) => typeof t === 'string' && t.trim())) return out as string[]
    } catch (e) {
      console.warn('[translate]', model, locale, String(e instanceof Error ? e.message : e).slice(0, 140))
    }
  }
  return null
}

/** Translates and saves the missing texts, a batch at a time, until done or the time is up. */
export async function fillTranslations(sb: SupabaseClient, locale: MtLocale, missing: string[], budgetMs = 240_000) {
  if (!serverReady() || !missing.length) return 0
  const started = Date.now()
  let saved = 0
  // batches of up to 40 texts or about 6000 characters
  const batches: string[][] = []
  let cur: string[] = []
  let size = 0
  for (const t of missing) {
    if (cur.length && (cur.length >= 40 || size + t.length > 6000)) { batches.push(cur); cur = []; size = 0 }
    cur.push(t); size += t.length
  }
  if (cur.length) batches.push(cur)
  for (let b = 0; b < batches.length && Date.now() - started < budgetMs; b++) {
    const out = await translateBatch(batches[b], locale, b)
    if (!out) continue
    saved += await call<number>(sb, 'api_mt_put', { p_proof: secret(), p_locale: locale, p_items: batches[b].map((t, i) => ({ h: hashOf(t), t: out[i] })) }).catch(() => 0)
  }
  return saved
}

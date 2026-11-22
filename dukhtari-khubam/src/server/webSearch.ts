/**
 * Mahliyo looks things up on the internet: Wikipedia (in the learner's language, and in English), free and
 * citable — the articles' opening words go to her with the question, and the ones she used come back to the
 * learner as sources (and their pictures, when she asked for pictures). Google's own search in Gemini is
 * not part of the free tier; this needs no key.
 */

export interface WebSource {
  title: string
  url: string
  /** the site, as the learner sees it ("tg.wikipedia.org") */
  site: string
  /** the article's opening words */
  text: string
  /** a picture of it, when the article has one */
  image?: string
}

/** Wikipedia asks API clients to name themselves */
const AGENT = 'DukhtariKhubamApp/1.0 (https://dukhtari-khubam.vercel.app)'
const WAIT_MS = 3500
const TEXT_CAP = 1500

/** Questions that are about the app itself, a greeting, a problem to solve or a reminder: no search. */
const NOT_WEB = /(барнома|пин|pin|танзимот|профил|харита|тест|дарс(и|ҳо)?\s*(ман|навбатӣ)|маҳлиё|махлиё|ёдам|ёд\s*деҳ|занг|салом|ташаккур|раҳмат|чӣ\s*хел|чи\s*хел|привет|спасибо|hello|thanks)/i
/** Questions that ask about the world: who, what, when, where, how many, tell about, pictures, sources. */
const ASKS = /(кист|чист|кай|куҷо|чанд|чаро|дар\s*бораи|маълумот|манбаъ|сарчашма|расм|сурат|таърих|кто|что\s*такое|когда|где|сколько|почему|расскажи|источник|фото|картин|who|what|when|where|how\s*many|why|tell\s*me|source|picture|photo)/i

/** Whether a question is worth looking up on the internet. */
export function needsWeb(question: string): boolean {
  const q = question.trim()
  return q.length >= 10 && ASKS.test(q) && !NOT_WEB.test(q)
}

/** Whether she was asked for pictures. */
export const wantsPictures = (question: string) => /(расм|сурат|фото|картин|изображ|picture|photo|image)/i.test(question)

/** the words to search for: the question without its asking words */
const FILLER = /(?<!\p{L})(дар\s*бораи|маълумот\p{L}*|диҳед|деҳ|бигӯед|гӯед|лутфан|бо|ва|ё|он|онҳо|ин|инҳо|манбаъ\p{L}*|сарчашма\p{L}*|источник\p{L}*|расм\p{L}*|сурат\p{L}*|кист|чист|чӣ|чи|чанд|кай|куҷо|аст|мебошад|расскажи(те)?|про|о|об|и|что\s*такое|кто\s*такой|покажи(те)?|фото\p{L}*|картинк\p{L}*|tell\s*me\s*about|what\s*is|who\s*is|pictures?\s*of|photos?\s*of|about|and|the|of|is|was|were|who|what|please)(?!\p{L})/giu
export const searchWords = (question: string) => question.replace(/[?!.,:;«»"()]/g, ' ').replace(FILLER, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)

async function wiki(lang: string, query: string, signal: AbortSignal): Promise<WebSource[]> {
  const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({
    action: 'query', format: 'json', utf8: '1', generator: 'search', gsrsearch: query, gsrlimit: '3',
    prop: 'extracts|info|pageimages', exintro: '1', explaintext: '1', exlimit: '3', inprop: 'url', piprop: 'thumbnail', pithumbsize: '480'
  })
  const res = await fetch(url, { headers: { 'user-agent': AGENT }, signal })
  if (!res.ok) return []
  const data = (await res.json()) as { query?: { pages?: Record<string, { index?: number; title?: string; fullurl?: string; extract?: string; thumbnail?: { source?: string } }> } }
  return Object.values(data.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .filter((p) => p.title && p.fullurl && p.extract?.trim())
    .map((p) => ({
      title: p.title!, url: p.fullurl!, site: `${lang}.wikipedia.org`,
      text: p.extract!.trim().slice(0, TEXT_CAP), ...(p.thumbnail?.source ? { image: p.thumbnail.source } : {})
    }))
}

/**
 * Up to four articles for a question: in its language first (Tajik, Russian), then English; nothing when the
 * internet is slow or Wikipedia does not answer (she answers from what she knows).
 */
export async function searchWeb(question: string, lang: 'tg' | 'ru' | 'en'): Promise<WebSource[]> {
  const query = searchWords(question)
  if (query.length < 2) return []
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), WAIT_MS)
  try {
    const langs = lang === 'en' ? ['en'] : [lang, 'en']
    // all the words; when that finds nothing, the two longest (search wants every word to be there)
    const short = query.split(' ').sort((a, b) => b.length - a.length).slice(0, 2).join(' ')
    const look = async (l: string) => {
      const all = await wiki(l, query, stop.signal).catch(() => [])
      return all.length || short === query ? all : wiki(l, short, stop.signal).catch(() => [])
    }
    const found = await Promise.all(langs.map(look))
    const seen = new Set<string>()
    return found.flat().filter((s) => !seen.has(s.url) && seen.add(s.url)).slice(0, 4)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Real pictures for a presentation's slides, from Wikipedia: Mahliyo writes `![caption](wiki:Article title)`
 * (the English Wikipedia article of a real person, place, building, animal, artwork or event) on a slide where
 * a photo helps; here each becomes the article's own lead picture (a JPEG or PNG, 960 pixels wide).
 * A picture not found is left out, so a slide never shows a broken one.
 */

const WIKI = /^!\[([^\]\n]{0,160})\]\(wiki:([^)\n]{1,160})\)\s*$/gm
const MAX = 10
const WAIT_MS = 5000
/** Wikipedia asks every client to say what it is */
const AGENT = 'LifeHub/1.0 (educational app; slide pictures)'

interface Summary { thumbnail?: { source: string; width: number }; originalimage?: { source: string; width: number } }

/** Wikimedia makes copies of a picture only in its standard widths */
const STEP = 960
/** a picture's address, without what Wikipedia adds to count its visitors */
const bare = (url: string) => url.split('?')[0]
const PICTURE_URL = /^https:\/\/(upload|thumb)\.wikimedia\.org\/.+\.(jpe?g|png|webp)$/i

/** the article's lead picture, about 960 pixels wide (null: none, or not a picture slides can show) */
export async function wikiPicture(title: string, get: typeof fetch = fetch): Promise<string | null> {
  const page = encodeURIComponent(title.trim().replace(/\s+/g, '_'))
  try {
    const res = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${page}?redirect=true`, {
      headers: { 'user-agent': AGENT, accept: 'application/json' }, signal: AbortSignal.timeout(WAIT_MS)
    })
    if (!res.ok) return null
    const s = (await res.json()) as Summary
    const original = s.originalimage && { ...s.originalimage, source: bare(s.originalimage.source) }
    const thumb = s.thumbnail && { ...s.thumbnail, source: bare(s.thumbnail.source) }
    // small enough: the picture itself (a drawing comes as its PNG); big: its copy 960 pixels wide
    const url = original && original.width <= STEP * 1.5 && !/\.svg$/i.test(original.source) ? original.source
      : thumb ? thumb.source.replace(/\/\d+px-/, `/${STEP}px-`) : ''
    return PICTURE_URL.test(url) ? url : null
  } catch {
    return null
  }
}

/** The slides with their `wiki:` pictures found (or left out). */
export async function withWikiPictures(markdown: string, get: typeof fetch = fetch): Promise<string> {
  const asked = [...new Set([...markdown.matchAll(WIKI)].map((m) => m[2].trim()))].slice(0, MAX)
  if (!asked.length) return markdown
  const found = new Map(await Promise.all(asked.map(async (t) => [t, await wikiPicture(t, get)] as const)))
  return markdown.replace(WIKI, (_, caption: string, title: string) => {
    const url = found.get(title.trim())
    return url ? `![${caption.trim()}](${url})` : ''
  }).replace(/\n{3,}/g, '\n\n')
}

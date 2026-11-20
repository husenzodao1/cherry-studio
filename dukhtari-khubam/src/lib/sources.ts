/** Where a resource comes from: the link in a source text and the site it belongs to (SourceChip.tsx). */

export type BrandKey = 'google' | 'youtube' | 'instagram' | 'telegram' | 'facebook' | 'wikipedia' | 'tiktok' | 'x' | 'whatsapp' | 'vk' | 'pinterest'

const BRANDS: [RegExp, BrandKey, string][] = [
  [/(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$/, 'google', 'Google'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube', 'YouTube'],
  [/(^|\.)(instagram\.com|instagr\.am)$/, 'instagram', 'Instagram'],
  [/(^|\.)(t\.me|telegram\.(org|me))$/, 'telegram', 'Telegram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook', 'Facebook'],
  [/(^|\.)wikipedia\.org$/, 'wikipedia', 'Wikipedia'],
  [/(^|\.)tiktok\.com$/, 'tiktok', 'TikTok'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'x', 'X'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp', 'WhatsApp'],
  [/(^|\.)(vk\.com|vk\.ru)$/, 'vk', 'VK'],
  [/(^|\.)pinterest\.[a-z.]+$/, 'pinterest', 'Pinterest']
]

/** The first link in any of the texts. */
export function linkOf(...values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    const m = v?.match(/https?:\/\/[^\s"'<>]+/i)
    if (m) return m[0]
  }
  return null
}

/** The site's host without "www.". */
export function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return url }
}

/** A known site (Google, YouTube, Instagram…) for a link, or null. */
export function brandOf(url: string | null): { key: BrandKey; name: string } | null {
  if (!url) return null
  const host = hostOf(url)
  const hit = BRANDS.find(([re]) => re.test(host))
  return hit ? { key: hit[1], name: hit[2] } : null
}

/** What a source chip says: the site's name, else the source's own title, else the link's host. */
export function sourceLabel(title: string | null | undefined, url: string | null | undefined): { label: string | null; link: string | null; brand: BrandKey | null } {
  const link = url || linkOf(title)
  const brand = brandOf(link)
  const text = title && !/^https?:\/\//i.test(title.trim()) ? title.trim() : null
  return { label: brand?.name ?? text ?? (link ? hostOf(link) : null), link, brand: brand?.key ?? null }
}

/** Pictures show in two frames only: wide (16:9, like a video) or square (1:1), whichever is nearer. */
export const frameOf = (ratio: number | null): '16 / 9' | '1 / 1' => (ratio === null || ratio >= 1.2 ? '16 / 9' : '1 / 1')

/** What the study tools (flashcards, podcasts) are made from: a lesson's words, or a photo made smaller. */

/** the words of a lesson (its blocks' texts), for the AI */
export function lessonText(blocks: unknown, cap = 30_000): string {
  const out: string[] = []
  const walk = (x: unknown, key?: string) => {
    if (typeof x === 'string') { if (x.length > 15 && !/^(id|type|url|src|href|asset_id|variant|kind)$/.test(key ?? '')) out.push(x) }
    else if (Array.isArray(x)) x.forEach((v) => walk(v, key))
    else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) walk(v, k)
  }
  walk(blocks)
  return out.join('\n').slice(0, cap)
}

/** a photo as JPEG base64, its longest side at most 1600 px (enough for print and handwriting) */
export async function photoData(file: File, side = 1600): Promise<{ mime: string; data: string; url: string }> {
  const bitmap = await createImageBitmap(file)
  const k = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bitmap.width * k)
  c.height = Math.round(bitmap.height * k)
  c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height)
  const url = c.toDataURL('image/jpeg', 0.85)
  return { mime: 'image/jpeg', data: url.slice(url.indexOf(',') + 1), url }
}

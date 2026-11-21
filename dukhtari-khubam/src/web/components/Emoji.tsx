import { Fragment, type ReactNode } from 'react'

import NAMES from '@/lib/emojiNames.json'

/**
 * The chat's own emoji (like a messenger's): Microsoft's Fluent 3D emoji (MIT, public/assets/emoji), the
 * same on every phone, instead of the phone's. A skin-toned emoji is shown in its base colour; an emoji
 * the set does not have stays the phone's.
 */

const KNOWN = new Set<string>(NAMES)

/** one emoji: a flag, a keycap, or a picture with its variation, skin tone and joined parts */
export const EMOJI_RE = /\p{Regional_Indicator}{2}|[#*0-9]️?⃣|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*/gu

/** the picture's file name for an emoji, or null when the set does not have it */
export function emojiName(emoji: string): string | null {
  const cps = [...emoji].map((c) => c.codePointAt(0)!.toString(16)).filter((c) => !/^1f3f[b-f]$/.test(c))
  const full = cps.join('-')
  if (KNOWN.has(full)) return full
  const bare = cps.filter((c) => c !== 'fe0f').join('-')
  if (KNOWN.has(bare)) return bare
  const marked = [bare.split('-')[0], 'fe0f', ...bare.split('-').slice(1)].join('-')
  return KNOWN.has(marked) ? marked : null
}

export const emojiSrc = (name: string) => `/assets/emoji/${name}.webp`

/** Text with its emoji as the chat's own pictures (the emoji stays its alt text: copied, it is the emoji). */
export function emojify(text: string): ReactNode {
  if (!text || !/\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u.test(text)) return text
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(EMOJI_RE)) {
    const name = emojiName(m[0])
    if (!name) continue
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(<img key={m.index} className="emo" src={emojiSrc(name)} alt={m[0]} draggable={false} decoding="async" />)
    last = m.index + m[0].length
  }
  if (!out.length) return text
  if (last < text.length) out.push(text.slice(last))
  return <Fragment>{out}</Fragment>
}

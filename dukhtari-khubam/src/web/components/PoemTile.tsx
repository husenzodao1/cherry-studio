'use client'

import { useLayoutEffect, useRef } from 'react'

import { useContent } from '../offline/content'
import { lines } from '../offline/notify'
import { usePrefs } from '../prefs'

/**
 * "Гулбоғи эҷод" — a poem from the panel on a soft gradient of the theme, in a literary italic: each line
 * of verse on its own row (the size shrinks until the longest line fits), the poet at the bottom right.
 * A different poem each day when the panel has several.
 */
export function PoemTile({ long = false }: { long?: boolean }) {
  const { t } = usePrefs()
  const { bundle } = useContent()
  const poems = bundle?.poems ?? []
  const day = Math.floor(Date.now() / 86_400_000)
  const poem = poems.length ? poems[day % poems.length] : null
  const box = useRef<HTMLDivElement>(null)
  const verse = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = box.current
    const v = verse.current
    if (!el || !v) return
    const fit = () => {
      if (!el.clientWidth || !el.clientHeight) return
      let size = 17
      v.style.fontSize = `${size}px`
      while (size > 8.5 && (v.scrollWidth > el.clientWidth + 0.5 || v.scrollHeight > el.clientHeight + 0.5)) {
        size -= 0.5
        v.style.fontSize = `${size}px`
      }
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    document.fonts?.ready.then(fit).catch(() => undefined)
    return () => ro.disconnect()
  }, [poem?.body])

  return (
    <figure className={`poem-tile${long ? ' tile-long' : ''}`} aria-label={t('poem.title')}>
      <span className="poem-label">{t('poem.title')}</span>
      {poem?.source_title ? <span className="poem-title">{poem.source_title}</span> : null}
      <div ref={box} className="poem-box">
        <div ref={verse} className="poem-verse">
          {(poem ? lines(poem.body) : [t('home.quote')]).map((l, i) => <span key={i} className="poem-line" style={{ ['--i' as string]: i }}>{l}</span>)}
        </div>
      </div>
      {poem?.author_name ? <figcaption className="poem-author">— {poem.author_name}</figcaption> : null}
    </figure>
  )
}

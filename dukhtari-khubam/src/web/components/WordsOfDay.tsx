'use client'

import { useEffect, useState } from 'react'

import { useContent } from '../offline/content'
import { usePrefs } from '../prefs'

const EVERY_MS = 3600

/**
 * "Words of the day" on the home screen: the newest inspirations from the panel, one at a time on a soft
 * gradient with small 3D shapes, handwritten; every few seconds the words slide away to the side and the
 * next ones come in. With none published yet, the app's own line is shown.
 */
export function WordsOfDay() {
  const { t } = usePrefs()
  const { bundle } = useContent()
  const items = bundle?.inspirations?.length ? bundle.inspirations
    : bundle?.inspiration ? [bundle.inspiration] : [{ body: t('home.quote'), author_name: null, source_title: null }]
  const [at, setAt] = useState(0)
  const count = items.length

  useEffect(() => {
    setAt(0)
    if (count < 2) return
    const timer = setInterval(() => {
      if (!document.hidden) setAt((n) => (n + 1) % count)
    }, EVERY_MS)
    return () => clearInterval(timer)
  }, [count])

  const prev = (at - 1 + count) % count
  return (
    <section className="words" aria-roledescription="carousel" aria-label={t('home.words')}>
      <img className="words-art" src="/assets/3d/words-band.webp" alt="" aria-hidden="true" decoding="async" />
      <span className="words-label">{t('home.words')}</span>
      <div className="words-track" aria-live="polite">
        {items.map((q, n) => (
          <figure key={n} className={`words-item${n === at ? ' is-in' : count > 1 && n === prev ? ' is-out' : ''}`} aria-hidden={n !== at}>
            <blockquote>{q.body}</blockquote>
            {q.author_name ? <figcaption>— {q.author_name}{q.source_title ? `, ${q.source_title}` : ''}</figcaption> : null}
          </figure>
        ))}
      </div>
      {count > 1 ? <div className="words-dots" aria-hidden="true">{items.map((_, n) => <span key={n} className={n === at ? 'is-on' : ''} />)}</div> : null}
    </section>
  )
}

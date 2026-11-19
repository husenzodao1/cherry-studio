'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useContent } from '../offline/content'
import { usePrefs } from '../prefs'
import { Hanger } from './Hanger'

/** How long short words stay before the next ones come in. */
const STAY_MS = 4200
/** Long words in one moving line: a pause, the slide at this speed, a pause at the end. */
const PAUSE_MS = 1300
const SPEED_PX_S = 46
/** Font sizes tried, largest first, before long words move sideways in one line. */
const SIZES = [1.45, 1.28, 1.14, 1.02]

interface Fit { size: number; slide: number }

/**
 * One quote. It takes the largest size at which it fits above its author line; if even the smallest
 * does not fit, it becomes one line that slides to the side so every word is read. Calls `onTime` with
 * how long it needs on screen.
 */
function Quote({ body, author, active, onTime }: { body: string; author: string | null; active: boolean; onTime: (ms: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLQuoteElement>(null)
  const [fit, setFit] = useState<Fit>({ size: SIZES[0], slide: 0 })

  useLayoutEffect(() => {
    const el = box.current
    const q = text.current
    if (!el || !q) return
    const measure = () => {
      if (!el.clientHeight || !el.clientWidth) return
      q.classList.remove('is-line')
      for (const size of SIZES) {
        q.style.fontSize = `${size}rem`
        if (q.scrollHeight <= el.clientHeight + 1) {
          setFit({ size, slide: 0 })
          return
        }
      }
      const size = SIZES[1]
      q.style.fontSize = `${size}rem`
      q.classList.add('is-line')
      const pad = getComputedStyle(el)
      const room = el.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight)
      setFit({ size, slide: Math.max(0, Math.ceil(q.scrollWidth - room)) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    document.fonts?.ready.then(measure).catch(() => undefined)
    return () => ro.disconnect()
  }, [body])

  const travel = fit.slide ? Math.round((fit.slide / SPEED_PX_S) * 1000) : 0
  useEffect(() => {
    if (active) onTime(fit.slide ? PAUSE_MS + travel + PAUSE_MS : STAY_MS)
  }, [active, fit.slide, travel, onTime])

  return (
    <>
      <div ref={box} className="words-text">
        <blockquote ref={text} className={fit.slide ? 'is-line' : undefined}
          style={{ fontSize: `${fit.size}rem`, ...(fit.slide ? { ['--slide' as string]: `-${fit.slide}px`, ['--travel' as string]: `${travel}ms` } : {}) }}
          data-moving={active && fit.slide ? '' : undefined}>
          {body}
        </blockquote>
      </div>
      {author ? <figcaption>— {author}</figcaption> : null}
    </>
  )
}

/**
 * "Words of the day" on the home screen: the newest inspirations from the panel, one at a time on a pane
 * of glass hung on the wall by a ribbon bow (it swings when the phone is shaken), handwritten; the words slide away to the side and the next ones come
 * in. Long words never hide under the author: they get smaller, and very long ones move sideways in one
 * line until the end has been read. With none published yet, the app's own line is shown.
 */
export function WordsOfDay() {
  const { t } = usePrefs()
  const { bundle } = useContent()
  const items = bundle?.inspirations?.length ? bundle.inspirations
    : bundle?.inspiration ? [bundle.inspiration] : [{ body: t('home.quote'), author_name: null, source_title: null }]
  const [at, setAt] = useState(0)
  const [stay, setStay] = useState(STAY_MS)
  const count = items.length
  const key = items.map((q) => q.body).join('\u0000')

  useEffect(() => setAt(0), [key])
  useEffect(() => {
    if (count < 2) return
    const timer = setTimeout(function next() {
      if (document.hidden) return void setTimeout(next, 1000)
      setAt((n) => (n + 1) % count)
    }, stay)
    return () => clearTimeout(timer)
  }, [at, count, stay])

  const prev = (at - 1 + count) % count
  return (
    <Hanger className="words-hanger">
    <section className="words" aria-roledescription="carousel" aria-label={t('home.words')}>
      <div className="words-track" aria-live="polite">
        {items.map((q, n) => (
          <figure key={n} className={`words-item${n === at ? ' is-in' : count > 1 && n === prev ? ' is-out' : ''}`} aria-hidden={n !== at}>
            <Quote body={q.body} active={n === at} onTime={setStay}
              author={q.author_name ? `${q.author_name}${q.source_title ? `, ${q.source_title}` : ''}` : null} />
          </figure>
        ))}
      </div>
      {count > 1 ? <div className="words-dots" aria-hidden="true">{items.map((_, n) => <span key={n} className={n === at ? 'is-on' : ''} />)}</div> : null}
    </section>
    </Hanger>
  )
}

'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { fitQuote, type Fit, LINE_HEIGHT, LINES, SIZES } from '@/lib/wordsFit'
import { useContent } from '../offline/content'
import { usePrefs } from '../prefs'

/** How long words that fit stay before the next ones come in. */
const STAY_MS = 4200
/** Long words scroll upward slowly: a pause to read the first lines, the scroll, a pause at the end. */
const START_MS = 2600
const END_MS = 2800
const SPEED_PX_S = 9
/** After the finger lets go, the words wait this long before they go on by themselves. */
const IDLE_MS = 1500
/** Held by a finger: the quote stays (the next one waits) until it is let go. */
const HELD_MS = 10 * 60_000

/**
 * One quote. Line breaks are kept, so a poem keeps its lines. It takes the largest size at which it
 * fits in four lines above its author; a longer one shows four lines and slowly scrolls upward by
 * itself — a finger can scroll it too, up or down, and it goes on from there once let go. Once the
 * first lines have moved up, the top line is shaded, so it is clear the beginning is above.
 * Calls `onTime` with how long it needs on screen.
 */
function Quote({ body, author, active, onTime }: { body: string; author: string | null; active: boolean; onTime: (ms: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLQuoteElement>(null)
  const [fit, setFit] = useState<Fit>({ size: SIZES[0], rise: 0 })

  useLayoutEffect(() => {
    const el = box.current
    const q = text.current
    if (!el || !q) return
    const measure = () => {
      const item = el.parentElement
      if (!item?.clientHeight || !el.clientWidth) return
      const caption = item.querySelector('figcaption')
      const room = item.clientHeight - (caption ? caption.getBoundingClientRect().height + 4 : 0)
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const heightAt = (size: number) => { q.style.fontSize = `${size}rem`; return q.scrollHeight }
      const next = fitQuote(heightAt, room, rem)
      q.style.fontSize = `${next.size}rem`
      setFit((f) => (f.size === next.size && f.rise === next.rise ? f : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el.parentElement ?? el)
    document.fonts?.ready.then(measure).catch(() => undefined)
    return () => ro.disconnect()
  }, [body, author])

  useEffect(() => {
    if (active && !fit.rise) onTime(STAY_MS)
  }, [active, fit.rise, onTime])

  // the slow scroll upward, which a finger can take over at any moment
  useEffect(() => {
    const el = box.current
    if (!el || !fit.rise) return
    const shade = () => {
      el.classList.toggle('at-top', el.scrollTop < 2)
      el.classList.toggle('at-end', el.scrollTop >= el.scrollHeight - el.clientHeight - 2)
    }
    el.scrollTop = 0
    shade()
    if (!active) return
    const end = () => el.scrollHeight - el.clientHeight
    const left = () => Math.max(0, ((end() - el.scrollTop) / SPEED_PX_S) * 1000)
    let raf = 0
    let last = 0
    let pos = 0
    let held = false
    const step = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      last = now
      pos = Math.min(end(), pos + SPEED_PX_S * dt)
      el.scrollTop = pos
      if (pos < end()) raf = requestAnimationFrame(step)
    }
    const go = () => { cancelAnimationFrame(raf); last = 0; pos = el.scrollTop; raf = requestAnimationFrame(step) }
    let wait = setTimeout(go, START_MS)
    onTime(START_MS + left() + END_MS)
    const hold = () => {
      if (held) return
      held = true
      cancelAnimationFrame(raf)
      clearTimeout(wait)
      onTime(HELD_MS)
    }
    const letGo = () => {
      if (!held) return
      clearTimeout(wait)
      wait = setTimeout(() => {
        held = false
        onTime(left() + END_MS + IDLE_MS)
        go()
      }, IDLE_MS)
    }
    const wheel = () => { hold(); letGo() }
    el.addEventListener('scroll', shade, { passive: true })
    el.addEventListener('touchstart', hold, { passive: true })
    el.addEventListener('pointerdown', hold)
    el.addEventListener('touchend', letGo)
    el.addEventListener('touchcancel', letGo)
    el.addEventListener('pointerup', letGo)
    el.addEventListener('pointercancel', letGo)
    el.addEventListener('wheel', wheel, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(wait)
      el.removeEventListener('scroll', shade)
      el.removeEventListener('touchstart', hold)
      el.removeEventListener('pointerdown', hold)
      el.removeEventListener('touchend', letGo)
      el.removeEventListener('touchcancel', letGo)
      el.removeEventListener('pointerup', letGo)
      el.removeEventListener('pointercancel', letGo)
      el.removeEventListener('wheel', wheel)
    }
  }, [active, fit.rise, fit.size, onTime])

  return (
    <>
      <div ref={box} className={`words-text${fit.rise ? ' is-rising at-top' : ''}`}
        style={fit.rise ? { height: `${LINES * LINE_HEIGHT * fit.size}rem` } : undefined}>
        <blockquote ref={text} style={{ fontSize: `${fit.size}rem` }}>
          {body.trim()}
        </blockquote>
      </div>
      {author ? <figcaption>— {author}</figcaption> : null}
    </>
  )
}

/**
 * "Words of the day" on the home screen: the newest inspirations from the panel, one at a time on a soft
 * gradient, handwritten; the words slide away to the side and the next ones come
 * in. Up to four lines are shown; long words never hide under the author: they get smaller, and longer
 * ones (a whole poem) scroll upward line by line until the end has been read. With none published yet, the app's own line is shown.
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
    <section className="words" aria-roledescription="carousel" aria-label={t('home.words')}>
      <span className="words-label">{t('home.words')}</span>
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
  )
}

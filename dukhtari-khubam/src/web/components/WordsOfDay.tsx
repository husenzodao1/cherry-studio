'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { fitQuote, type Fit, SIZES, windowRem } from '@/lib/wordsFit'
import { useContent } from '../offline/content'
import { apiUrl } from '../offline/base'
import { usePrefs } from '../prefs'

/** words meant for girls (Tajik, Russian, English): not shown to a boy */
export const GIRLS_WORDS = /(духтар|дугона|малика|нозанин|зебоям|гулрӯ|моҳрӯ|бону|девуш|девоч|подруг|красав|лунолик|принцесс|невест|\bgirl|princess|💕|🌸|🎀|💖|🌷)/i

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
function Quote({ body, author, source, active, onTime }: { body: string; author: string | null; source: string | null; active: boolean; onTime: (ms: number) => void }) {
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
      // a poem (its own line breaks) keeps each line on one line: the size shrinks until the longest fits
      q.classList.remove('is-wrapped')
      const poem = body.includes('\n')
      const fitsWidth = (size: number) => { q.style.fontSize = `${size}rem`; return !poem || q.scrollWidth <= q.clientWidth + 1 }
      let next = fitQuote(heightAt, room, rem, fitsWidth)
      // a line too long even at the smallest size (a narrow phone, a long translation): the poem's lines
      // may wrap, rather than be cut at the card's edge
      if (poem && !fitsWidth(next.size)) {
        q.classList.add('is-wrapped')
        next = fitQuote(heightAt, room, rem)
      }
      q.style.fontSize = `${next.size}rem`
      setFit((f) => (f.size === next.size && f.rise === next.rise ? f : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el.parentElement ?? el)
    document.fonts?.ready.then(measure).catch(() => undefined)
    return () => ro.disconnect()
  }, [body, author, source])

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
        style={fit.rise ? { height: `${windowRem(fit.size)}rem` } : undefined}>
        <blockquote ref={text} className={body.includes('\n') ? 'is-poem' : undefined} style={{ fontSize: `${fit.size}rem` }}>
          {body.trim()}
        </blockquote>
      </div>
      {/* who said it and where, under a thin line */}
      {author || source ? <figcaption><span>{source ?? ''}</span><b>{author ?? ''}</b></figcaption> : null}
    </>
  )
}

/**
 * "Words of the day" on the home screen: the newest inspirations from the panel, one at a time on a soft
 * gradient, handwritten; the words slide away to the side and the next ones come
 * in. Up to four lines are shown; long words never hide under the author: they get smaller, and longer
 * ones (a whole poem) scroll upward line by line until the end has been read. With none published yet, the app's own line is shown.
 */
/** a piece of news from the panel: its picture, title and words */
interface News { id: string; title: string; body: string; image: string | null; at: string }
const NEWS_KEY = 'dk.news'
const SHOW_KEY = 'dk.words-show'

/** the news in her language (kept on the phone for when it is offline) */
function useNews(on: boolean, locale: string, boys: boolean): News[] | null {
  const [items, setItems] = useState<News[] | null>(null)
  useEffect(() => {
    if (!on) return
    try { const kept = JSON.parse(localStorage.getItem(NEWS_KEY) ?? 'null') as { locale: string; items: News[] } | null; if (kept?.locale === locale) setItems(kept.items) } catch { /* none kept */ }
    let alive = true
    fetch(apiUrl(`/news?locale=${locale}&audience=${boys ? 'boys' : 'girls'}`)).then((r) => (r.ok ? r.json() as Promise<{ items: News[] }> : null)).then((d) => {
      if (!alive || !d) return
      setItems(d.items)
      try { localStorage.setItem(NEWS_KEY, JSON.stringify({ locale, items: d.items })) } catch { /* only for now */ }
    }).catch(() => setItems((x) => x ?? []))
    return () => { alive = false }
  }, [on, locale, boys])
  return items
}

/**
 * The block's other side: the news. Each with its picture over the whole card and, at the bottom over a soft
 * shadow, its title and its words (they scroll when long); one after another, as the words of the day.
 */
function NewsTrack({ items }: { items: News[] }) {
  const { t } = usePrefs()
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)
  const count = items.length
  useEffect(() => setAt(0), [count])
  useEffect(() => {
    if (count < 2 || held) return
    const timer = setTimeout(() => setAt((n) => (n + 1) % count), 7000)
    return () => clearTimeout(timer)
  }, [at, count, held])
  if (!count) return <p className="news-empty">{t('home.news_none')}</p>
  return (
    <>
      <div className="news-track" onPointerDown={() => setHeld(true)} onPointerUp={() => setTimeout(() => setHeld(false), 6000)}>
        {items.map((n, i) => (
          <article key={n.id} className={`news-item${i === at ? ' is-in' : ''}${n.image ? ' has-image' : ''}`} aria-hidden={i !== at}>
            {n.image ? <img src={n.image} alt="" loading={i < 2 ? 'eager' : 'lazy'} decoding="async" /> : null}
            <div className="news-info">
              <b>{n.title}</b>
              {n.body ? <p>{n.body}</p> : null}
            </div>
          </article>
        ))}
      </div>
      {count > 1 ? <div className="words-dots" aria-hidden="true">{items.map((n, i) => <span key={n.id} className={i === at ? 'is-on' : ''} />)}</div> : null}
    </>
  )
}

export function WordsOfDay() {
  const { t, mode, locale } = usePrefs()
  // the small switch at the left of the title: the words of the day, or the news (kept on the phone)
  const [news, setNewsState] = useState(false)
  useEffect(() => { try { setNewsState(localStorage.getItem(SHOW_KEY) === 'news') } catch { /* words */ } }, [])
  const setNews = (on: boolean) => {
    setNewsState(on)
    try { localStorage.setItem(SHOW_KEY, on ? 'news' : 'words') } catch { /* only for now */ }
  }
  const newsItems = useNews(news, locale, mode === 'boy')
  const { bundle } = useContent()
  const all = bundle?.inspirations?.length ? bundle.inspirations : bundle?.inspiration ? [bundle.inspiration] : []
  // boys' mode: words written to or about girls (beauties, moon-faced ones, flowers, a girl's pride) are left out
  const shown = mode === 'boy' ? all.filter((q) => !GIRLS_WORDS.test(q.body)) : all
  const items = shown.length ? shown : [{ body: t('home.quote'), author_name: null, source_title: null }]
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
  const toggle = (
    <button type="button" role="switch" aria-checked={news} className={`words-switch${news ? ' is-news' : ''}`} aria-label={t('home.news')} onClick={() => setNews(!news)}>
      <span aria-hidden="true" />
    </button>
  )
  if (news) {
    return (
      <section className="words is-news" aria-roledescription="carousel" aria-label={t('home.news')}>
        <span className="words-label">{toggle}{t('home.news')}</span>
        {newsItems === null ? <div className="news-track skeleton" /> : <NewsTrack items={newsItems} />}
      </section>
    )
  }
  return (
    <section className="words" aria-roledescription="carousel" aria-label={t('home.words')}>
      <span className="words-label">{toggle}{t('home.words')}</span>
      <div className="words-track" aria-live="polite">
        {items.map((q, n) => (
          <figure key={n} className={`words-item${n === at ? ' is-in' : count > 1 && n === prev ? ' is-out' : ''}`} aria-hidden={n !== at}>
            <Quote body={q.body} active={n === at} onTime={setStay} author={q.author_name || null} source={q.source_title || null} />
          </figure>
        ))}
      </div>
      {count > 1 ? <div className="words-dots" aria-hidden="true">{items.map((_, n) => <span key={n} className={n === at ? 'is-on' : ''} />)}</div> : null}
    </section>
  )
}

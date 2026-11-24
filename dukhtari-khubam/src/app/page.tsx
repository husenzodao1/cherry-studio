'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ART } from '@/web/art'
import { Avatar } from '@/web/components/Header'
import { TryAlso } from '@/web/components/TryAlso'
import { Icon } from '@/web/components/Icon'
import { InstallButton } from '@/web/components/InstallButton'
import { RainDrop } from '@/web/components/RainDrop'
import { StreakBadge } from '@/web/components/StreakBadge'
import { SchoolRow } from '@/web/components/SchoolTile'
import { Empty, Skeleton } from '@/web/components/States'
import { WordsOfDay } from '@/web/components/WordsOfDay'
import { useContent } from '@/web/offline/content'
import { useLearner } from '@/web/offline/learner'
import { reviewStats } from '@/web/offline/review'
import { usePrefs } from '@/web/prefs'
import type { UiKey } from '@/web/i18n'
import { emojify } from '@/web/components/Emoji'

/** Greeting by the phone's clock: morning, day, evening, night. */
function greetingKey(h: number): UiKey {
  return h >= 5 && h < 11 ? 'greet.morning' : h >= 11 && h < 17 ? 'greet.day' : h >= 17 && h < 22 ? 'greet.evening' : 'greet.night'
}

/** Search: a lens and its handle, drawn separately so the entrance can draw the ring, then the handle. */
function SearchGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true" focusable="false">
      <circle className="g-lens" cx="11" cy="11" r="7" pathLength={1} />
      <path className="g-handle" d="M16.2 16.2 20 20" pathLength={1} />
    </svg>
  )
}

/** The menu's three dots, each its own shape so they can pop in one after another. */
function MoreGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle className="g-dot" cx="5.5" cy="12" r="1.7" />
      <circle className="g-dot" cx="12" cy="12" r="1.7" />
      <circle className="g-dot" cx="18.5" cy="12" r="1.7" />
    </svg>
  )
}

/**
 * The big line of the home screen: its letters hop one after another, softly, then it rests for a few
 * seconds and the wave runs again. Words never break inside.
 */
function WaveText({ text }: { text: string }) {
  let n = 0
  return (
    <span className="wave" aria-label={text}>
      {text.split(/(\s+)/).map((word, w) => (/^\s+$/.test(word) ? ' ' : (
        <span key={w} className="wave-word" aria-hidden="true">
          {[...word].map((ch, i) => <span key={i} className="wave-ch" style={{ ['--i' as string]: n++ }}>{ch}</span>)}
        </span>
      )))}
    </span>
  )
}

export default function Home() {
  const { t, mode } = usePrefs()
  const { bundle, loading, offlineEmpty } = useContent()
  const { learner, progress } = useLearner()
  const [hour, setHour] = useState<number | null>(null)
  useEffect(() => {
    setHour(new Date().getHours())
    const timer = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(timer)
  }, [])
  // the home screen stands still while it all fits above the tab bar (only the row of schools moves,
  // sideways); once more comes in (the day's review) it grows and scrolls, and nothing hides under the bar
  const home = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = document.documentElement
    const el = home.current
    if (!el) return
    const check = () => root.classList.toggle('still', el.offsetHeight <= (parseFloat(getComputedStyle(el).minHeight) || 0) + 1)
    // after the frame: changing the page's layout inside the observer's own call would loop it
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(check)
    })
    ro.observe(el)
    check()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      root.classList.remove('still')
    }
  }, [])

  const flower = useRef<HTMLImageElement>(null)
  const name = learner?.name
  const review = useMemo(() => (bundle ? reviewStats(bundle, progress) : { total: 0, today: 0 }), [bundle, progress])
  const lastLesson = progress.last ? bundle?.lessons[progress.last.lesson] : undefined
  const cont = lastLesson && !progress.lessons[lastLesson.id]?.done ? lastLesson : null

  return (
    <div ref={home} className="home">
      {/* boys' mode: a diamond instead of the flower, and no raindrop on it */}
      {mode === 'boy' ? null : <RainDrop flower={flower} />}
      <header className="home-top">
        <Link href="/profile" className="home-avatar" aria-label={t('nav.profile')}><Avatar name={name} /></Link>
        <StreakBadge />
        <span style={{ flex: 1 }} />
        <InstallButton />
        <Link href="/search" className="icon-btn search-btn" aria-label={t('action.search')}><SearchGlyph /></Link>
        <Link href="/settings" className="icon-btn more-btn" aria-label={t('settings.title')}><MoreGlyph /></Link>
      </header>

      <section className="hello">
        <div className="hello-text">
          <p className="greet">{hour === null ? ' ' : `${t(greetingKey(hour))}${name ? `, ${name}` : ''}!`}</p>
          <h1 className="h-hero motto"><WaveText text={t('home.motto')} />{'\u00a0'}<span className="bf-anchor" aria-hidden="true" /></h1>
        </div>
        {mode === 'boy'
          // boys' mode: a real diamond, turning slowly where the flower stands for girls
          ? <span className="hello-diamond bloom-in" aria-hidden="true"><i /></span>
          : <img ref={flower} className="hello-flower bloom-in" src={ART.flower.src} alt="" aria-hidden="true" decoding="async" />}
      </section>

      {cont ? (
        <Link href={`/lesson?id=${cont.id}`} className="glass pill-card">
          <img src={ART.book.src} alt="" aria-hidden="true" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{t('home.continue_course')}</b>
            <span className="sub">{emojify(cont.context.course.title)} · {emojify(cont.title)}</span>
          </span>
          <span className="play-btn play-nudge" aria-hidden="true"><Icon name="play" size={20} fill="currentColor" /></span>
        </Link>
      ) : (
        <Link href="/schools" className="glass pill-card">
          <img src={ART.book.src} alt="" aria-hidden="true" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{t('home.start_learning')}</b>
            <span className="sub">{t('home.choose_school')}</span>
          </span>
          <span className="play-btn play-nudge" aria-hidden="true"><Icon name="play" size={20} fill="currentColor" /></span>
        </Link>
      )}

      {review.total ? (
        <Link href="/review" className="glass pill-card review-pill">
          <span className="review-icon" aria-hidden="true"><Icon name={review.today ? 'sparkle' : 'check'} size={24} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{t('review.title')}</b>
            <span className="sub">{review.today ? t('review.count').replace('{n}', String(review.today)) : t('review.done_today')}</span>
          </span>
          {review.today ? <span className="review-badge">{review.today}</span> : null}
        </Link>
      ) : null}

      <TryAlso />

      <WordsOfDay />

      <section className="home-schools">
        <div className="section-head">
          <h2 className="h-section">{t('home.seven_schools')}</h2>
          <Link href="/schools">{t('home.all')} <Icon name="arrow" size={14} /></Link>
        </div>
        {bundle ? (
          <SchoolRow schools={bundle.schools} />
        ) : offlineEmpty ? <Empty icon="info" title={t('state.offline_empty')} /> : loading ? (
          <div className="school-row">{Array.from({ length: 3 }, (_, i) => <div key={i} className="school-row-item"><Skeleton height={112} radius={22} /></div>)}</div>
        ) : null}
      </section>
    </div>
  )
}

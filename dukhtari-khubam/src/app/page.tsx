'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ART } from '@/web/art'
import { Avatar } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { SchoolTile } from '@/web/components/SchoolTile'
import { Empty, Skeleton } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'
import type { UiKey } from '@/web/i18n'

/** Greeting by the phone's clock: morning, day, evening, night. */
function greetingKey(h: number): UiKey {
  return h >= 5 && h < 11 ? 'greet.morning' : h >= 11 && h < 17 ? 'greet.day' : h >= 17 && h < 22 ? 'greet.evening' : 'greet.night'
}

export default function Home() {
  const { t } = usePrefs()
  const { bundle, loading, offlineEmpty } = useContent()
  const { learner, progress } = useLearner()
  const [hour, setHour] = useState<number | null>(null)
  useEffect(() => {
    setHour(new Date().getHours())
    const timer = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const name = learner?.name
  const inspiration = bundle?.inspiration ?? null
  const lastLesson = progress.last ? bundle?.lessons[progress.last.lesson] : undefined
  const cont = lastLesson && !progress.lessons[lastLesson.id]?.done ? lastLesson : null

  return (
    <>
      <header className="home-top">
        <Link href="/profile" aria-label={t('nav.profile')}><Avatar name={name} /></Link>
        <span style={{ flex: 1 }} />
        <Link href="/search" className="icon-btn" aria-label={t('action.search')}><Icon name="search" /></Link>
        <Link href="/settings" className="icon-btn" aria-label={t('settings.title')}><Icon name="more" /></Link>
      </header>

      <section className="hello">
        <div className="hello-text">
          <p className="greet">{hour === null ? ' ' : `${t(greetingKey(hour))}${name ? `, ${name}` : ''}!`}</p>
          <h1 className="h-hero">{t('home.motto')} <span aria-hidden="true">💜</span></h1>
        </div>
        <img className="hello-flower bloom-in" src={ART.flower.src} alt="" aria-hidden="true" decoding="async" />
      </section>

      {cont ? (
        <Link href={`/lesson?id=${cont.id}`} className="glass pill-card">
          <img src={ART.book.src} alt="" aria-hidden="true" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{t('home.continue_course')}</b>
            <span className="sub">{cont.context.course.title} · {cont.title}</span>
          </span>
          <span className="play-btn" aria-hidden="true"><Icon name="play" size={20} fill="currentColor" /></span>
        </Link>
      ) : (
        <Link href="/schools" className="glass pill-card">
          <img src={ART.book.src} alt="" aria-hidden="true" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{t('home.start_learning')}</b>
            <span className="sub">{t('home.choose_school')}</span>
          </span>
          <span className="play-btn" aria-hidden="true"><Icon name="play" size={20} fill="currentColor" /></span>
        </Link>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="h-section">{t('home.seven_schools')}</h2>
          <Link href="/schools">{t('home.all')} <Icon name="arrow" size={14} /></Link>
        </div>
        {bundle ? (
          <div className="tile-grid stagger">{bundle.schools.map((s) => <SchoolTile key={s.id} school={s} />)}</div>
        ) : offlineEmpty ? <Empty icon="info" title={t('state.offline_empty')} /> : loading ? (
          <div className="tile-grid">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={104} radius={22} />)}</div>
        ) : null}
      </section>

      <section className="section">
        <figure className="glass quote-card" style={{ margin: 0 }} aria-label={t('home.inspiration')}>
          <span className="quote-mark" aria-hidden="true">“ ”</span>
          <p>{inspiration?.body ?? t('home.quote')}</p>
          {inspiration && (inspiration.author_name || inspiration.source_title) ? (
            <figcaption className="who">— {[inspiration.author_name, inspiration.source_title].filter(Boolean).join(', ')}</figcaption>
          ) : null}
          <img className="quote-flower float-slow" src={ART.flowerSide.src} alt="" aria-hidden="true" decoding="async" />
        </figure>
      </section>
    </>
  )
}

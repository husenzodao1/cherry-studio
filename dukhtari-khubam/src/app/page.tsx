'use client'

import Link from 'next/link'

import { Icon } from '@/web/components/Icon'
import { SchoolCard } from '@/web/components/SchoolCard'
import { Skeleton } from '@/web/components/States'
import { GlassScene } from '@/web/glass/LazyGlassScene'
import { LiquidGlass } from '@/web/glass/LiquidGlass'
import { useContent } from '@/web/offline/content'
import { useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'
import { ART } from '@/web/art'

export default function Home() {
  const { t } = usePrefs()
  const { bundle, loading, offlineEmpty } = useContent()
  const { learner, progress } = useLearner()
  const name = learner?.name
  const inspiration = bundle?.inspiration ?? null
  const lastLesson = progress.last ? bundle?.lessons[progress.last.lesson] : undefined
  const cont = lastLesson && !progress.lessons[lastLesson.id]?.done
    ? { lesson_id: lastLesson.id, title: lastLesson.title, percent: progress.lessons[lastLesson.id]?.p ?? 0, course: lastLesson.context.course }
    : null

  return (
    <>
      <header className="topbar">
        <div style={{ flex: 1 }}>
          <div className="eyebrow">{t('home.greeting')}{name ? `, ${name}` : ''}</div>
          <h1 className="h-hero">{t('app.name')}</h1>
        </div>
        <Link href="/search" className="icon-btn" aria-label={t('action.search')}><Icon name="search" /></Link>
        <Link href="/profile" className="icon-btn" aria-label={t('nav.profile')}><Icon name="user" /></Link>
      </header>

      <div style={{ position: 'relative', marginTop: 40 }}>
      <img className="deco float-slow" src={ART.lotus.src} alt="" aria-hidden="true"
        style={{ right: -10, top: -34, width: 'clamp(100px, 18vw, 132px)', ['--r' as string]: '6deg' }} />
      <img className="deco" src={ART.flowerCluster.src} alt="" aria-hidden="true"
        style={{ left: -14, bottom: -30, width: 'clamp(128px, 23vw, 184px)', transform: 'rotate(-4deg)' }} />
      <section className="hero-card" style={{ height: 'clamp(300px, 52vw, 440px)' }} aria-label={t('home.inspiration')}>
        <GlassScene word="дониш" variant="sphere" />
        {inspiration ? (
          <LiquidGlass radius={22} bezel={14} style={{ position: 'absolute', left: 14, top: 14, maxWidth: 'min(62%, 420px)', padding: '12px 16px', zIndex: 2 }}>
            <div className="eyebrow" style={{ position: 'relative', zIndex: 2, color: 'var(--ink-2)' }}>{t('home.inspiration')}</div>
            <p className="serif" style={{ position: 'relative', zIndex: 2, margin: '4px 0 0', fontStyle: 'italic', fontSize: '1.05em', color: 'var(--ink)' }}>“{inspiration.body}”</p>
            {inspiration.author_name || inspiration.source_title ? (
              <div className="eyebrow" style={{ position: 'relative', zIndex: 2, marginTop: 6, color: 'var(--ink-2)' }}>
                — {[inspiration.author_name, inspiration.source_title].filter(Boolean).join(', ')}
              </div>
            ) : null}
          </LiquidGlass>
        ) : null}
      </section>
      </div>
      <div style={{ height: 28 }} />

      {cont ? (
        <section className="section">
          <h2 className="h-section">{t('home.continue_learning')}</h2>
          <Link href={`/lesson?id=${cont.lesson_id}`} className="card card-pad row" style={{ textDecoration: 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow">{cont.course.title}</div>
              <b style={{ display: 'block', fontWeight: 500, fontSize: '1.05em' }}>{cont.title}</b>
              <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${cont.percent}%` }} /></div>
            </div>
            <span className="btn" style={{ width: 48, padding: 0 }} aria-label={t('action.continue')}><Icon name="play" /></span>
          </Link>
        </section>
      ) : null}

      <section className="section">
        <div className="section-head">
          <h2 className="h-section">{t('home.seven_schools')}</h2>
          <Link href="/schools" className="chip">{t('home.all_schools')} <Icon name="arrow" size={14} /></Link>
        </div>
        {offlineEmpty && !bundle ? <p className="muted" style={{ margin: 0 }}>{t('state.offline_empty')}</p> : null}
        <div className="scroller pop-row">
          {loading || (!bundle && !offlineEmpty)
            ? Array.from({ length: 4 }, (_, i) => <div key={i} style={{ width: 164 }}><Skeleton height={178} /></div>)
            : bundle?.schools.map((s, i) => <div key={s.id} style={{ width: 164 }}><SchoolCard school={s} index={i} /></div>)}
        </div>
      </section>
    </>
  )
}

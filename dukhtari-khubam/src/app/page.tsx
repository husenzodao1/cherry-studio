'use client'

import Link from 'next/link'

import { useAuth } from '@/web/auth'
import { Icon } from '@/web/components/Icon'
import { ErrorState, Skeleton } from '@/web/components/States'
import { SchoolCard, type SchoolSummary } from '@/web/components/SchoolCard'
import { GlassScene } from '@/web/glass/LazyGlassScene'
import { LiquidGlass } from '@/web/glass/LiquidGlass'
import { usePrefs } from '@/web/prefs'
import { ART } from '@/web/art'
import { useApi } from '@/web/useApi'

interface Inspiration { body: string; author_name?: string | null; source_title?: string | null }
interface Continue { lesson_id: string; title: string; percent: number; course?: { title: string; progress: { completed: number; total: number } } }
interface Me { profile?: { display_name?: string | null } }

export default function Home() {
  const { t, locale } = usePrefs()
  const { session } = useAuth()
  const schools = useApi<SchoolSummary[]>(`/schools?locale=${locale}`)
  const inspiration = useApi<Inspiration | null>(`/inspiration?locale=${locale}`)
  const cont = useApi<Continue | null>(session ? `/me/continue?locale=${locale}` : null)
  const me = useApi<Me>(session ? '/me' : null)
  const name = me.data?.profile?.display_name

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
        {inspiration.data ? (
          <LiquidGlass radius={22} bezel={14} style={{ position: 'absolute', left: 14, top: 14, maxWidth: 'min(62%, 420px)', padding: '12px 16px', zIndex: 2 }}>
            <div className="eyebrow" style={{ position: 'relative', zIndex: 2, color: 'var(--ink-2)' }}>{t('home.inspiration')}</div>
            <p className="serif" style={{ position: 'relative', zIndex: 2, margin: '4px 0 0', fontStyle: 'italic', fontSize: '1.05em', color: 'var(--ink)' }}>“{inspiration.data.body}”</p>
            {inspiration.data.author_name || inspiration.data.source_title ? (
              <div className="eyebrow" style={{ position: 'relative', zIndex: 2, marginTop: 6, color: 'var(--ink-2)' }}>
                — {[inspiration.data.author_name, inspiration.data.source_title].filter(Boolean).join(', ')}
              </div>
            ) : null}
          </LiquidGlass>
        ) : null}
      </section>
      </div>
      <div style={{ height: 28 }} />

      {cont.data ? (
        <section className="section">
          <h2 className="h-section">{t('home.continue_learning')}</h2>
          <Link href={`/lessons/${cont.data.lesson_id}`} className="card card-pad row" style={{ textDecoration: 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow">{cont.data.course?.title}</div>
              <b style={{ display: 'block', fontWeight: 500, fontSize: '1.05em' }}>{cont.data.title}</b>
              <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${cont.data.percent}%` }} /></div>
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
        {schools.error ? <ErrorState error={schools.error} onRetry={schools.reload} /> : null}
        <div className="scroller pop-row">
          {schools.loading && !schools.data
            ? Array.from({ length: 4 }, (_, i) => <div key={i} style={{ width: 164 }}><Skeleton height={178} /></div>)
            : schools.data?.map((s, i) => <div key={s.id} style={{ width: 164 }}><SchoolCard school={s} index={i} /></div>)}
        </div>
      </section>
    </>
  )
}

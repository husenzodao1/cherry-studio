'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'

import { Icon } from '@/web/components/Icon'
import { Empty, Loading } from '@/web/components/States'
import { ART } from '@/web/art'
import { GlassScene } from '@/web/glass/LazyGlassScene'
import { useContent } from '@/web/offline/content'
import { courseProgress, useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'
import { useQueryParam } from '@/web/useQueryParam'

export default function SchoolPage() {
  return <Suspense fallback={<Loading />}><School /></Suspense>
}

function School() {
  const key = useQueryParam('key')
  const { t } = usePrefs()
  const { bundle, loading } = useContent()
  const { progress } = useLearner()
  const [tab, setTab] = useState<'courses' | 'about' | 'results'>('courses')
  const back = (
    <header className="topbar">
      <Link href="/schools" className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link>
    </header>
  )
  if (!bundle) return <>{back}{loading ? <Loading /> : <p className="muted">{t('state.offline_empty')}</p>}</>
  const s = bundle.schoolDetails[key]
  if (!s) return <>{back}<Empty title={t('state.empty_courses')} /></>
  const courses = s.courses.map((c) => ({ ...c, progress: courseProgress(bundle, progress, c.id) }))
  const totals = courses.reduce((acc, c) => ({ completed: acc.completed + c.progress.completed, total: acc.total + c.progress.total }), { completed: 0, total: 0 })
  const pct = totals.total ? Math.round((totals.completed * 100) / totals.total) : 0
  return (
    <>
      {back}
      <div style={{ position: 'relative', marginTop: 40 }}>
        <img className="art-pop float-slow" src={ART.shapes.src} alt="" aria-hidden="true"
          style={{ right: 'clamp(-80px, -10vw, -32px)', top: 6, width: 'clamp(200px, 50vw, 340px)', height: 'auto' }} />
        <img className="deco" src={ART.flowerCluster.src} alt="" aria-hidden="true" style={{ left: -12, bottom: -24, width: 'clamp(108px, 19vw, 160px)', transform: 'rotate(-6deg)' }} />
        <section className="hero-card" style={{ height: 'clamp(260px, 46vw, 380px)' }} aria-hidden="true">
          <GlassScene word={s.title} variant="sculpture" accent={s.theme_color ?? '#59446e'} />
        </section>
      </div>
      <div className="section" style={{ marginTop: 34 }}>
        <div className="eyebrow">{t('nav.schools')}</div>
        <h1 className="h-page">{s.title}</h1>
        {s.description ? <p className="muted" style={{ margin: 0 }}>{s.description}</p> : null}
        <div className="row">
          <div className="progress" style={{ flex: 1 }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
            aria-label={t('section.progress')}><span style={{ width: `${pct}%` }} /></div>
          <span className="muted" style={{ minWidth: 44, textAlign: 'end' }}>{pct}%</span>
        </div>
        <div className="segmented" role="tablist">
          {(['courses', 'about', 'results'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {t(k === 'courses' ? 'section.courses' : k === 'about' ? 'section.about' : 'section.results')}
            </button>
          ))}
        </div>
      </div>
      <div className="section" role="tabpanel">
        {tab === 'courses' ? (
          courses.length === 0 ? <Empty title={t('state.empty_courses')} /> : courses.map((c) => (
            <Link key={c.id} href={`/course?id=${c.id}`} className="card card-pad row" style={{ textDecoration: 'none', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontWeight: 500, fontSize: '1.05em' }}>{c.title}</b>
                {c.description ? <div className="muted" style={{ fontSize: '0.9em', marginTop: 2 }}>{c.description}</div> : null}
                <div className="progress" style={{ marginTop: 12 }}><span style={{ width: `${c.progress.percent}%` }} /></div>
              </div>
              <span className="icon-btn" aria-hidden="true">{c.locked ? <Icon name="lock" /> : <Icon name="play" />}</span>
            </Link>
          ))
        ) : tab === 'about' ? (
          <div className="card card-pad">{s.description ?? '—'}</div>
        ) : (
          totals.completed === 0 ? <Empty title={t('state.empty_results')} />
            : <div className="card card-pad row"><div className="big-number">{totals.completed}</div><span className="muted">/ {totals.total} {t('section.lessons').toLowerCase()}</span></div>
        )}
      </div>
    </>
  )
}

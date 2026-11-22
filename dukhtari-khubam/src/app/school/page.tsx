'use client'

import Link from 'next/link'
import { Suspense, useState, type CSSProperties } from 'react'

import { SCHOOL_ART } from '@/web/art'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { Empty, Loading } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { courseLessonIds, courseProgress, useLearner } from '@/web/offline/learner'
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
  if (!bundle) return <><Header back="/schools" />{loading ? <Loading /> : <Empty icon="info" title={t('state.offline_empty')} />}</>
  const s = bundle.schoolDetails[key]
  if (!s) return <><Header back="/schools" /><Empty title={t('state.not_found')} /></>
  const courses = s.courses.map((c) => ({ ...c, progress: courseProgress(bundle, progress, c.id) }))
  const totals = courses.reduce((acc, c) => ({ completed: acc.completed + c.progress.completed, total: acc.total + c.progress.total }), { completed: 0, total: 0 })
  const pct = totals.total ? Math.round((totals.completed * 100) / totals.total) : 0
  const icon = s.icon?.url ? { src: s.icon.url } : SCHOOL_ART[s.slug]
  // where "continue" leads: the first unfinished lesson of the first unfinished course
  const next = courses.flatMap((c) => courseLessonIds(bundle, c.id)).find((id) => !progress.lessons[id]?.done)

  return (
    <>
      <Header back="/schools" title={s.title} />
      {/* the school at a glance: its icon inside a ring that fills with progress, the numbers, the way on */}
      <section className="school-hero" style={s.theme_color ? ({ '--school': s.theme_color } as CSSProperties) : undefined}>
        <div className="school-ring bloom-in" role="img" aria-label={`${t('section.progress')}: ${pct}%`}>
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <linearGradient id="school-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--primary-soft)' }} />
                <stop offset="100%" style={{ stopColor: 'var(--primary)' }} />
              </linearGradient>
            </defs>
            <circle className="ring-track" cx="100" cy="100" r="93" />
            <circle className="ring-fill" cx="100" cy="100" r="93" pathLength={100} strokeDasharray={`${pct} 100`} />
          </svg>
          <span className="school-ring-glow" aria-hidden="true" />
          {icon ? <img src={icon.src} alt="" decoding="async" /> : null}
          <span className="school-ring-pct">{pct}%</span>
        </div>
        <p className="school-hero-meta">
          {t('school.courses_n').replace('{n}', String(courses.length))} · {t('course.lessons_n').replace('{n}', `${totals.completed}/${totals.total}`)}
        </p>
        {next ? (
          <Link href={`/lesson?id=${next}`} className="btn school-hero-go">
            <Icon name="play" size={16} fill="currentColor" /> {pct ? t('action.continue') : t('home.start_learning')}
          </Link>
        ) : null}
      </section>

      <div className="tabs" role="tablist" style={{ marginTop: 18 }}>
        {(['courses', 'about', 'results'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {t(k === 'courses' ? 'section.courses' : k === 'about' ? 'section.about' : 'section.results')}
          </button>
        ))}
      </div>

      <div className="section stagger" role="tabpanel" key={tab} style={{ marginTop: 14 }}>
        {tab === 'courses' ? (
          courses.length === 0 ? <Empty title={t('state.school_soon')} /> : courses.map((c) => (
            <Link key={c.id} href={`/course?id=${c.id}`} className="glass list-row">
              <span className="row-icon">
                {c.progress.percent === 100 ? <Icon name="check" /> : <Icon name="play" size={20} />}
              </span>
              <span className="row-main">
                <b>{c.title}</b>
                <span className="row-sub">{t('course.modules_n').replace('{n}', String(c.module_count))}{c.progress.total ? ` · ${t('course.lessons_n').replace('{n}', String(c.progress.total))}` : ''}</span>
              </span>
              <span className="row-end">
                {c.locked ? <Icon name="lock" size={18} /> : c.progress.percent > 0 ? `${c.progress.percent}%` : <Icon name="forward" size={18} />}
              </span>
            </Link>
          ))
        ) : tab === 'about' ? (
          s.description ? <div className="glass card-pad"><p style={{ margin: 0, lineHeight: 1.65 }}>{s.description}</p></div> : <Empty title="—" />
        ) : (
          totals.completed === 0 ? <Empty icon="chart" title={t('state.empty_results')} /> : (
            <div className="glass card-pad row">
              <div className="big-number">{totals.completed}</div>
              <span className="muted">/ {totals.total} {t('section.lessons').toLowerCase()}</span>
            </div>
          )
        )}
      </div>

    </>
  )
}

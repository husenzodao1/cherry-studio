'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'

import { ART, SCHOOL_ART, SCHOOL_HERO } from '@/web/art'
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
  if (!s) return <><Header back="/schools" /><Empty title={t('state.empty_courses')} /></>
  const courses = s.courses.map((c) => ({ ...c, progress: courseProgress(bundle, progress, c.id) }))
  const totals = courses.reduce((acc, c) => ({ completed: acc.completed + c.progress.completed, total: acc.total + c.progress.total }), { completed: 0, total: 0 })
  const pct = totals.total ? Math.round((totals.completed * 100) / totals.total) : 0
  const hero = SCHOOL_HERO[s.slug]
  const icon = s.icon?.url ? { src: s.icon.url } : SCHOOL_ART[s.slug]
  // where "continue" leads: the first unfinished lesson of the first unfinished course
  const next = courses.flatMap((c) => courseLessonIds(bundle, c.id)).find((id) => !progress.lessons[id]?.done)

  return (
    <>
      <Header back="/schools" title={s.title} />
      <div className="hero-art" aria-hidden="true">
        {hero ? <img className="scene bloom-in" src={hero.src} alt="" decoding="async" /> : (
          <div className="hero-plinth glass bloom-in">
            {icon ? <img src={icon.src} alt="" decoding="async" /> : null}
            <img className="orbit float" src={ART.bubble.src} alt="" decoding="async" />
          </div>
        )}
      </div>

      <div className="glass progress-card">
        <div style={{ flex: 1 }}>
          <b style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>{t('section.progress')}</b>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('section.progress')}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="pct-circle glass">{pct}%</span>
      </div>

      <div className="tabs" role="tablist" style={{ marginTop: 16 }}>
        {(['courses', 'about', 'results'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {t(k === 'courses' ? 'section.courses' : k === 'about' ? 'section.about' : 'section.results')}
          </button>
        ))}
      </div>

      <div className="section stagger" role="tabpanel" key={tab} style={{ marginTop: 14 }}>
        {tab === 'courses' ? (
          courses.length === 0 ? <Empty title={t('state.empty_courses')} /> : courses.map((c) => (
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

      {next ? (
        <Link href={`/lesson?id=${next}`} className="btn btn-block btn-lg" style={{ marginTop: 20 }}>{t('action.continue')} <Icon name="arrow" size={18} /></Link>
      ) : null}

      <div className="glass banner" style={{ marginTop: 24 }}>
        <p>{t('school.banner')} <span aria-hidden="true">💜</span></p>
        <img className="float-slow" src={ART.flowerSide.src} alt="" aria-hidden="true" decoding="async" />
      </div>
    </>
  )
}

'use client'

import Link from 'next/link'
import { Suspense } from 'react'

import { ART } from '@/web/art'
import { Header } from '@/web/components/Header'
import { CourseDownload } from '@/web/components/CourseDownload'
import { Icon } from '@/web/components/Icon'
import { CertificateButton } from '@/web/components/Keepsakes'
import { Empty, Loading } from '@/web/components/States'
import { useContent, type QuizCard } from '@/web/offline/content'
import { courseLessonIds, courseProgress, useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'
import { useQueryParam } from '@/web/useQueryParam'

function QuizRow({ q }: { q: QuizCard }) {
  const { t } = usePrefs()
  const { progress } = useLearner()
  const best = progress.quizzes[q.id]?.best
  return (
    <Link href={`/quiz?id=${q.id}`} className="glass list-row">
      <span className="row-icon"><Icon name="check" /></span>
      <span className="row-main"><b>{q.title}</b><span className="row-sub">{q.question_count} {t('quiz.question').toLowerCase()}</span></span>
      <span className="row-end">{best != null ? `${Math.round(best)}%` : <Icon name="forward" size={18} />}</span>
    </Link>
  )
}

export default function CoursePage() {
  return <Suspense fallback={<Loading />}><Course /></Suspense>
}

function Course() {
  const id = useQueryParam('id')
  const { t } = usePrefs()
  const { bundle, loading } = useContent()
  const { progress: learnerProgress } = useLearner()
  if (!bundle) return <><Header back="/schools" />{loading ? <Loading /> : <Empty icon="info" title={t('state.offline_empty')} />}</>
  const c = bundle.courses[id]
  if (!c) return <><Header back="/schools" /><Empty title={t('state.empty_courses')} /></>
  const progress = courseProgress(bundle, learnerProgress, c.id)
  const ids = courseLessonIds(bundle, c.id)
  const resume = ids.find((lid) => learnerProgress.lessons[lid] && !learnerProgress.lessons[lid].done)
  const start = resume ?? ids.find((lid) => !learnerProgress.lessons[lid]?.done) ?? ids[0]
  return (
    <>
      <Header back={c.school ? `/school?key=${encodeURIComponent(c.school.slug)}` : '/schools'} title={c.school?.title} />
      <div className="hero-art" style={{ height: 170 }} aria-hidden="true">
        <img className="scene bloom-in" src={ART.book.src} alt="" decoding="async" />
      </div>
      <div className="stack" style={{ gap: 8, textAlign: 'center', alignItems: 'center' }}>
        <h1 className="h-page">{c.title}</h1>
        {c.description ? <p className="muted" style={{ margin: 0 }}>{c.description}</p> : null}
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {c.level ? <span className="chip">{c.level}</span> : null}
          {c.estimated_minutes ? <span className="chip">{c.estimated_minutes} {t('lesson.minutes')}</span> : null}
          {c.locked ? <span className="chip"><Icon name="lock" size={14} /> {t('state.locked')}</span> : null}
        </div>
      </div>

      <div className="glass progress-card" style={{ marginTop: 18 }}>
        <div style={{ flex: 1 }}>
          <b style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>{t('section.progress')} · {progress.completed}/{progress.total}</b>
          <div className="progress"><span style={{ width: `${progress.percent}%` }} /></div>
        </div>
        <span className="pct-circle glass">{progress.percent}%</span>
      </div>
      {progress.total > 0 && progress.percent === 100 ? (
        <div className="glass card-pad stack cert-card" style={{ marginTop: 14, alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <img src="/assets/3d/glass-lotus.webp" alt="" aria-hidden="true" className="bloom-in" style={{ width: 120 }} />
          <b>{t('cert.congrats')}</b>
          <CertificateButton course={c.title} school={c.school?.title ?? ''} date={ids.map((lid) => learnerProgress.lessons[lid]?.done ?? '').sort().at(-1) ?? new Date().toISOString()} />
        </div>
      ) : null}
      <CourseDownload lessons={ids.map((lid) => bundle.lessons[lid]).filter((l) => !!l)} />
      {start ? (
        <Link href={`/lesson?id=${start}`} className="btn btn-block btn-lg" style={{ marginTop: 14 }}>
          {resume || progress.completed ? t('action.continue') : t('action.start_course')} <Icon name="arrow" size={18} />
        </Link>
      ) : null}

      {c.goals.length ? (
        <div className="glass card-pad section">
          <b>{t('section.goals')}</b>
          <ul style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.6 }}>{c.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </div>
      ) : null}
      {c.prerequisites.length ? (
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 14 }}>
          {c.prerequisites.map((p) => (
            <Link key={p.id} href={`/course?id=${p.id}`} className="chip">
              {courseProgress(bundle, learnerProgress, p.id).percent === 100 ? <Icon name="check" size={14} /> : null}{p.title}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="section stagger">
        {c.modules.length === 0 ? <Empty title={t('state.empty_courses')} /> : c.modules.map((m, mi) => (
          <section key={m.id} className="glass module" aria-labelledby={`m-${m.id}`}>
            <div className="module-head">
              <span className="module-num">{String(mi + 1).padStart(2, '0')}</span>
              <h2 id={`m-${m.id}`} className="h-section">{m.title}</h2>
            </div>
            {m.description ? <p className="muted" style={{ margin: 0 }}>{m.description}</p> : null}
            {m.topics.map((tp) => (
              <div key={tp.id} className="stack" style={{ gap: 8 }}>
                <span className="eyebrow">{tp.title}</span>
                {tp.lessons.map((l) => {
                  const done = !!learnerProgress.lessons[l.id]?.done
                  return (
                    <Link key={l.id} href={`/lesson?id=${l.id}`} className="list-row press" style={{ padding: '8px 10px', background: 'var(--glass-flat)' }}>
                      <span className="row-icon" style={{ width: 38, height: 38 }}>
                        {l.locked ? <Icon name="lock" size={16} /> : done ? <Icon name="check" size={16} /> : <Icon name="play" size={16} />}
                      </span>
                      <span className="row-main"><b style={{ fontSize: '0.95em' }}>{l.title}</b></span>
                      {l.estimated_minutes ? <span className="row-end">{l.estimated_minutes} {t('lesson.minutes')}</span> : null}
                    </Link>
                  )
                })}
                {tp.quizzes.map((q) => <QuizRow key={q.id} q={q} />)}
              </div>
            ))}
            {m.quizzes.map((q) => <QuizRow key={q.id} q={q} />)}
          </section>
        ))}
        {c.quizzes.map((q) => <QuizRow key={q.id} q={q} />)}
      </div>
    </>
  )
}

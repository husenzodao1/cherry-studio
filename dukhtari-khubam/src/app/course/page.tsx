'use client'

import Link from 'next/link'
import { Suspense } from 'react'

import { Icon } from '@/web/components/Icon'
import { Empty, Loading } from '@/web/components/States'
import { useContent, type QuizCard } from '@/web/offline/content'
import { courseLessonIds, courseProgress, useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'
import { useQueryParam } from '@/web/useQueryParam'

function QuizLink({ q }: { q: QuizCard }) {
  const { progress } = useLearner()
  const best = progress.quizzes[q.id]?.best
  return (
    <Link href={`/quiz?id=${q.id}`} className="chip" style={{ alignSelf: 'flex-start' }}>
      <Icon name="check" size={16} /> {q.title}{best != null ? ` · ${Math.round(best)}%` : ''}
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
  if (!bundle) return loading ? <Loading /> : <p className="muted">{t('state.offline_empty')}</p>
  const c = bundle.courses[id]
  if (!c) return <Empty title={t('state.empty_courses')} />
  const progress = courseProgress(bundle, learnerProgress, c.id)
  const ids = courseLessonIds(bundle, c.id)
  const resume = ids.find((lid) => learnerProgress.lessons[lid] && !learnerProgress.lessons[lid].done)
  const start = resume ?? ids.find((lid) => !learnerProgress.lessons[lid]?.done) ?? ids[0]
  return (
    <>
      <header className="topbar">
        <Link href={c.school ? `/school?key=${encodeURIComponent(c.school.slug)}` : '/schools'} className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link>
        <span className="eyebrow">{c.school?.title}</span>
      </header>
      <div className="section" style={{ marginTop: 12 }}>
        <h1 className="h-page">{c.title}</h1>
        {c.description ? <p className="muted" style={{ margin: 0 }}>{c.description}</p> : null}
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {c.level ? <span className="chip">{c.level}</span> : null}
          {c.estimated_minutes ? <span className="chip">{c.estimated_minutes} {t('lesson.minutes')}</span> : null}
          {c.locked ? <span className="chip"><Icon name="lock" size={14} /> {t('state.locked')}</span> : null}
        </div>
        <div className="card card-pad card-lilac row">
          <div style={{ flex: 1 }}>
            <div className="eyebrow">{t('section.progress')}</div>
            <div className="big-number">{progress.percent}%</div>
            <div className="muted">{progress.completed} / {progress.total}</div>
          </div>
          {start ? <Link href={`/lesson?id=${start}`} className="btn">{resume || progress.completed ? t('action.continue') : t('action.start_course')} <Icon name="arrow" size={16} /></Link> : null}
        </div>
        {c.goals.length ? (
          <div className="card card-pad"><b>{t('section.goals')}</b><ul style={{ margin: '8px 0 0' }}>{c.goals.map((g, i) => <li key={i}>{g}</li>)}</ul></div>
        ) : null}
        {c.prerequisites.length ? (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {c.prerequisites.map((p) => (
              <Link key={p.id} href={`/course?id=${p.id}`} className="chip">
                {courseProgress(bundle, learnerProgress, p.id).percent === 100 ? <Icon name="check" size={14} /> : null}{p.title}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <div className="section">
        {c.modules.length === 0 ? <Empty title={t('state.empty_courses')} /> : c.modules.map((m, mi) => (
          <section key={m.id} className="card card-pad stack" aria-labelledby={`m-${m.id}`}>
            <div>
              <div className="eyebrow">{String(mi + 1).padStart(2, '0')}</div>
              <h2 id={`m-${m.id}`} className="h-section">{m.title}</h2>
              {m.description ? <p className="muted" style={{ margin: '4px 0 0' }}>{m.description}</p> : null}
            </div>
            {m.topics.map((tp) => (
              <div key={tp.id} className="stack" style={{ gap: 8 }}>
                <b style={{ fontWeight: 500 }}>{tp.title}</b>
                {tp.lessons.map((l) => (
                  <Link key={l.id} href={`/lesson?id=${l.id}`} className="row" style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 16, background: 'var(--surface-2)' }}>
                    <span className="icon-btn" style={{ width: 36, height: 36 }} aria-hidden="true">
                      {l.locked ? <Icon name="lock" size={16} /> : learnerProgress.lessons[l.id]?.done ? <Icon name="check" size={16} /> : <Icon name="play" size={16} />}
                    </span>
                    <span style={{ flex: 1 }}>{l.title}</span>
                    {l.estimated_minutes ? <span className="muted" style={{ fontSize: '0.85em' }}>{l.estimated_minutes} {t('lesson.minutes')}</span> : null}
                  </Link>
                ))}
                {tp.quizzes.map((q) => <QuizLink key={q.id} q={q} />)}
              </div>
            ))}
            {m.quizzes.map((q) => <QuizLink key={q.id} q={q} />)}
          </section>
        ))}
        {c.quizzes.map((q) => <QuizLink key={q.id} q={q} />)}
      </div>
    </>
  )
}

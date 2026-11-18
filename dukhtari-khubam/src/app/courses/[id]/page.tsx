'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

import { Icon } from '@/web/components/Icon'
import { Empty, ErrorState, Loading } from '@/web/components/States'
import { usePrefs } from '@/web/prefs'
import { useApi } from '@/web/useApi'

interface QuizCard { id: string; title: string; question_count: number; passed?: boolean | null; best_percent?: number | null }
interface LessonRow { id: string; title: string; estimated_minutes?: number | null; locked: boolean; progress?: 'started' | 'completed' | null }
interface Course {
  id: string; title: string; description?: string | null; goals: string[]; level?: string | null; locked: boolean
  estimated_minutes?: number | null; school?: { slug: string; title: string }
  progress: { completed: number; total: number; percent: number }; resume_lesson_id?: string | null
  prerequisites: { id: string; title: string; completed: boolean }[]
  quizzes: QuizCard[]
  modules: { id: string; title: string; description?: string | null; quizzes: QuizCard[]
    topics: { id: string; title: string; quizzes: QuizCard[]; lessons: LessonRow[] }[] }[]
}

function QuizLink({ q }: { q: QuizCard }) {
  return (
    <Link href={`/quizzes/${q.id}`} className="chip" style={{ alignSelf: 'flex-start' }}>
      <Icon name="check" size={16} /> {q.title}{q.best_percent != null ? ` · ${Math.round(q.best_percent)}%` : ''}
    </Link>
  )
}

export default function CoursePage() {
  const { id } = useParams<{ id: string }>()
  const { t, locale } = usePrefs()
  const course = useApi<Course>(`/courses/${id}?locale=${locale}`)
  if (course.error) return <ErrorState error={course.error} onRetry={course.reload} />
  if (!course.data) return <Loading />
  const c = course.data
  const first = c.modules.flatMap((m) => m.topics.flatMap((tp) => tp.lessons))[0]
  const start = c.resume_lesson_id ?? first?.id
  return (
    <>
      <header className="topbar">
        <Link href={c.school ? `/schools/${c.school.slug}` : '/schools'} className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link>
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
            <div className="big-number">{c.progress.percent}%</div>
            <div className="muted">{c.progress.completed} / {c.progress.total}</div>
          </div>
          {start ? <Link href={`/lessons/${start}`} className="btn">{c.resume_lesson_id ? t('action.continue') : t('action.start_course')} <Icon name="arrow" size={16} /></Link> : null}
        </div>
        {c.goals.length ? (
          <div className="card card-pad"><b>{t('section.goals')}</b><ul style={{ margin: '8px 0 0' }}>{c.goals.map((g, i) => <li key={i}>{g}</li>)}</ul></div>
        ) : null}
        {c.prerequisites.length ? (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {c.prerequisites.map((p) => <Link key={p.id} href={`/courses/${p.id}`} className="chip">{p.completed ? <Icon name="check" size={14} /> : null}{p.title}</Link>)}
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
                  <Link key={l.id} href={`/lessons/${l.id}`} className="row" style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 16, background: 'var(--surface-2)' }}>
                    <span className="icon-btn" style={{ width: 36, height: 36 }} aria-hidden="true">
                      {l.locked ? <Icon name="lock" size={16} /> : l.progress === 'completed' ? <Icon name="check" size={16} /> : <Icon name="play" size={16} />}
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

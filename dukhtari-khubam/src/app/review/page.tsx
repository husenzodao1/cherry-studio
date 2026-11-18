'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { Empty } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { gradeQuestion, shuffled, type Answer } from '@/web/offline/grade'
import { useLearner } from '@/web/offline/learner'
import { dueToday, reviewStats, type ReviewItem } from '@/web/offline/review'
import { usePrefs } from '@/web/prefs'

/** "Такрори рӯз": today's spaced-repetition questions, one at a time, with instant feedback. */
export default function ReviewPage() {
  const { t } = usePrefs()
  const { bundle } = useContent()
  const { progress, recordReview } = useLearner()
  // the session is fixed when it starts, so answering does not reshuffle what is left
  const [session, setSession] = useState<ReviewItem[] | null>(null)
  useEffect(() => {
    if (bundle && session === null) setSession(dueToday(bundle, progress).map((it) => ({ ...it, question: { ...it.question, options: shuffled(it.question.options) } })))
  }, [bundle, progress, session])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Answer | undefined>()
  const [checked, setChecked] = useState<boolean | null>(null)
  const [right, setRight] = useState(0)
  const stats = useMemo(() => (bundle ? reviewStats(bundle, progress) : null), [bundle, progress])

  if (!session || !stats) return <Header back="/" title={t('review.title')} />
  const finished = index >= session.length
  if (session.length === 0 || finished) {
    return (
      <>
        <Header back="/" title={t('review.title')} />
        {session.length === 0 ? (
          <Empty icon={stats.total ? 'check' : 'book'} title={stats.total ? t('review.done_today') : t('review.empty')} />
        ) : (
          <div className="glass card-pad stack question" style={{ alignItems: 'center', textAlign: 'center', marginTop: 24 }}>
            <span className="pct-circle glass" style={{ width: 110, height: 110, fontSize: '1.7rem' }}>{right}/{session.length}</span>
            <h1 className="h-page">{right === session.length ? t('review.great') : t('review.result').replace('{ok}', String(right)).replace('{n}', String(session.length))}</h1>
            <p className="muted" style={{ margin: 0 }}>{t('review.keep')}</p>
          </div>
        )}
        {stats.total ? (
          <div className="glass card-pad stack" style={{ marginTop: 16, gap: 10 }}>
            <span className="eyebrow">{t('review.boxes')}</span>
            <div className="boxes" aria-label={t('review.boxes')}>
              {stats.boxes.map((n, i) => (
                <div key={i} className="box"><span className="box-bar" style={{ height: `${Math.max(8, (n / Math.max(1, ...stats.boxes)) * 100)}%` }} /><b>{n}</b><span>{i + 1}</span></div>
              ))}
            </div>
            <span className="muted" style={{ fontSize: '0.84em' }}>{t('review.how')}</span>
          </div>
        ) : null}
        <Link href="/garden" className="btn btn-block btn-lg" style={{ marginTop: 18 }}>{t('garden.open')} <Icon name="arrow" size={18} /></Link>
      </>
    )
  }

  const { quiz, question } = session[index]
  const multi = question.type === 'multiple_choice'
  const correctIds = quiz.grading[question.id]?.key.correct_option_ids ?? []
  const check = () => {
    const ok = gradeQuestion(question, quiz.grading[question.id], answer, quiz.locale).status === 'correct'
    setChecked(ok)
    if (ok) setRight((n) => n + 1)
    recordReview(question.id, ok)
  }
  const next = () => {
    setIndex((i) => i + 1)
    setAnswer(undefined)
    setChecked(null)
  }
  const explanation = checked === null ? null : checked ? quiz.grading[question.id]?.explanation_correct : quiz.grading[question.id]?.explanation_incorrect ?? quiz.grading[question.id]?.explanation_correct

  return (
    <section className="stack" style={{ gap: 12 }}>
      <header className="topbar">
        <Link href="/" className="icon-btn" aria-label={t('action.close')}><Icon name="back" /></Link>
        <div className="quiz-bar">
          <div className="review-dots" aria-hidden="true">{session.map((_, i) => <i key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />)}</div>
          <span className="quiz-count">{index + 1} / {session.length}</span>
        </div>
      </header>
      <div className="glass question" key={question.id} style={{ animation: 'rise 0.5s var(--ease) both' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{t('review.title')} · {quiz.quiz.title}</div>
        <h1 id={`q-${question.id}`}>{question.prompt}</h1>
      </div>
      <div role={multi ? 'group' : 'radiogroup'} aria-labelledby={`q-${question.id}`} className="stack stagger" style={{ gap: 10 }} key={`o-${question.id}`}>
        {question.options.map((o) => {
          const on = multi ? !!answer?.option_ids?.includes(o.id) : answer?.option_id === o.id
          const state = checked === null ? '' : correctIds.includes(o.id) ? 'correct' : on ? 'incorrect' : ''
          return (
            <button key={o.id} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} className={`option ${state}`} disabled={checked !== null}
              onClick={() => setAnswer(multi ? { option_ids: on ? (answer?.option_ids ?? []).filter((x) => x !== o.id) : [...(answer?.option_ids ?? []), o.id] } : { option_id: o.id })}>
              <span className={`radio${multi ? ' square' : ''}`} aria-hidden="true" />
              <span>{o.text}</span>
            </button>
          )
        })}
      </div>
      {checked !== null ? (
        <div className={`glass card-pad review-feedback ${checked ? 'is-ok' : 'is-bad'}`} role="status">
          <b>{checked ? t('quiz.correct') : t('quiz.incorrect')}</b>
          {explanation ? <p className="muted" style={{ margin: '6px 0 0' }}>{explanation}</p> : null}
        </div>
      ) : null}
      {checked === null
        ? <button className="btn btn-lg btn-block" onClick={check} disabled={!answer}>{t('action.check')} <Icon name="forward" size={18} /></button>
        : <button className="btn btn-lg btn-block" onClick={next}>{index < session.length - 1 ? t('action.next') : t('review.great')} <Icon name="forward" size={18} /></button>}
    </section>
  )
}

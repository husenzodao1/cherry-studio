'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { api, ApiFailure } from '@/web/api'
import { useAuth } from '@/web/auth'
import type { Asset } from '@/web/components/Blocks'
import { Icon } from '@/web/components/Icon'
import { ErrorState } from '@/web/components/States'
import { usePrefs } from '@/web/prefs'

type Answer = { option_id?: string; option_ids?: string[]; pairs?: Record<string, string>; order?: string[]; text?: string }
interface Option { id: string; text?: string | null; side?: 'left' | 'right' | null; media?: Asset | null }
interface Question { id: string; type: string; points: number; prompt: string; hint?: string | null; section?: string | null; media?: Asset | null; options: Option[] }
interface Player {
  locale: string
  quiz: { id: string; title: string; instructions?: string | null; show_explanations: string; show_correct_answers: string; question_count: number }
  questions: Question[]
}
interface Start { attempt: { id: string; answers: Record<string, Answer>; checked: string[] }; player: Player }
interface Reveal { id: string; status: string; points?: number; max_points?: number; explanation?: string; correct_option_ids?: string[]; prompt?: string; comment?: string }
interface Result {
  status: string; score: number; max_score: number; percent: number; passed: boolean | null; completion_text?: string | null
  can_retry: boolean; questions: Reveal[]
}

export default function QuizPage() {
  const { id } = useParams<{ id: string }>()
  const { t, locale } = usePrefs()
  const { session, ready } = useAuth()
  const [state, setState] = useState<Start | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [checked, setChecked] = useState<Record<string, Reveal>>({})
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const s = await api<Start>(`/quizzes/${id}/attempts`, { method: 'POST', body: { locale } })
      setState(s)
      setAnswers(s.attempt.answers ?? {})
      setChecked({})
      setIndex(0)
      setResult(null)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return null
  if (!session) {
    return (
      <div className="card state" style={{ marginTop: 40 }}>
        <Icon name="lock" size={26} /><b>{t('state.signin_needed')}</b>
        <Link className="btn" href={`/login?next=/quizzes/${id}`}>{t('action.signin')}</Link>
      </div>
    )
  }
  if (error) return <ErrorState error={error} onRetry={start} />

  if (result) {
    return (
      <section className="stack" style={{ maxWidth: 680, margin: '0 auto' }} aria-live="polite">
        <div className="card card-pad card-lilac stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="eyebrow">{t('quiz.score')}</div>
          <div className="big-number">{Math.round(result.percent)}%</div>
          <b>{result.passed === null ? t('quiz.pending') : result.passed ? t('quiz.passed') : t('quiz.failed')}</b>
          <span className="muted">{result.score} / {result.max_score}</span>
          {result.completion_text ? <p style={{ margin: 0 }}>{result.completion_text}</p> : null}
        </div>
        {result.questions.map((q, i) => (
          <div key={q.id} className="card card-pad stack" style={{ gap: 6 }}>
            <div className="eyebrow">{t('quiz.question')} {i + 1}</div>
            <b style={{ fontWeight: 500 }}>{q.prompt}</b>
            <span className={q.status === 'correct' ? 't-sage' : q.status === 'pending_review' ? 't-champagne' : 't-rose'}>
              {q.status === 'correct' ? t('quiz.correct') : q.status === 'partial' ? t('quiz.partial') : q.status === 'pending_review' ? t('quiz.pending') : t('quiz.incorrect')}
              {q.max_points ? ` · ${q.points}/${q.max_points}` : ''}
            </span>
            {q.explanation ? <p className="muted" style={{ margin: 0 }}><b>{t('quiz.explanation')}: </b>{q.explanation}</p> : null}
            {q.comment ? <p className="muted" style={{ margin: 0 }}>{q.comment}</p> : null}
          </div>
        ))}
        {result.can_retry ? <button className="btn" onClick={start} disabled={busy}>{t('action.retry_quiz')}</button> : null}
      </section>
    )
  }

  if (!state) {
    return (
      <div className="card card-pad stack" style={{ maxWidth: 680, margin: '40px auto 0', textAlign: 'center', alignItems: 'center' }}>
        <Icon name="check" size={28} />
        <button className="btn" onClick={start} disabled={busy}>{t('action.start')}</button>
      </div>
    )
  }

  const q = state.player.questions[index]
  const total = state.player.questions.length
  const answer = answers[q.id]
  const setAnswer = (a: Answer) => !checked[q.id] && setAnswers((s) => ({ ...s, [q.id]: a }))
  const reveal = checked[q.id]
  const perQuestion = state.player.quiz.show_explanations === 'after_each' || state.player.quiz.show_correct_answers === 'after_each'
  const left = q.options.filter((o) => o.side === 'left')
  const right = q.options.filter((o) => o.side === 'right')
  const order = answer?.order ?? q.options.map((o) => o.id)

  const check = async () => {
    if (!answer) return
    setBusy(true)
    try {
      const r = await api<Reveal>(`/attempts/${state.attempt.id}/check`, { method: 'POST', body: { question_id: q.id, answer } })
      setChecked((c) => ({ ...c, [q.id]: r }))
    } catch (e) {
      if (!(e instanceof ApiFailure && e.code === 'already_checked')) setError(e)
    } finally {
      setBusy(false)
    }
  }
  const submit = async () => {
    setBusy(true)
    try {
      setResult(await api<Result>(`/attempts/${state.attempt.id}/submit`, { method: 'POST', body: { answers } }))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return
    const next = [...order]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    setAnswer({ order: next })
  }
  const optClass = (o: Option) =>
    reveal?.correct_option_ids ? (reveal.correct_option_ids.includes(o.id) ? 'correct' : answer?.option_id === o.id || answer?.option_ids?.includes(o.id) ? 'incorrect' : '') : ''

  return (
    <section style={{ maxWidth: 680, margin: '0 auto' }} className="stack">
      <header className="topbar">
        <Link href="/" className="icon-btn" aria-label={t('action.close')}><Icon name="x" /></Link>
        <div style={{ flex: 1 }}>
          <div className="eyebrow">{t('quiz.question')} {index + 1} {t('quiz.of')} {total}</div>
          <div className="progress" style={{ marginTop: 6 }}><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
        </div>
      </header>
      {q.section ? <div className="eyebrow">{q.section}</div> : null}
      <h1 id={`q-${q.id}`} style={{ margin: 0, fontWeight: 400, fontSize: '1.4em', lineHeight: 1.35 }}>{q.prompt}</h1>
      {q.media?.url ? <img src={q.media.url} alt={q.media.alt ?? ''} style={{ borderRadius: 18 }} /> : null}
      {q.hint ? <details><summary className="muted">!</summary><p className="muted">{q.hint}</p></details> : null}

      {['single_choice', 'true_false', 'multiple_choice'].includes(q.type) ? (
        <div role={q.type === 'multiple_choice' ? 'group' : 'radiogroup'} aria-labelledby={`q-${q.id}`} className="stack" style={{ gap: 10 }}>
          {q.options.map((o) => {
            const multi = q.type === 'multiple_choice'
            const on = multi ? !!answer?.option_ids?.includes(o.id) : answer?.option_id === o.id
            return (
              <button key={o.id} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} className={`option ${optClass(o)}`}
                onClick={() => setAnswer(multi
                  ? { option_ids: on ? (answer?.option_ids ?? []).filter((x) => x !== o.id) : [...(answer?.option_ids ?? []), o.id] }
                  : { option_id: o.id })}>
                <Icon name={on ? 'check' : 'sparkle'} size={18} style={{ opacity: on ? 1 : 0.35 }} />
                <span>{o.text}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {q.type === 'matching' ? (
        <div className="stack" style={{ gap: 10 }}>
          {left.map((l) => (
            <label key={l.id} className="card card-pad row" style={{ gap: 10 }}>
              <span style={{ flex: 1 }}>{l.text}</span>
              <select className="input" style={{ maxWidth: '55%' }} value={answer?.pairs?.[l.id] ?? ''}
                onChange={(e) => setAnswer({ pairs: { ...(answer?.pairs ?? {}), [l.id]: e.target.value } })}>
                <option value="">{t('quiz.match_pick')}</option>
                {right.map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {q.type === 'ordering' ? (
        <ol className="stack" style={{ gap: 8, padding: 0, listStyle: 'none' }}>
          {order.map((oid, i) => {
            const o = q.options.find((x) => x.id === oid)
            return (
              <li key={oid} className="card card-pad row">
                <b style={{ width: 24 }}>{i + 1}</b><span style={{ flex: 1 }}>{o?.text}</span>
                <button type="button" className="icon-btn" aria-label="↑" onClick={() => move(i, i - 1)}><Icon name="up" size={16} /></button>
                <button type="button" className="icon-btn" aria-label="↓" onClick={() => move(i, i + 1)}><Icon name="down" size={16} /></button>
              </li>
            )
          })}
        </ol>
      ) : null}

      {q.type === 'short_answer' ? (
        <input className="input" aria-labelledby={`q-${q.id}`} value={answer?.text ?? ''} onChange={(e) => setAnswer({ text: e.target.value })} />
      ) : null}
      {q.type === 'long_answer' ? (
        <textarea className="input" aria-labelledby={`q-${q.id}`} value={answer?.text ?? ''} onChange={(e) => setAnswer({ text: e.target.value })} />
      ) : null}

      {reveal ? (
        <div className="card card-pad" role="status">
          <b>{reveal.status === 'correct' ? t('quiz.correct') : reveal.status === 'pending_review' ? t('quiz.pending') : t('quiz.incorrect')}</b>
          {reveal.explanation ? <p className="muted" style={{ margin: '6px 0 0' }}>{reveal.explanation}</p> : null}
        </div>
      ) : null}

      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn btn-soft" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>{t('action.prev')}</button>
        <span style={{ flex: 1 }} />
        {perQuestion && !reveal && answer ? <button className="btn btn-soft" onClick={check} disabled={busy}>{t('action.check')}</button> : null}
        {index < total - 1
          ? <button className="btn" onClick={() => setIndex((i) => i + 1)}>{t('action.next')}</button>
          : <button className="btn" onClick={submit} disabled={busy}>{t('action.submit')}</button>}
      </div>
    </section>
  )
}

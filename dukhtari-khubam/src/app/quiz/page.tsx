'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState } from 'react'

import { Icon } from '@/web/components/Icon'
import { Empty, Loading } from '@/web/components/States'
import { useContent, type OfflineOption as Option, type OfflineQuiz } from '@/web/offline/content'
import { gradeQuestion, gradeQuiz, shuffled, type Answer, type QuestionResult } from '@/web/offline/grade'
import { useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'
import { useQueryParam } from '@/web/useQueryParam'

/** Quiz played and graded on the phone (works offline); the best result is saved with the learner's progress. */

interface Reveal extends QuestionResult { id: string; prompt: string; explanation?: string | null; correct_option_ids?: string[] }
interface Result { score: number; max_score: number; percent: number; passed: boolean; completion_text?: string | null; questions: Reveal[] }
type Show = 'answers' | 'explanations' | 'both'

export default function QuizPage() {
  return <Suspense fallback={<Loading />}><Quiz /></Suspense>
}

function Quiz() {
  const id = useQueryParam('id')
  const { t } = usePrefs()
  const { bundle, loading } = useContent()
  const quiz = bundle?.quizzes[id]
  if (!bundle) return loading ? <Loading /> : <p className="muted">{t('state.offline_empty')}</p>
  if (!quiz) return <Empty title={t('state.empty_courses')} />
  return <Player key={id} quiz={quiz} />
}

function revealOf(quiz: OfflineQuiz, qid: string, r: QuestionResult, show: Show): Reveal {
  const q = quiz.questions.find((x) => x.id === qid)!
  const g = quiz.grading[qid]
  const ok = r.status === 'correct'
  return {
    ...r, id: qid, prompt: q.prompt,
    explanation: show !== 'answers' ? (ok ? g?.explanation_correct : g?.explanation_incorrect ?? g?.explanation_correct) : null,
    correct_option_ids: show !== 'explanations' ? g?.key.correct_option_ids : undefined
  }
}

function Player({ quiz }: { quiz: OfflineQuiz }) {
  const { t } = usePrefs()
  const { recordQuiz } = useLearner()
  const [round, setRound] = useState(0)
  const questions = useMemo(() => {
    const ordered = quiz.settings.shuffle_questions ? shuffled(quiz.questions) : quiz.questions
    return ordered.map((q) => ({
      ...q,
      options: (quiz.settings.shuffle_options && ['single_choice', 'multiple_choice'].includes(q.type)) || q.type === 'ordering' ? shuffled(q.options) : q.options
    }))
    // `round` changes on every (re)start, so each attempt gets a fresh order
  }, [quiz, round])
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [checked, setChecked] = useState<Record<string, Reveal>>({})
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const policy = quiz.quiz
  const showAnswers = policy.show_correct_answers
  const showExpl = policy.show_explanations
  const mode = (when: string): Show => (showAnswers === when && showExpl === when ? 'both' : showAnswers === when ? 'answers' : 'explanations')

  const start = () => {
    setRound((r) => r + 1)
    setAnswers({})
    setChecked({})
    setIndex(0)
    setResult(null)
    setStarted(true)
  }

  if (result) {
    return (
      <section className="stack" style={{ maxWidth: 680, margin: '0 auto' }} aria-live="polite">
        <div className="card card-pad card-lilac stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="eyebrow">{t('quiz.score')}</div>
          <div className="big-number">{Math.round(result.percent)}%</div>
          <b>{result.passed ? t('quiz.passed') : t('quiz.failed')}</b>
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
          </div>
        ))}
        {quiz.settings.allow_retry ? <button className="btn" onClick={start}>{t('action.retry_quiz')}</button> : null}
        <Link href="/" className="btn btn-soft">{t('nav.home')}</Link>
      </section>
    )
  }

  if (!started) {
    return (
      <div className="card card-pad stack" style={{ maxWidth: 680, margin: '40px auto 0', textAlign: 'center', alignItems: 'center' }}>
        <Icon name="check" size={28} />
        <h1 className="h-page" style={{ margin: 0 }}>{policy.title}</h1>
        {policy.instructions ? <p className="muted" style={{ margin: 0 }}>{policy.instructions}</p> : null}
        <span className="muted">{questions.length} {t('quiz.question').toLowerCase()}</span>
        <button className="btn" onClick={start} disabled={!questions.length}>{t('action.start')}</button>
      </div>
    )
  }

  const state = { player: { quiz: policy, questions } }
  const q = state.player.questions[index]
  const total = state.player.questions.length
  const answer = answers[q.id]
  const setAnswer = (a: Answer) => !checked[q.id] && setAnswers((s) => ({ ...s, [q.id]: a }))
  const reveal = checked[q.id]
  const perQuestion = showExpl === 'after_each' || showAnswers === 'after_each'
  const left = q.options.filter((o) => o.side === 'left')
  const right = q.options.filter((o) => o.side === 'right')
  const order = answer?.order ?? q.options.map((o) => o.id)

  const check = () => {
    if (!answer) return
    const r = gradeQuestion(q, quiz.grading[q.id], answer, quiz.locale)
    setChecked((c) => ({ ...c, [q.id]: revealOf(quiz, q.id, r, mode('after_each')) }))
  }
  const submit = () => {
    const g = gradeQuiz(questions, quiz.grading, answers, quiz.locale)
    const passed = g.percent >= policy.pass_score_percent
    recordQuiz(quiz.quiz.id, g.percent, passed)
    const end = mode('after_submit')
    setResult({
      score: g.score, max_score: g.max_score, percent: g.percent, passed, completion_text: quiz.settings.completion_text,
      questions: questions.map((x) => showAnswers === 'never' && showExpl === 'never'
        ? { ...g.results[x.id], id: x.id, prompt: x.prompt }
        : revealOf(quiz, x.id, g.results[x.id], end))
    })
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
        {perQuestion && !reveal && answer ? <button className="btn btn-soft" onClick={check} >{t('action.check')}</button> : null}
        {index < total - 1
          ? <button className="btn" onClick={() => setIndex((i) => i + 1)}>{t('action.next')}</button>
          : <button className="btn" onClick={submit}>{t('action.submit')}</button>}
      </div>
    </section>
  )
}

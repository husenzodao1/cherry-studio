'use client'

import Link from 'next/link'
import { Suspense, useMemo, useRef, useState } from 'react'

import { afterQuiz, duringQuiz } from '@/lib/mascot'

import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { say } from '@/web/components/Mascot'
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
  if (!bundle) return <><Header back="/" />{loading ? <Loading /> : <Empty icon="info" title={t('state.offline_empty')} />}</>
  if (!quiz) return <><Header back="/" /><Empty title={t('state.empty_courses')} /></>
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
  // right (true) and wrong answers so far in this round, for her reactions
  const runs = useRef<boolean[]>([])
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [checked, setChecked] = useState<Record<string, Reveal>>({})
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const policy = quiz.quiz
  const showAnswers = policy.show_correct_answers
  const showExpl = policy.show_explanations
  const mode = (when: string): Show => (showAnswers === when && showExpl === when ? 'both' : showAnswers === when ? 'answers' : 'explanations')

  const start = () => {
    runs.current = []
    if (Math.random() < 0.5) say('beforeQuiz')
    setRound((r) => r + 1)
    setAnswers({})
    setChecked({})
    setIndex(0)
    setResult(null)
    setStarted(true)
  }

  if (result) {
    return (
      <section className="stack stagger" style={{ maxWidth: 680, margin: '0 auto' }} aria-live="polite">
        <Header back="/" title={policy.title} />
        <div className="glass card-pad stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="eyebrow">{t('quiz.score')}</div>
          <div className="pct-circle glass" style={{ width: 110, height: 110, fontSize: '1.8rem' }}>{Math.round(result.percent)}%</div>
          <b>{result.passed ? t('quiz.passed') : t('quiz.failed')}</b>
          <span className="muted">{result.score} / {result.max_score}</span>
          {result.completion_text ? <p style={{ margin: 0 }}>{result.completion_text}</p> : null}
        </div>
        {result.questions.map((q, i) => (
          <div key={q.id} className="glass card-pad stack" style={{ gap: 6 }}>
            <div className="eyebrow">{t('quiz.question')} {i + 1}</div>
            <b style={{ fontWeight: 500 }}>{q.prompt}</b>
            <span className={q.status === 'correct' ? 't-sage' : q.status === 'pending_review' ? 't-champagne' : 't-rose'}>
              {q.status === 'correct' ? t('quiz.correct') : q.status === 'partial' ? t('quiz.partial') : q.status === 'pending_review' ? t('quiz.pending') : t('quiz.incorrect')}
              {q.max_points ? ` · ${q.points}/${q.max_points}` : ''}
            </span>
            {q.explanation ? <p className="muted" style={{ margin: 0 }}><b>{t('quiz.explanation')}: </b>{q.explanation}</p> : null}
          </div>
        ))}
        {quiz.settings.allow_retry ? <button className="btn btn-lg" onClick={start}>{t('action.retry_quiz')}</button> : null}
        <Link href="/" className="btn btn-soft">{t('nav.home')}</Link>
      </section>
    )
  }

  if (!started) {
    return (
      <div className="stack" style={{ maxWidth: 680, margin: '0 auto' }}>
        <Header back="/" />
        <div className="glass card-pad stack question" style={{ textAlign: 'center', alignItems: 'center', marginTop: 24 }}>
          <span className="note-icon"><Icon name="check" size={26} /></span>
          <h1 className="h-page" style={{ margin: 0 }}>{policy.title}</h1>
          {policy.instructions ? <p className="muted" style={{ margin: 0 }}>{policy.instructions}</p> : null}
          <span className="muted">{questions.length} {t('quiz.question').toLowerCase()}</span>
        </div>
        <button className="btn btn-lg btn-block" onClick={start} disabled={!questions.length}>{t('action.start')} <Icon name="forward" size={18} /></button>
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
    // answers in a row: the second wrong one asks her to stop and read, the third right one is praised
    if (r.status === 'correct' || r.status === 'incorrect') {
      runs.current = [...runs.current, r.status === 'correct']
      const moment = duringQuiz(runs.current)
      if (moment) say(moment)
    }
  }
  const submit = () => {
    const g = gradeQuiz(questions, quiz.grading, answers, quiz.locale)
    const passed = g.percent >= policy.pass_score_percent
    recordQuiz(quiz.quiz.id, g.percent, passed)
    say(afterQuiz(g.percent, passed))
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
        {index > 0
          ? <button type="button" className="icon-btn" aria-label={t('action.prev')} onClick={() => setIndex((i) => Math.max(0, i - 1))}><Icon name="back" /></button>
          : <Link href="/" className="icon-btn" aria-label={t('action.close')}><Icon name="back" /></Link>}
        <div className="quiz-bar">
          <div className="progress" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={total} aria-label={`${t('quiz.question')} ${index + 1} ${t('quiz.of')} ${total}`}>
            <span style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>
          <span className="quiz-count">{index + 1} / {total}</span>
        </div>
      </header>
      <div className="glass question" key={q.id} style={{ animation: 'rise 0.5s var(--ease) both' }}>
        {q.section ? <div className="eyebrow" style={{ marginBottom: 6 }}>{q.section}</div> : null}
        <h1 id={`q-${q.id}`}>{q.prompt}</h1>
        {q.media?.url ? <img src={q.media.url} alt={q.media.alt ?? ''} style={{ borderRadius: 18, marginTop: 12 }} /> : null}
      </div>
      {q.hint ? <details><summary className="muted">!</summary><p className="muted">{q.hint}</p></details> : null}

      {['single_choice', 'true_false', 'multiple_choice'].includes(q.type) ? (
        <div role={q.type === 'multiple_choice' ? 'group' : 'radiogroup'} aria-labelledby={`q-${q.id}`} className="stack stagger" style={{ gap: 10 }} key={`o-${q.id}`}>
          {q.options.map((o) => {
            const multi = q.type === 'multiple_choice'
            const on = multi ? !!answer?.option_ids?.includes(o.id) : answer?.option_id === o.id
            return (
              <button key={o.id} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} className={`option ${optClass(o)}`}
                onClick={() => setAnswer(multi
                  ? { option_ids: on ? (answer?.option_ids ?? []).filter((x) => x !== o.id) : [...(answer?.option_ids ?? []), o.id] }
                  : { option_id: o.id })}>
                <span className={`radio${multi ? ' square' : ''}`} aria-hidden="true" />
                <span>{o.text}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {q.type === 'matching' ? (
        <div className="stack" style={{ gap: 10 }}>
          {left.map((l) => (
            <label key={l.id} className="glass card-pad row" style={{ gap: 10 }}>
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
              <li key={oid} className="glass card-pad row">
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
        <div className="glass card-pad" role="status">
          <b>{reveal.status === 'correct' ? t('quiz.correct') : reveal.status === 'pending_review' ? t('quiz.pending') : t('quiz.incorrect')}</b>
          {reveal.explanation ? <p className="muted" style={{ margin: '6px 0 0' }}>{reveal.explanation}</p> : null}
        </div>
      ) : null}

      <div className="stack" style={{ marginTop: 10, gap: 10 }}>
        {perQuestion && !reveal
          ? <button className="btn btn-lg btn-block" onClick={check} disabled={!answer}>{t('action.check')} <Icon name="forward" size={18} /></button>
          : index < total - 1
            ? <button className="btn btn-lg btn-block" onClick={() => setIndex((i) => i + 1)}>{t('action.next')} <Icon name="forward" size={18} /></button>
            : <button className="btn btn-lg btn-block" onClick={submit}>{t('action.submit')} <Icon name="forward" size={18} /></button>}
      </div>
    </section>
  )
}

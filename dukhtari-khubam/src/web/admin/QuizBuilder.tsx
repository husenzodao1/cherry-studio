'use client'

import { useState } from 'react'

import { Icon } from '../components/Icon'
import { ErrorState, Loading } from '../components/States'
import { useApi } from '../useApi'
import { Field, LocaleTabs, NEXT_STATUS, Note, send, StatusBadge, titleOf, useAction, type Entity, type Loc } from './ui'

/** Quiz Builder: questions are written by people; the answer key stays on the server and grading runs there. */

interface Option { id: string; translations: { locale: Loc; text: string | null }[] }
interface AnswerKey { correct_option_ids?: string[] | null; accepted_answers?: Partial<Record<Loc, string[]>> | null }
interface Question {
  id: string; type: string; points: number; position: number
  translations: { locale: Loc; prompt: string; explanation_correct?: string | null }[]
  options: Option[]
  answer_key: AnswerKey | AnswerKey[] | null
}

const TYPE_LABEL: Record<string, string> = {
  single_choice: 'Як ҷавоб', multiple_choice: 'Якчанд ҷавоб', true_false: 'Дуруст / Нодуруст', short_answer: 'Ҷавоби кӯтоҳ',
  long_answer: 'Ҷавоби дароз', matching: 'Мувофиқат', ordering: 'Тартиб'
}

export function QuizBuilder({ quizId, onClose }: { quizId: string; onClose: () => void }) {
  const quiz = useApi<Entity>(`/admin/quizzes/${quizId}`)
  const questions = useApi<Question[]>(`/admin/quizzes/${quizId}/questions`)
  const [loc, setLoc] = useState<Loc>('tg')
  const act = useAction()
  if (quiz.error) return <ErrorState error={quiz.error} onRetry={quiz.reload} />
  if (!quiz.data) return <Loading />
  const q = quiz.data
  const go = async (to: string) => {
    if (await act.run(() => send(`/admin/quizzes/${quizId}/transition`, 'POST', { to }), 'Ҳолат иваз шуд')) quiz.reload()
  }
  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="icon-btn" aria-label="Бозгашт" onClick={onClose}><Icon name="back" /></button>
        <div style={{ flex: 1 }}><div className="eyebrow">Тест</div><h2 className="h-section" style={{ margin: 0 }}>{titleOf(q)}</h2></div>
        <StatusBadge status={q.status} />
      </div>
      <QuizSettings quiz={q} onSaved={quiz.reload} />
      <LocaleTabs value={loc} onChange={setLoc} />
      {questions.error ? <ErrorState error={questions.error} onRetry={questions.reload} /> : null}
      {(questions.data ?? []).map((item, i) => (
        <QuestionCard key={item.id} index={i} question={item} loc={loc} onChanged={questions.reload} />
      ))}
      <NewQuestion quizId={quizId} loc={loc} position={questions.data?.length ?? 0} onAdded={questions.reload} />
      <div className="card card-pad row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {(NEXT_STATUS[q.status ?? 'draft'] ?? []).map((n) => (
          <button key={n.to} type="button" className={n.to === 'published' ? 'btn' : 'btn btn-soft'} onClick={() => go(n.to)} disabled={act.busy}>{n.label}</button>
        ))}
      </div>
      <Note message={act.message} />
    </div>
  )
}

function QuizSettings({ quiz, onSaved }: { quiz: Entity; onSaved: () => void }) {
  const [pass, setPass] = useState(String(quiz.pass_score_percent ?? 70))
  const [reveal, setReveal] = useState((quiz.show_correct_answers as string) ?? 'after_submit')
  const act = useAction()
  const save = async () => {
    if (await act.run(() => send(`/admin/quizzes/${quiz.id}`, 'PATCH', {
      pass_score_percent: Number(pass) || 0, show_correct_answers: reveal, show_explanations: reveal
    }))) onSaved()
  }
  return (
    <div className="card card-pad stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 8 }}>
        <Field label="Холи гузариш (%)"><input className="input" inputMode="numeric" value={pass} onChange={(e) => setPass(e.target.value.replace(/\D/g, '').slice(0, 3))} /></Field>
        <Field label="Ҷавобҳои дурустро нишон додан">
          <select className="input" value={reveal} onChange={(e) => setReveal(e.target.value)}>
            <option value="after_each">Пас аз ҳар савол</option><option value="after_submit">Пас аз анҷом</option><option value="never">Ҳеҷ гоҳ</option>
          </select>
        </Field>
      </div>
      <button type="button" className="btn btn-soft" onClick={save} disabled={act.busy}>Захираи танзимот</button>
      <Note message={act.message} />
    </div>
  )
}

function correctIds(q: Question): string[] {
  const key = Array.isArray(q.answer_key) ? q.answer_key[0] : q.answer_key
  return key?.correct_option_ids ?? []
}

function QuestionCard({ index, question, loc, onChanged }: { index: number; question: Question; loc: Loc; onChanged: () => void }) {
  const act = useAction()
  const tr = question.translations.find((t) => t.locale === loc)
  const correct = new Set(correctIds(question))
  const remove = async () => {
    if (!confirm('Саволро нест кунем?')) return
    if (await act.run(() => send(`/admin/questions/${question.id}`, 'DELETE'), 'Нест шуд')) onChanged()
  }
  return (
    <div className="card card-pad stack" style={{ gap: 8 }} dir={loc === 'ar' ? 'rtl' : 'ltr'}>
      <div className="row" style={{ gap: 6 }}>
        <span className="eyebrow" style={{ flex: 1 }}>{index + 1}. {TYPE_LABEL[question.type] ?? question.type} · {question.points} хол</span>
        <button type="button" className="icon-btn" aria-label="Нест кардан" onClick={remove}>×</button>
      </div>
      <b style={{ fontWeight: 500 }}>{tr?.prompt ?? <span className="muted">— тарҷума нест —</span>}</b>
      {question.options.map((o) => (
        <div key={o.id} className="row" style={{ gap: 8 }}>
          <span aria-label={correct.has(o.id) ? 'дуруст' : undefined} style={{ width: 18, color: 'var(--ok)' }}>{correct.has(o.id) ? '✓' : '·'}</span>
          <span>{o.translations.find((t) => t.locale === loc)?.text ?? '—'}</span>
        </div>
      ))}
      <Note message={act.message} />
    </div>
  )
}

function NewQuestion({ quizId, loc, position, onAdded }: { quizId: string; loc: Loc; position: number; onAdded: () => void }) {
  const [type, setType] = useState('single_choice')
  const [prompt, setPrompt] = useState('')
  const [explanation, setExplanation] = useState('')
  const [options, setOptions] = useState<{ text: string; correct: boolean }[]>([{ text: '', correct: true }, { text: '', correct: false }])
  const [accepted, setAccepted] = useState('')
  const [points, setPoints] = useState('1')
  const act = useAction()
  const choice = type === 'single_choice' || type === 'multiple_choice'

  const add = async () => {
    const body: Record<string, unknown> = {
      type, position, points: Number(points) || 1,
      translations: { [loc]: { prompt, explanation_correct: explanation || null } }
    }
    if (choice) {
      const opts = options.filter((o) => o.text.trim())
      body.options = opts.map((o, i) => ({ ref: `o${i}`, translations: { [loc]: { text: o.text.trim() } } }))
      body.answer_key = { correct: opts.flatMap((o, i) => (o.correct ? [`o${i}`] : [])) }
    } else if (type === 'true_false') {
      const isTrue = options[0]?.correct ?? true
      body.options = [
        { ref: 'true', translations: { [loc]: { text: loc === 'ru' ? 'Верно' : loc === 'ar' ? 'صحيح' : 'Дуруст' } } },
        { ref: 'false', translations: { [loc]: { text: loc === 'ru' ? 'Неверно' : loc === 'ar' ? 'خطأ' : 'Нодуруст' } } }
      ]
      body.answer_key = { correct: [isTrue ? 'true' : 'false'] }
    } else if (type === 'short_answer') {
      body.answer_key = { accepted_answers: { [loc]: accepted.split('\n').map((s) => s.trim()).filter(Boolean) } }
    }
    if (await act.run(() => send(`/admin/quizzes/${quizId}/questions`, 'POST', body), 'Савол илова шуд')) {
      setPrompt('')
      setExplanation('')
      setAccepted('')
      setOptions([{ text: '', correct: true }, { text: '', correct: false }])
      onAdded()
    }
  }

  return (
    <div className="card card-pad stack" style={{ gap: 10 }} dir={loc === 'ar' ? 'rtl' : 'ltr'}>
      <div className="eyebrow">Саволи нав</div>
      <div className="row" style={{ gap: 8 }}>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} style={{ flex: 1 }}>
          {['single_choice', 'multiple_choice', 'true_false', 'short_answer', 'long_answer'].map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <input className="input" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ''))} style={{ width: 80 }} aria-label="Хол" />
      </div>
      <textarea className="input" placeholder="Матни савол" value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ minHeight: 80 }} />
      {choice ? (
        <div className="stack" style={{ gap: 6 }}>
          {options.map((o, i) => (
            <div key={i} className="row" style={{ gap: 8 }}>
              <input type={type === 'single_choice' ? 'radio' : 'checkbox'} name="correct" checked={o.correct} aria-label="Ҷавоби дуруст"
                onChange={(e) => setOptions(options.map((x, j) => ({ ...x, correct: type === 'single_choice' ? j === i : j === i ? e.target.checked : x.correct })))} />
              <input className="input" placeholder={`Вариант ${i + 1}`} value={o.text} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            </div>
          ))}
          <button type="button" className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setOptions([...options, { text: '', correct: false }])}>+ Вариант</button>
        </div>
      ) : null}
      {type === 'true_false' ? (
        <div className="segmented">
          <button type="button" aria-pressed={options[0]?.correct} onClick={() => setOptions([{ text: '', correct: true }])}>Дуруст</button>
          <button type="button" aria-pressed={!options[0]?.correct} onClick={() => setOptions([{ text: '', correct: false }])}>Нодуруст</button>
        </div>
      ) : null}
      {type === 'short_answer' ? (
        <Field label="Ҷавобҳои қабулшаванда (ҳар сатр як ҷавоб)"><textarea className="input" value={accepted} onChange={(e) => setAccepted(e.target.value)} style={{ minHeight: 70 }} /></Field>
      ) : null}
      <textarea className="input" placeholder="Шарҳ пас аз ҷавоби дуруст (ихтиёрӣ)" value={explanation} onChange={(e) => setExplanation(e.target.value)} style={{ minHeight: 60 }} />
      <button type="button" className="btn" onClick={add} disabled={act.busy || !prompt.trim()}>Илова кардани савол</button>
      <Note message={act.message} />
    </div>
  )
}

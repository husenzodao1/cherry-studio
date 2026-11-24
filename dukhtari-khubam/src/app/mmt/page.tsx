'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { nextQuestion, rankPrograms, studyPlan, subjectScore, type Answered, type MmtProgram, type MmtQuestion } from '@/lib/mmt'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { showToast } from '@/web/components/Toast'
import { askMahliyo, attempts, catalog, drawExam, history, keepAttempt, MmtError, programs as loadPrograms, saveCluster, savedCluster, type Attempt, type Catalog } from '@/web/offline/mmt'
import { usePlan } from '@/web/plans'
import { usePrefs } from '@/web/prefs'

const CLUSTERS = [1, 2, 3, 4, 5]
const PER = [5, 10, 20]
/** seconds per question in a mock exam (the whole exam's clock) */
const SECONDS_EACH = 90

type View = { kind: 'home' } | { kind: 'exam'; pool: MmtQuestion[]; per: number; subjects: string[] } | { kind: 'result'; answers: (Answered & { q: MmtQuestion; picked: number })[]; attempt: Attempt }

/**
 * ММТ: her cluster, a mock exam that adapts to her (right → harder, wrong → easier), her predicted score from
 * all her practice, her chances for each programme against last year's passing scores, and a plan to the exam
 * day with her weakest topics first. Everything is an estimate from practice — the page says so.
 */
export default function MmtPage() {
  const { t } = usePrefs()
  const router = useRouter()
  const { open } = usePlan()
  const [cat, setCat] = useState<Catalog | null>(null)
  const [failed, setFailed] = useState(false)
  const [cluster, setCluster] = useState<number | null>(null)
  const [progs, setProgs] = useState<MmtProgram[]>([])
  const [view, setView] = useState<View>({ kind: 'home' })
  const [chosen, setChosen] = useState<string[]>([])
  const [per, setPer] = useState(10)
  const [busy, setBusy] = useState(false)
  const [all, setAll] = useState(false)
  const [hist, setHist] = useState<Answered[]>([])
  const [tries, setTries] = useState<Attempt[]>([])

  useEffect(() => {
    setCluster(savedCluster())
    setHist(history())
    setTries(attempts())
    void catalog().then(setCat).catch(() => setFailed(true))
  }, [])
  useEffect(() => {
    if (!cluster) return
    saveCluster(cluster)
    void loadPrograms(cluster).then(setProgs).catch(() => setProgs([]))
  }, [cluster])

  const subjects = useMemo(() => (cat?.subjects ?? []).filter((s) => cluster && s.clusters.includes(cluster)), [cat, cluster])
  useEffect(() => { setChosen(subjects.filter((s) => s.questions > 0).map((s) => s.id)) }, [subjects])

  // her estimate from everything she answered in her cluster's subjects
  const predicted = useMemo(() => subjects.map((s) => {
    const mine = hist.filter((a) => a.subject === s.id)
    return { ...s, asked: mine.length, score: subjectScore(mine, s.max_points) }
  }), [subjects, hist])
  const total = predicted.reduce((n, s) => n + s.score, 0)
  const totalMax = predicted.reduce((n, s) => n + s.max_points, 0)
  const practiced = predicted.some((s) => s.asked > 0)
  const ranked = useMemo(() => rankPrograms(progs, total, totalMax), [progs, total, totalMax])
  const plan = useMemo(() => studyPlan(hist, subjects.map((s) => s.id), new Date(), cat?.exam_date ?? null), [hist, subjects, cat])
  const nameOf = (id: string) => cat?.subjects.find((s) => s.id === id)?.name ?? id

  const start = async () => {
    if (!chosen.length || busy) return
    setBusy(true)
    try {
      const pool = await drawExam(chosen, per)
      if (!pool.length) { showToast(t('mmt.no_questions'), 'alert'); return }
      setView({ kind: 'exam', pool, per, subjects: chosen })
    } catch (e) {
      if (e instanceof MmtError && e.status === 402) open('mmt')
      else showToast(t('state.error'), 'alert')
    } finally {
      setBusy(false)
    }
  }

  if (view.kind === 'exam') {
    return <Exam pool={view.pool} per={view.per} subjects={view.subjects} nameOf={nameOf} onDone={(answers) => {
      const scores = Object.fromEntries(view.subjects.map((id) => {
        const s = cat?.subjects.find((x) => x.id === id)
        const all = [...hist, ...answers].filter((a) => a.subject === id)
        return [id, subjectScore(all, s?.max_points ?? 100)]
      }))
      const attempt: Attempt = {
        at: new Date().toISOString(), cluster: cluster ?? 0, scores, total: Object.values(scores).reduce((a, b) => a + b, 0),
        max: view.subjects.reduce((n, id) => n + (cat?.subjects.find((x) => x.id === id)?.max_points ?? 100), 0),
        asked: answers.length, right: answers.filter((a) => a.right).length
      }
      keepAttempt(answers.map(({ subject, topic, difficulty, right }) => ({ subject, topic, difficulty, right })), attempt)
      setHist(history())
      setTries(attempts())
      setView({ kind: 'result', answers, attempt })
    }} onQuit={() => setView({ kind: 'home' })} />
  }

  if (view.kind === 'result') {
    const wrong = view.answers.filter((a) => !a.right)
    const a = view.attempt
    return (
      <>
        <Header onBack={() => setView({ kind: 'home' })} title={t('mmt.result')} />
        <div className="section stack" style={{ gap: 14 }}>
          <section className="glass card-pad mmt-score">
            <span className="eyebrow">{t('mmt.right_of').replace('{n}', String(a.right)).replace('{all}', String(a.asked))}</span>
            <b className="mmt-big">{Math.round(a.total)}<small> / {a.max}</small></b>
            <span className="muted" style={{ fontSize: '0.8em' }}>{t('mmt.estimate_note')}</span>
            {Object.entries(a.scores).map(([id, sc]) => {
              const max = cat?.subjects.find((x) => x.id === id)?.max_points ?? 100
              return <Bar key={id} label={nameOf(id)} value={sc} max={max} />
            })}
          </section>
          {wrong.length ? (
            <section className="glass card-pad stack" style={{ gap: 12 }}>
              <b>{t('mmt.mistakes')} · {wrong.length}</b>
              {wrong.map((w) => (
                <div key={w.q.id} className="mmt-review">
                  <p>{w.q.question}</p>
                  <span className="mmt-bad">✗ {w.q.options[w.picked] ?? '—'}</span>
                  <span className="mmt-good">✓ {w.q.options[w.q.answer]}</span>
                  {w.q.explanation ? <span className="muted">{w.q.explanation}</span> : null}
                  <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', padding: 0 }}
                    onClick={() => askMahliyo(t('mmt.ask_prefill').replace('{q}', w.q.question).replace('{a}', w.q.options[w.q.answer]), router.push)}>
                    {t('mmt.explain')}
                  </button>
                </div>
              ))}
            </section>
          ) : null}
          <button type="button" className="btn btn-block" onClick={() => setView({ kind: 'home' })}>{t('mmt.done')}</button>
        </div>
      </>
    )
  }

  return (
    <>
      <Header back="/schools" title={t('mmt.title')} />
      <div className="section stack" style={{ gap: 14 }}>
        {failed ? <div className="glass card-pad muted">{t('state.offline')}</div> : !cat ? <div className="skeleton" style={{ height: 200, borderRadius: 24 }} /> : (
          <>
            <section className="glass card-pad stack" style={{ gap: 10 }}>
              <b>{t('mmt.cluster')}</b>
              <div className="sos-chips">
                {CLUSTERS.map((c) => (
                  <button key={c} type="button" className="chip" aria-pressed={cluster === c} onClick={() => setCluster(c)}>{t('mmt.cluster_n').replace('{n}', String(c))}</button>
                ))}
              </div>
              {cat.exam_date && plan.daysLeft !== null ? <span className="muted">{t('mmt.days_left').replace('{n}', String(plan.daysLeft))}</span> : null}
            </section>

            {cluster ? (
              <>
                {!subjects.length ? <div className="glass card-pad muted">{t('mmt.no_subjects')}</div> : (
                  <section className="glass card-pad mmt-score">
                    <span className="eyebrow">{t('mmt.predicted')}</span>
                    {practiced ? <b className="mmt-big">{Math.round(total)}<small> / {totalMax}</small></b> : <span className="muted">{t('mmt.no_practice')}</span>}
                    {practiced ? predicted.map((s) => <Bar key={s.id} label={s.name} value={s.score} max={s.max_points} />) : null}
                    {tries.length > 1 ? <span className="muted" style={{ fontSize: '0.8em' }}>{t('mmt.trend').replace('{a}', String(Math.round(tries[tries.length - 2].total))).replace('{b}', String(Math.round(tries[tries.length - 1].total)))}</span> : null}
                    <span className="muted" style={{ fontSize: '0.78em' }}>{t('mmt.estimate_note')}</span>
                  </section>
                )}

                {subjects.length ? (
                  <section className="glass card-pad stack" style={{ gap: 10 }}>
                    <b>📝 {t('mmt.mock')}</b>
                    <div className="stack" style={{ gap: 6 }}>
                      {subjects.map((s) => (
                        <label key={s.id} className="row mmt-subject">
                          <input type="checkbox" disabled={!s.questions} checked={chosen.includes(s.id)}
                            onChange={(e) => setChosen(e.target.checked ? [...chosen, s.id] : chosen.filter((x) => x !== s.id))} />
                          <span className="grow">{s.name}</span>
                          <span className="muted" style={{ fontSize: '0.8em' }}>{s.questions ? t('mmt.n_questions').replace('{n}', String(s.questions)) : t('mmt.soon')}</span>
                        </label>
                      ))}
                    </div>
                    <div className="sos-chips">
                      {PER.map((n) => <button key={n} type="button" className="chip" aria-pressed={per === n} onClick={() => setPer(n)}>{t('mmt.per').replace('{n}', String(n))}</button>)}
                    </div>
                    <button type="button" className="btn" disabled={!chosen.length || busy} onClick={() => void start()}>{busy ? '…' : t('mmt.start')}</button>
                  </section>
                ) : null}

                {ranked.length ? (
                  <section className="glass card-pad stack" style={{ gap: 6 }}>
                    <b>🎓 {t('mmt.chances')}</b>
                    {!practiced ? <span className="muted" style={{ fontSize: '0.84em' }}>{t('mmt.chances_first')}</span> : null}
                    {(all ? ranked : ranked.slice(0, 8)).map((p) => (
                      <div key={p.id} className="mmt-program">
                        <span className="grow"><b>{p.specialty}</b><span>{p.university}{p.city ? `, ${p.city}` : ''} · {t(`mmt.form_${p.form}` as 'mmt.form_budget')}</span></span>
                        <span className="mmt-cut">{Number(p.min_score)}<small>{p.year}</small></span>
                        {practiced ? <span className={`mmt-chance is-${p.chance}`}>{t(`mmt.chance_${p.chance}` as 'mmt.chance_high')}</span> : null}
                      </div>
                    ))}
                    {ranked.length > 8 ? <button type="button" className="link-btn" onClick={() => setAll(!all)}>{all ? t('mmt.less') : t('mmt.all').replace('{n}', String(ranked.length))}</button> : null}
                  </section>
                ) : null}

                {practiced && plan.days.length ? (
                  <section className="glass card-pad stack" style={{ gap: 8 }}>
                    <b>🗓 {t('mmt.plan')}</b>
                    {plan.days.slice(0, 7).map((d) => (
                      <div key={d.day} className="mmt-day">
                        <span className="mmt-day-n">{d.day === 1 ? t('mmt.today') : d.date.slice(5).split('-').reverse().join('.')}</span>
                        <span className="grow">
                          {d.topics.map((tp) => (
                            <button key={`${tp.subject}${tp.topic}`} type="button" className="mmt-topic"
                              onClick={() => askMahliyo(t('mmt.topic_prefill').replace('{t}', tp.topic).replace('{s}', nameOf(tp.subject)), router.push)}>
                              {tp.topic}
                            </button>
                          ))}
                          <span className="muted" style={{ fontSize: '0.78em' }}>{t('mmt.q_a_day').replace('{n}', String(d.questions))}</span>
                        </span>
                      </div>
                    ))}
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="mmt-bar">
      <span className="row" style={{ justifyContent: 'space-between' }}><span>{label}</span><b>{Math.round(value)} / {max}</b></span>
      <span className="mmt-bar-track"><span style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></span>
    </div>
  )
}

/** The exam itself: one question at a time, chosen by her last answer, with the answer shown and explained. */
function Exam({ pool, per, subjects, nameOf, onDone, onQuit }: { pool: MmtQuestion[]; per: number; subjects: string[]; nameOf: (id: string) => string; onDone: (a: (Answered & { q: MmtQuestion; picked: number })[]) => void; onQuit: () => void }) {
  const { t } = usePrefs()
  const total = subjects.reduce((n, id) => n + Math.min(per, pool.filter((q) => q.subject === id).length), 0)
  const [answers, setAnswers] = useState<(Answered & { q: MmtQuestion; picked: number })[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [left, setLeft] = useState(total * SECONDS_EACH)
  const asked = useRef(new Set<string>())
  const finished = useRef(false)

  // the subject asked now: in turn, each until it has its share
  const subject = subjects.find((id) => answers.filter((a) => a.subject === id).length < Math.min(per, pool.filter((q) => q.subject === id).length)) ?? null
  const [current, setCurrent] = useState<MmtQuestion | null>(null)
  useEffect(() => {
    if (picked !== null || current || !subject) return
    const last = [...answers].reverse().find((a) => a.subject === subject) ?? null
    const q = nextQuestion(pool.filter((x) => x.subject === subject), asked.current, last)
    if (q) { asked.current.add(q.id); setCurrent(q) }
  }, [subject, picked, current, answers, pool])

  const finish = (list = answers) => { if (!finished.current) { finished.current = true; onDone(list) } }
  // the last answer read (its explanation too): the exam ends
  useEffect(() => {
    if (!subject && answers.length && picked === null) finish()
  }, [subject, picked]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => { if (s <= 1) { clearInterval(id); return 0 } return s - 1 }), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => { if (left === 0) finish() }, [left]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i: number) => {
    if (!current || picked !== null) return
    setPicked(i)
    setAnswers([...answers, { subject: current.subject, topic: current.topic, difficulty: current.difficulty, right: i === current.answer, q: current, picked: i }])
  }
  const next = () => { setPicked(null); setCurrent(null) }

  return (
    <>
      <Header onBack={() => { if (window.confirm(t('mmt.quit_q'))) onQuit() }} title={current ? nameOf(current.subject) : t('mmt.title')}
        end={<span className="mmt-clock">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>} />
      <div className="section stack" style={{ gap: 14 }}>
        <span className="mmt-progress"><span style={{ width: `${(answers.length / Math.max(1, total)) * 100}%` }} /></span>
        {current ? (
          <section className="glass card-pad stack" style={{ gap: 12 }}>
            <span className="eyebrow">{answers.length + (picked === null ? 1 : 0)} / {total}{current.topic ? ` · ${current.topic}` : ''}</span>
            <p className="mmt-question">{current.question}</p>
            <div className="stack" style={{ gap: 8 }}>
              {current.options.map((o, i) => {
                const state = picked === null ? '' : i === current.answer ? ' is-right' : i === picked ? ' is-wrong' : ''
                return <button key={i} type="button" className={`mmt-option${state}`} disabled={picked !== null} onClick={() => pick(i)}><b>{'АБВГДЕ'[i]}</b> {o}</button>
              })}
            </div>
            {picked !== null ? (
              <>
                {current.explanation ? <p className="muted" style={{ margin: 0 }}>{current.explanation}</p> : null}
                <button type="button" className="btn" onClick={next}>
                  <Icon name="forward" size={16} /> {t('mmt.next')}
                </button>
              </>
            ) : null}
          </section>
        ) : <div className="skeleton" style={{ height: 240, borderRadius: 24 }} />}
      </div>
    </>
  )
}

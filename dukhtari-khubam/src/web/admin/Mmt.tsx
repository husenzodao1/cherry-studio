'use client'

import { useState } from 'react'

import { programsFromCsv, questionsFromCsv, type ProgramRow, type QuestionRow } from '@/lib/mmt'

import { api } from '../api'
import { useApi } from '../useApi'
import { ErrorState, Loading } from '../components/States'
import { pagesOf } from '../files/bookText'
import { Field, Note, sendNow, useAction } from './ui'

/**
 * ММТ in the panel: the exam's day; the subjects (which clusters, how many points); the test bank — a table
 * (CSV from Excel) or a test book read by the AI, checked here before it is saved; the programmes with last
 * year's passing scores. The ММТ textbooks and the laws go to «Маҳлиё AI → Китобҳо» on their own shelf.
 */

interface Subject { id: string; name: string; clusters: number[]; max_points: number; questions: number }
interface Overview { catalog: { exam_date: string | null; subjects: Subject[] }; by_difficulty: Record<string, number>; programs: number; years: number[] }
interface Program extends ProgramRow { id: string }
interface StoredQuestion { id: string; question: string; options: string[]; answer: number; topic: string | null; difficulty: number }
type Draft = QuestionRow & { answer: number }

const QUESTION_TEMPLATE = 'Савол;А;Б;В;Г;Ҷавоб;Шарҳ;Мавзӯъ;Душворӣ\n"2 + 3 · 4 = ?";20;14;24;9;Б;Аввал зарб: 3·4=12, баъд 2+12=14;Тартиби амалҳо;1\n'
const PROGRAM_TEMPLATE = 'Донишгоҳ;Ихтисос;Рамз;Кластер;Сол;Шакл;Балл;Ҷойҳо;Шаҳр\nДМТ;Информатика;1-400101;1;2026;буҷа;512;25;Душанбе\n'
const download = (name: string, text: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
}
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)

export function Mmt() {
  const data = useApi<Overview>('/admin/mmt')
  const act = useAction()
  const [part, setPart] = useState<'subjects' | 'questions' | 'programs'>('subjects')
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />
  if (!data.data) return <Loading />
  const o = data.data
  return (
    <div className="stack" style={{ gap: 14 }}>
      <ExamDate value={o.catalog.exam_date} onSaved={data.reload} />
      <div className="segmented" role="tablist">
        {([['subjects', 'Фанҳо ва кластерҳо'], ['questions', 'Бонки тестҳо'], ['programs', 'Ихтисосҳо ва баллҳо']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={part === id} onClick={() => setPart(id)}>{label}</button>
        ))}
      </div>
      {part === 'subjects' ? <Subjects list={o.catalog.subjects} byDifficulty={o.by_difficulty} onChange={data.reload} />
        : part === 'questions' ? <Questions subjects={o.catalog.subjects} onChange={data.reload} />
        : <Programs count={o.programs} years={o.years} onChange={data.reload} />}
      <Note message={act.message} />
    </div>
  )
}

function ExamDate({ value, onSaved }: { value: string | null; onSaved: () => void }) {
  const act = useAction()
  const [date, setDate] = useState(value ?? '')
  return (
    <section className="glass card-pad stack" style={{ gap: 8 }}>
      <b>📅 Рӯзи ММТ</b>
      <span className="muted" style={{ fontSize: '0.84em' }}>Хонандагон шумораи рӯзҳоро мебинанд ва нақшаи омӯзиш то ҳамин рӯз сохта мешавад.</span>
      <div className="row" style={{ gap: 8 }}>
        <input className="input grow" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Рӯзи ММТ" />
        <button type="button" className="btn" disabled={act.busy}
          onClick={() => void act.run(() => sendNow('/admin/premium/setting', 'POST', { key: 'mmt_exam_date', value: date || null })).then(onSaved)}>Сабт</button>
      </div>
      <Note message={act.message} />
    </section>
  )
}

function Subjects({ list, byDifficulty, onChange }: { list: Subject[]; byDifficulty: Record<string, number>; onChange: () => void }) {
  const act = useAction()
  const empty = { id: '', name: '', clusters: [] as number[], max_points: 100, position: list.length }
  const [form, setForm] = useState(empty)
  const save = async () => {
    const id = form.id || slug(form.name)
    if (!/^[a-z0-9_]{2,40}$/.test(id)) { act.setMessage({ ok: false, text: 'Рамзи фан бо ҳарфҳои лотинӣ лозим (масалан math, tajik_lang)' }); return }
    if (await act.run(() => sendNow('/admin/mmt/subject', 'POST', { ...form, id }))) { setForm(empty); onChange() }
  }
  return (
    <div className="stack" style={{ gap: 12 }}>
      <section className="glass card-pad stack" style={{ gap: 10 }}>
        <b>{form.id && list.some((s) => s.id === form.id) ? 'Тағйири фан' : 'Фани нав'}</b>
        <Field label="Номи фан"><input className="input" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Рамз (лотинӣ)" hint="Барои фанҳои нав: math, physics, tajik_lang …">
          <input className="input" value={form.id} maxLength={40} placeholder={slug(form.name) || 'math'} onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase() })} />
        </Field>
        {/* not a <label>: the cluster buttons keep their own names */}
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">Дар кадом кластерҳо</span>
          <div className="sos-chips">
            {[1, 2, 3, 4, 5].map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={form.clusters.includes(c)}
                onClick={() => setForm({ ...form, clusters: form.clusters.includes(c) ? form.clusters.filter((x) => x !== c) : [...form.clusters, c].sort() })}>
                Кластери {c}
              </button>
            ))}
          </div>
        </div>
        <Field label="Балли ҳадди аксар" hint="Чанд балл ин фан дар ММТ дорад (барои ҳисоби пешгӯӣ)">
          <input className="input" type="number" min={1} max={1000} value={form.max_points} onChange={(e) => setForm({ ...form, max_points: Number(e.target.value) })} />
        </Field>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn grow" disabled={act.busy || !form.name.trim() || !form.clusters.length} onClick={() => void save()}>Сабт</button>
          {form.name ? <button type="button" className="btn btn-soft" onClick={() => setForm(empty)}>Бекор</button> : null}
        </div>
        <Note message={act.message} />
      </section>
      {list.map((s) => (
        <div key={s.id} className="glass card-pad row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <b>{s.name} <span className="muted" style={{ fontWeight: 400 }}>({s.id})</span></b>
            <span className="muted" style={{ fontSize: '0.8em' }}>
              Кластер: {s.clusters.join(', ')} · {s.max_points} балл · {s.questions} савол
              ({[1, 2, 3].map((d) => byDifficulty[`${s.id}:${d}`] ?? 0).join(' / ')} осон/миёна/душвор)
            </span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn-soft" onClick={() => setForm({ id: s.id, name: s.name, clusters: s.clusters, max_points: s.max_points, position: list.indexOf(s) })}>Тағйир</button>
            <button type="button" className="btn btn-soft" onClick={() => { if (confirm(`«${s.name}» бо ҳамаи саволҳояш бардошта шавад?`)) void sendNow('/admin/mmt/subject/remove', 'POST', { id: s.id }).then(onChange) }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function Questions({ subjects, onChange }: { subjects: Subject[]; onChange: () => void }) {
  const act = useAction()
  const [subject, setSubject] = useState(subjects[0]?.id ?? '')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [bad, setBad] = useState<number[]>([])
  const [text, setText] = useState('')
  const [reading, setReading] = useState<string | null>(null)
  const recent = useApi<{ questions: StoredQuestion[] }>(subject ? `/admin/mmt/questions?subject=${subject}` : null)

  const fromTable = (csv: string) => {
    const r = questionsFromCsv(csv)
    setDrafts(r.rows)
    setBad(r.bad)
  }
  // a test book (or pasted pages): the AI copies out its questions, a part at a time
  const fromBook = async (source: string) => {
    const parts: string[] = []
    for (let i = 0; i < source.length; i += 15_000) parts.push(source.slice(i, i + 15_000))
    const found: Draft[] = []
    for (const [i, part] of parts.entries()) {
      setReading(`AI китобро мехонад: ${i + 1} аз ${parts.length}…`)
      try {
        const r = await api<{ questions: { question: string; options: string[]; answer: number; explanation?: string; topic?: string; difficulty?: 1 | 2 | 3 }[] }>('/admin/mmt/extract', { method: 'POST', body: { text: part } })
        found.push(...r.questions.map((q) => ({ ...q, difficulty: q.difficulty ?? 2 })))
        setDrafts([...found])
      } catch {
        act.setMessage({ ok: false, text: `Қисми ${i + 1} хонда нашуд — боз кӯшиш кунед` })
      }
    }
    setReading(null)
    setBad([])
  }
  const readFile = async (f: File) => {
    if (/\.(csv|tsv)$/i.test(f.name)) return fromTable(await f.text())
    setReading('Матни файл хонда мешавад…')
    const pages = await pagesOf(f).catch(() => [] as string[])
    if (!pages.join('').trim()) { setReading(null); act.setMessage({ ok: false, text: 'Дар файл матн нест (шояд скан аст)' }); return }
    await fromBook(pages.join('\n\n'))
  }
  const ready = drafts.filter((d) => d.answer >= 0 && d.answer < d.options.length)
  const save = async () => {
    const r = await act.run(() => sendNow<{ added: number }>('/admin/mmt/questions/import', 'POST', { subject, rows: ready }), 'Сабт шуд')
    if (r) { act.setMessage({ ok: true, text: `${r.added} савол илова шуд (такрориҳо гузаронда шуданд)` }); setDrafts([]); setText(''); recent.reload(); onChange() }
  }

  if (!subjects.length) return <p className="muted">Аввал дар «Фанҳо ва кластерҳо» фан илова кунед.</p>
  return (
    <div className="stack" style={{ gap: 12 }}>
      <section className="glass card-pad stack" style={{ gap: 10 }}>
        <Field label="Фан">
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.questions})</option>)}
          </select>
        </Field>
        <b>Илова кардани саволҳо</b>
        <span className="muted" style={{ fontSize: '0.84em' }}>
          1) Ҷадвал аз Excel (CSV): савол, вариантҳо, ҷавоби дуруст, шарҳ, мавзӯъ, душворӣ (1–3).
          2) Китоби тест (PDF, Word, матн): AI саволҳоро айнан мебарорад; шумо месанҷед ва ҷавоби дурустро тасдиқ мекунед.
        </span>
        <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => download('mmt-savolho.csv', QUESTION_TEMPLATE)}>⬇ Намунаи ҷадвал</button>
        <input type="file" accept=".csv,.tsv,.pdf,.docx,.txt" disabled={!!reading} aria-label="Файли саволҳо"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void readFile(f) }} />
        <textarea className="input" rows={5} value={text} placeholder="…ё матни саҳифаҳои китоби тестро ин ҷо гузоред" onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-soft grow" disabled={!text.trim() || !!reading} onClick={() => fromTable(text)}>Ҳамчун ҷадвал</button>
          <button type="button" className="btn btn-soft grow" disabled={text.trim().length < 20 || !!reading} onClick={() => void fromBook(text)}>✨ AI хонад</button>
        </div>
        {reading ? <p role="status" style={{ margin: 0 }}>{reading}</p> : null}
        {bad.length ? <p style={{ margin: 0, color: 'var(--bad)' }}>Сатрҳои хондашуда нашуданд: {bad.slice(0, 20).join(', ')}{bad.length > 20 ? '…' : ''}</p> : null}
        <Note message={act.message} />
      </section>

      {drafts.length ? (
        <section className="glass card-pad stack" style={{ gap: 10 }}>
          <b>Санҷед · {drafts.length} савол ({ready.length} бо ҷавоб)</b>
          {drafts.map((d, i) => (
            <div key={i} className="mmt-review">
              <p>{i + 1}. {d.question}</p>
              <select className="input" value={d.answer} aria-label={`Ҷавоби саволи ${i + 1}`}
                onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, answer: Number(e.target.value) } : x)))}>
                <option value={-1}>— ҷавоби дурустро интихоб кунед —</option>
                {d.options.map((o, k) => <option key={k} value={k}>{'АБВГДЕ'[k]}) {o}</option>)}
              </select>
              <span className="muted" style={{ fontSize: '0.8em' }}>{d.topic ?? '—'} · душворӣ {d.difficulty}{d.explanation ? ` · ${d.explanation.slice(0, 80)}` : ''}</span>
              <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}>Нагирифтан</button>
            </div>
          ))}
          <button type="button" className="btn" disabled={!ready.length || act.busy} onClick={() => void save()}>Сабти {ready.length} савол</button>
        </section>
      ) : null}

      {recent.data?.questions.length ? (
        <section className="glass card-pad stack" style={{ gap: 6 }}>
          <b>Саволҳои охирин</b>
          {recent.data.questions.map((q) => (
            <div key={q.id} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <span className="grow" style={{ fontSize: '0.86em' }}>{q.question.slice(0, 120)} <span className="muted">→ {q.options[q.answer]}</span></span>
              <button type="button" className="btn btn-soft" onClick={() => void sendNow('/admin/mmt/questions/remove', 'POST', { id: q.id }).then(() => { recent.reload(); onChange() })}>✕</button>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  )
}

function Programs({ count, years, onChange }: { count: number; years: number[]; onChange: () => void }) {
  const act = useAction()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ProgramRow[]>([])
  const [bad, setBad] = useState<number[]>([])
  const list = useApi<{ programs: Program[] }>(`/admin/mmt/programs${q.trim().length >= 2 ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
  const read = (csv: string) => { const r = programsFromCsv(csv); setRows(r.rows); setBad(r.bad) }
  const save = async () => {
    const r = await act.run(() => sendNow<{ added: number }>('/admin/mmt/programs/import', 'POST', { rows }))
    if (r) { act.setMessage({ ok: true, text: `${r.added} ихтисос сабт шуд` }); setRows([]); list.reload(); onChange() }
  }
  return (
    <div className="stack" style={{ gap: 12 }}>
      <section className="glass card-pad stack" style={{ gap: 10 }}>
        <b>Ихтисосҳо ва балли гузариш</b>
        <span className="muted" style={{ fontSize: '0.84em' }}>
          Ҳоло: {count} сатр{years.length ? ` · солҳо: ${years.join(', ')}` : ''}. Ҷадвали соли нав ҳамон солро пурра иваз мекунад.
          Хонандагон имкони худро бо балли гузариши соли охирин муқоиса мекунанд.
        </span>
        <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => download('mmt-ixtisosho.csv', PROGRAM_TEMPLATE)}>⬇ Намунаи ҷадвал</button>
        <input type="file" accept=".csv,.tsv,.txt" aria-label="Ҷадвали ихтисосҳо" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void f.text().then(read) }} />
        {bad.length ? <p style={{ margin: 0, color: 'var(--bad)' }}>Сатрҳои хондашуда нашуданд: {bad.slice(0, 20).join(', ')}</p> : null}
        {rows.length ? <button type="button" className="btn" disabled={act.busy} onClick={() => void save()}>Сабти {rows.length} ихтисос</button> : null}
        <Note message={act.message} />
      </section>
      <input className="input" value={q} placeholder="Ҷустуҷӯ: донишгоҳ ё ихтисос" onChange={(e) => setQ(e.target.value)} aria-label="Ҷустуҷӯи ихтисос" />
      {list.data?.programs.map((p) => (
        <div key={p.id} className="glass card-pad row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <span className="grow" style={{ fontSize: '0.88em' }}><b>{p.specialty}</b> — {p.university} · кл. {p.cluster} · {p.year} · {p.form} · <b>{Number(p.min_score)}</b></span>
          <button type="button" className="btn btn-soft" onClick={() => void sendNow('/admin/mmt/programs/remove', 'POST', { id: p.id }).then(() => { list.reload(); onChange() })}>✕</button>
        </div>
      ))}
    </div>
  )
}

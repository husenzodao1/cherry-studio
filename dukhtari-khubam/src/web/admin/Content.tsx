'use client'

import { useEffect, useState } from 'react'

import { Icon } from '../components/Icon'
import { ErrorState, Loading } from '../components/States'
import { useApi } from '../useApi'
import { BlocksEditor } from './BlocksEditor'
import { CodeHub } from './CodeHub'
import { QuizBuilder } from './QuizBuilder'
import {
  Field, LocaleTabs, NEXT_STATUS, Note, send, StatusBadge, titleOf, useAction, type Entity, type Loc, sendNow } from './ui'

/** Content tree: schools → courses → modules → topics → lessons, each with translations and workflow. */

type Level = 'schools' | 'courses' | 'modules' | 'topics' | 'lessons'
const CHILD: Record<Level, Level | null> = { schools: 'courses', courses: 'modules', modules: 'topics', topics: 'lessons', lessons: null }
const PARENT_KEY: Record<Level, string | null> = { schools: null, courses: 'school_id', modules: 'course_id', topics: 'module_id', lessons: 'topic_id' }
const LEVEL_NAME: Record<Level, string> = { schools: 'Мактабҳо', courses: 'Курсҳо', modules: 'Модулҳо', topics: 'Мавзӯъҳо', lessons: 'Дарсҳо' }
const ONE: Record<Level, string> = { schools: 'мактаб', courses: 'курс', modules: 'модул', topics: 'мавзӯъ', lessons: 'дарс' }
const TEXT_FIELD: Record<Level, string> = { schools: 'description', courses: 'description', modules: 'description', topics: 'description', lessons: 'summary' }

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'gh', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', ӣ: 'i', й: 'y', к: 'k', қ: 'q', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ӯ: 'u', ф: 'f', х: 'kh', ҳ: 'h', ч: 'ch', ҷ: 'j', ш: 'sh',
  ъ: '', э: 'e', ю: 'yu', я: 'ya', ы: 'y', ь: '', щ: 'sh', ц: 'ts'
}
export function slugify(title: string): string {
  const base = title.toLowerCase().split('').map((c) => TRANSLIT[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `${base || 'item'}-${Math.random().toString(36).slice(2, 6)}`
}

interface Crumb { level: Level; parentId: string | null; title: string }

/** The panel's mode: the girls' or the boys' schools (and everything in them) are shown and made. */
export type Audience = 'girls' | 'boys'

export function Content({ audience }: { audience: Audience }) {
  const [trail, setTrail] = useState<Crumb[]>([{ level: 'schools', parentId: null, title: audience === 'boys' ? 'Мактабҳои писарон' : 'Мактабҳои духтарон' }])
  // another mode: back to its schools
  useEffect(() => { setTrail([{ level: 'schools', parentId: null, title: audience === 'boys' ? 'Мактабҳои писарон' : 'Мактабҳои духтарон' }]); setEditing(null) }, [audience])
  const [editing, setEditing] = useState<{ level: Level; id: string } | null>(null)
  const here = trail[trail.length - 1]

  if (editing) {
    return <EntityEditor level={editing.level} id={editing.id} onClose={() => setEditing(null)} />
  }
  return (
    <div className="stack">
      <nav className="row" style={{ flexWrap: 'wrap', gap: 6 }} aria-label="Роҳ">
        {trail.map((c, i) => (
          <button key={i} type="button" className="chip" aria-pressed={i === trail.length - 1}
            onClick={() => setTrail(trail.slice(0, i + 1))}>{c.title}</button>
        ))}
      </nav>
      <Level level={here.level} parentId={here.parentId} audience={audience}
        onOpen={(e) => {
          const child = CHILD[here.level]
          if (child) setTrail([...trail, { level: child, parentId: e.id, title: titleOf(e) }])
        }}
        onEdit={(e) => setEditing({ level: here.level, id: e.id })} />
    </div>
  )
}

function Level({ level, parentId, audience, onOpen, onEdit }: { level: Level; parentId: string | null; audience: Audience; onOpen: (e: Entity) => void; onEdit: (e: Entity) => void }) {
  const key = PARENT_KEY[level]
  const list = useApi<{ items: Entity[] }>(`/admin/${level}?limit=200${key && parentId ? `&${key}=${parentId}` : ''}${level === 'schools' ? `&audience=${audience}` : ''}`)
  const [title, setTitle] = useState('')
  const act = useAction()
  const items = list.data?.items ?? []

  const create = async () => {
    if (!title.trim()) return
    const body: Record<string, unknown> = { translations: { tg: { title: title.trim(), ready: true } }, position: items.length }
    if (key && parentId) body[key] = parentId
    if (level === 'schools' || level === 'courses') body.slug = slugify(title)
    if (level === 'schools') body.audience = audience
    const r = await act.run(() => sendNow(`/admin/${level}`, 'POST', body), 'Илова шуд')
    if (r) {
      setTitle('')
      list.reload()
    }
  }
  const move = async (index: number, dir: -1 | 1) => {
    const ids = items.map((i) => i.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    if (await act.run(() => send(`/admin/${level}/reorder`, 'POST', { ids }), 'Тартиб нав шуд')) list.reload()
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <h2 className="h-section" style={{ margin: 0 }}>{LEVEL_NAME[level]}</h2>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
      {list.loading && !list.data ? <Loading rows={2} /> : null}
      {items.map((e, i) => (
        <div key={e.id} className="card card-pad row" style={{ padding: 12, gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontWeight: 500 }}>{titleOf(e)}</b>
            <div className="row" style={{ gap: 6, marginTop: 4 }}><StatusBadge status={e.status} />
              <span className="muted" style={{ fontSize: '0.78em' }}>{(e.translations ?? []).map((t) => t.locale).join(' · ')}</span></div>
          </div>
          <button type="button" className="icon-btn" aria-label="Боло" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
          <button type="button" className="icon-btn" aria-label="Поён" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
          <button type="button" className="icon-btn" aria-label="Таҳрир" onClick={() => onEdit(e)}><Icon name="settings" size={18} /></button>
          {CHILD[level] ? <button type="button" className="icon-btn" aria-label="Кушодан" onClick={() => onOpen(e)}><Icon name="forward" size={18} /></button> : null}
        </div>
      ))}
      {list.data && !items.length ? <p className="muted" style={{ margin: 0 }}>Ҳоло холӣ аст.</p> : null}
      <div className="row" style={{ gap: 8 }}>
        <input className="input" placeholder={`Номи ${ONE[level]}и нав (тоҷикӣ)`} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" className="btn" onClick={create} disabled={act.busy || !title.trim()}>Илова</button>
      </div>
      <Note message={act.message} />
    </div>
  )
}

function EntityEditor({ level, id, onClose }: { level: Level; id: string; onClose: () => void }) {
  const item = useApi<Entity>(`/admin/${level}/${id}`)
  const [loc, setLoc] = useState<Loc>('tg')
  const [mode, setMode] = useState<'info' | 'blocks' | 'code' | 'quizzes'>('info')
  if (item.error) return <ErrorState error={item.error} onRetry={item.reload} />
  if (!item.data) return <Loading />
  const e = item.data
  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="icon-btn" aria-label="Бозгашт" onClick={onClose}><Icon name="back" /></button>
        <div style={{ flex: 1 }}><div className="eyebrow">{ONE[level]}</div><h2 className="h-section" style={{ margin: 0 }}>{titleOf(e)}</h2></div>
        <StatusBadge status={e.status} />
      </div>
      {level === 'lessons' ? (
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'info'} onClick={() => setMode('info')}>Маълумот</button>
          <button type="button" role="tab" aria-selected={mode === 'blocks'} onClick={() => setMode('blocks')}>Матни дарс</button>
          <button type="button" role="tab" aria-selected={mode === 'code'} onClick={() => setMode('code')}>CodeHub</button>
          <button type="button" role="tab" aria-selected={mode === 'quizzes'} onClick={() => setMode('quizzes')}>Тестҳо</button>
        </div>
      ) : null}
      {mode === 'blocks' ? <BlocksEditor lessonId={id} /> : mode === 'code' ? <CodeHub lessonId={id} /> : mode === 'quizzes' ? <LessonQuizzes lessonId={id} /> : (
        <>
          <LocaleTabs value={loc} onChange={setLoc} />
          <TranslationForm key={`${loc}-${e.id}`} level={level} entity={e} locale={loc} onSaved={item.reload} />
          <FieldsForm level={level} entity={e} onSaved={item.reload} />
          <Workflow level={level} entity={e} onDone={item.reload} onDeleted={onClose} />
        </>
      )}
    </div>
  )
}

function TranslationForm({ level, entity, locale, onSaved }: { level: Level; entity: Entity; locale: Loc; onSaved: () => void }) {
  const tr = (entity.translations ?? []).find((t) => t.locale === locale)
  const textField = TEXT_FIELD[level]
  const [title, setTitle] = useState((tr?.title as string) ?? '')
  const [text, setText] = useState((tr?.[textField] as string) ?? '')
  const [ready, setReady] = useState(!!tr?.ready)
  const act = useAction()
  const save = async () => {
    const body: Record<string, unknown> = { title, [textField]: text || null, ready }
    if (await act.run(() => send(`/admin/${level}/${entity.id}/translations/${locale}`, 'PUT', body))) onSaved()
  }
  return (
    <div className="card card-pad stack">
      <Field label="Сарлавҳа"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></Field>
      <Field label={textField === 'summary' ? 'Муқаддима (Lead)' : 'Тавсиф'}>
        <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
      </Field>
      <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={ready} onChange={(e) => setReady(e.target.checked)} /> Ин забон барои нашр тайёр аст</label>
      <button type="button" className="btn" onClick={save} disabled={act.busy || !title.trim()}>Захираи тарҷума</button>
      <Note message={act.message} />
    </div>
  )
}

function FieldsForm({ level, entity, onSaved }: { level: Level; entity: Entity; onSaved: () => void }) {
  const [theme, setTheme] = useState((entity.theme_color as string) ?? '#a78bcb')
  const [tier, setTier] = useState((entity.access_tier as string) ?? 'free')
  const [minutes, setMinutes] = useState(entity.estimated_minutes != null ? String(entity.estimated_minutes) : '')
  const act = useAction()
  if (level === 'modules' || level === 'topics') return null
  const save = async () => {
    const body: Record<string, unknown> = {}
    if (level === 'schools') body.theme_color = theme
    if (level !== 'schools') body.estimated_minutes = minutes ? Number(minutes) : null
    body.access_tier = tier
    if (await act.run(() => send(`/admin/${level}/${entity.id}`, 'PATCH', body))) onSaved()
  }
  return (
    <div className="card card-pad stack">
      {level === 'schools' ? (
        <Field label="Ранги мактаб"><input type="color" value={theme} onChange={(e) => setTheme(e.target.value)} style={{ width: 64, height: 40, border: 0, background: 'none' }} /></Field>
      ) : (
        <Field label="Давомнокӣ (дақиқа)"><input className="input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} /></Field>
      )}
      <Field label="Дастрасӣ">
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={tier === 'free'} onClick={() => setTier('free')}>Ройгон</button>
          <button type="button" role="tab" aria-selected={tier === 'premium'} onClick={() => setTier('premium')}>Premium</button>
        </div>
      </Field>
      <button type="button" className="btn btn-soft" onClick={save} disabled={act.busy}>Захираи танзимот</button>
      <Note message={act.message} />
    </div>
  )
}

function Workflow({ level, entity, onDone, onDeleted }: { level: Level; entity: Entity; onDone: () => void; onDeleted: () => void }) {
  const act = useAction()
  const [issues, setIssues] = useState<string[] | null>(null)
  const status = entity.status ?? 'draft'
  const go = async (to: string) => {
    if (await act.run(() => send(`/admin/${level}/${entity.id}/transition`, 'POST', { to }), 'Ҳолат иваз шуд')) onDone()
  }
  const check = async () => {
    const r = await act.run(() => sendNow<{ errors: { message?: string; code?: string }[] | null }>(`/admin/${level}/${entity.id}/validate`, 'GET'), 'Санҷида шуд')
    if (r) setIssues((r.errors ?? []).map((x) => x.message ?? x.code ?? JSON.stringify(x)))
  }
  const remove = async () => {
    if (!confirm('Нест кунем? Танҳо он чизе ки ҳеҷ гоҳ нашр нашудааст, нест мешавад.')) return
    if (await act.run(() => send(`/admin/${level}/${entity.id}`, 'DELETE'), 'Нест шуд')) onDeleted()
  }
  return (
    <div className="card card-pad stack">
      <div className="eyebrow">Нашр</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {(NEXT_STATUS[status] ?? []).map((n) => (
          <button key={n.to} type="button" className={n.to === 'published' ? 'btn' : 'btn btn-soft'} onClick={() => go(n.to)} disabled={act.busy}>{n.label}</button>
        ))}
        <button type="button" className="btn btn-soft" onClick={check} disabled={act.busy}>Санҷиш</button>
        <button type="button" className="btn btn-soft" onClick={remove} disabled={act.busy} style={{ color: 'var(--bad)' }}>Нест кардан</button>
      </div>
      {issues ? (issues.length ? <ul style={{ margin: 0 }}>{issues.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted" style={{ margin: 0 }}>Барои нашр тайёр аст.</p>) : null}
      <Note message={act.message} />
    </div>
  )
}

function LessonQuizzes({ lessonId }: { lessonId: string }) {
  const list = useApi<{ items: Entity[] }>(`/admin/quizzes?limit=50&lesson_id=${lessonId}`)
  const [open, setOpen] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const act = useAction()
  if (open) return <QuizBuilder quizId={open} onClose={() => { setOpen(null); list.reload() }} />
  const create = async () => {
    const body = { slug: slugify(title), lesson_id: lessonId, translations: { tg: { title, ready: true } } }
    if (await act.run(() => send('/admin/quizzes', 'POST', body), 'Тест сохта шуд')) {
      setTitle('')
      list.reload()
    }
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
      {(list.data?.items ?? []).map((q) => (
        <button key={q.id} type="button" className="card card-pad row" style={{ padding: 12, textAlign: 'start', cursor: 'pointer' }} onClick={() => setOpen(q.id)}>
          <b style={{ flex: 1, fontWeight: 500 }}>{titleOf(q)}</b><StatusBadge status={q.status} /><Icon name="forward" size={18} />
        </button>
      ))}
      <div className="row" style={{ gap: 8 }}>
        <input className="input" placeholder="Номи тести нав" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" className="btn" onClick={create} disabled={act.busy || !title.trim()}>Илова</button>
      </div>
      <Note message={act.message} />
    </div>
  )
}

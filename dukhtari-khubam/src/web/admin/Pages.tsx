'use client'

import { useState } from 'react'

import { Icon } from '../components/Icon'
import { ErrorState, Loading } from '../components/States'
import { useApi } from '../useApi'
import { blocksToText, textToBlocks } from './docText'
import { Field, LocaleTabs, NEXT_STATUS, Note, send, StatusBadge, titleOf, useAction, type Entity, type Loc } from './ui'

/** Document pages shown from Settings: "Дар бораи барнома", privacy, terms. Plain text, laid out like a document. */
const STANDARD: { slug: string; title: string }[] = [
  { slug: 'about', title: 'Дар бораи барнома' }, { slug: 'privacy', title: 'Махфият' }, { slug: 'terms', title: 'Шартҳои истифода' }
]

export function Pages() {
  const list = useApi<{ items: Entity[] }>('/admin/pages?limit=50')
  const [open, setOpen] = useState<string | null>(null)
  const act = useAction()
  if (open) return <PageEditor id={open} onClose={() => { setOpen(null); list.reload() }} />
  const items = list.data?.items ?? []
  const missing = STANDARD.filter((s) => !items.some((i) => i.slug === s.slug))
  const create = async (slug: string, title: string) => {
    const r = await act.run(() => send<{ id: string }>('/admin/pages', 'POST', { slug, translations: { tg: { title, body: [], ready: true } } }), 'Сохта шуд')
    if (r?.id) setOpen(r.id)
    else list.reload()
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <h2 className="h-section" style={{ margin: 0 }}>Саҳифаҳо</h2>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
      {list.loading && !list.data ? <Loading rows={2} /> : null}
      {items.map((p) => (
        <button key={p.id} type="button" className="card card-pad row" style={{ padding: 12, textAlign: 'start', cursor: 'pointer' }} onClick={() => setOpen(p.id)}>
          <span style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{titleOf(p)}</b><span className="muted" style={{ display: 'block', fontSize: '0.8em' }}>{p.slug}</span></span>
          <StatusBadge status={p.status} /><Icon name="forward" size={18} />
        </button>
      ))}
      {missing.map((s) => (
        <button key={s.slug} type="button" className="btn btn-soft" onClick={() => create(s.slug, s.title)} disabled={act.busy}>+ {s.title}</button>
      ))}
      <Note message={act.message} />
    </div>
  )
}

function PageEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const page = useApi<Entity>(`/admin/pages/${id}`)
  const [loc, setLoc] = useState<Loc>('tg')
  if (page.error) return <ErrorState error={page.error} onRetry={page.reload} />
  if (!page.data) return <Loading />
  const p = page.data
  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="icon-btn" aria-label="Бозгашт" onClick={onClose}><Icon name="back" /></button>
        <div style={{ flex: 1 }}><div className="eyebrow">Саҳифа · {p.slug}</div><h2 className="h-section" style={{ margin: 0 }}>{titleOf(p)}</h2></div>
        <StatusBadge status={p.status} />
      </div>
      <LocaleTabs value={loc} onChange={setLoc} />
      <PageText key={`${loc}-${p.id}`} page={p} locale={loc} onSaved={page.reload} />
      <PageWorkflow page={p} onDone={page.reload} />
    </div>
  )
}

function PageText({ page, locale, onSaved }: { page: Entity; locale: Loc; onSaved: () => void }) {
  const tr = (page.translations ?? []).find((t) => t.locale === locale)
  const [title, setTitle] = useState((tr?.title as string) ?? '')
  const [text, setText] = useState(blocksToText(tr?.body))
  const [ready, setReady] = useState(!!tr?.ready)
  const act = useAction()
  const save = async () => {
    if (await act.run(() => send(`/admin/pages/${page.id}/translations/${locale}`, 'PUT', { title, body: textToBlocks(text), ready }), 'Захира шуд')) onSaved()
  }
  return (
    <div className="card card-pad stack" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Field label="Сарлавҳа"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></Field>
      <Field label="Матн">
        <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 320, fontFamily: 'ui-monospace, monospace', fontSize: '0.9em' }} />
      </Field>
      <p className="muted" style={{ margin: 0, fontSize: '0.8em', lineHeight: 1.6 }}>
        <code># Сарлавҳа</code> · <code>## Сарлавҳаи хурд</code> · <code>- банд</code> · <code>1. банд</code> · <code>&gt; иқтибос</code> · <code>---</code> хат ·
        <code>**ғафс**</code> · <code>*курсив*</code>. Сатри холӣ — сархати нав.
      </p>
      <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={ready} onChange={(e) => setReady(e.target.checked)} /> Ин забон барои нашр тайёр аст</label>
      <button type="button" className="btn" onClick={save} disabled={act.busy || !title.trim()}>Захира</button>
      <Note message={act.message} />
    </div>
  )
}

function PageWorkflow({ page, onDone }: { page: Entity; onDone: () => void }) {
  const act = useAction()
  const go = async (to: string) => {
    if (await act.run(() => send(`/admin/pages/${page.id}/transition`, 'POST', { to }), 'Ҳолат иваз шуд')) onDone()
  }
  return (
    <div className="card card-pad stack">
      <div className="eyebrow">Нашр</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {(NEXT_STATUS[page.status ?? 'draft'] ?? []).map((n) => (
          <button key={n.to} type="button" className={n.to === 'published' ? 'btn' : 'btn btn-soft'} onClick={() => go(n.to)} disabled={act.busy}>{n.label}</button>
        ))}
      </div>
      <Note message={act.message} />
    </div>
  )
}

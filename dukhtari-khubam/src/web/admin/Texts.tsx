'use client'

import { useState } from 'react'

import { ErrorState, Loading } from '../components/States'
import { DEFAULT_STRINGS } from '../i18n'
import { useApi } from '../useApi'
import { Field, LocaleTabs, NEXT_STATUS, Note, send, StatusBadge, titleOf, useAction, type Entity, type Loc } from './ui'

/** Texts managed without a release: interface strings, Daily Inspiration and the “!” help texts. */
export function Texts() {
  const [tab, setTab] = useState<'inspiration' | 'ui' | 'help'>('inspiration')
  return (
    <div className="stack">
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'inspiration'} onClick={() => setTab('inspiration')}>Илҳоми рӯз</button>
        <button type="button" role="tab" aria-selected={tab === 'ui'} onClick={() => setTab('ui')}>Матнҳои интерфейс</button>
        <button type="button" role="tab" aria-selected={tab === 'help'} onClick={() => setTab('help')}>Кӯмак «!»</button>
      </div>
      {tab === 'inspiration' ? <Inspirations /> : tab === 'ui' ? <UiStrings /> : <HelpTexts />}
    </div>
  )
}

function Inspirations() {
  const list = useApi<{ items: Entity[] }>('/admin/inspirations?limit=100')
  const [body, setBody] = useState('')
  const [author, setAuthor] = useState('')
  const [source, setSource] = useState('')
  const act = useAction()
  const create = async () => {
    const tr = { body, author_name: author || null, source_title: source || null, ready: true }
    if (await act.run(() => send('/admin/inspirations', 'POST', { placement: 'home', translations: { tg: tr } }), 'Илова шуд')) {
      setBody(''); setAuthor(''); setSource('')
      list.reload()
    }
  }
  const go = async (id: string, to: string) => {
    if (await act.run(() => send(`/admin/inspirations/${id}/transition`, 'POST', { to }), 'Ҳолат иваз шуд')) list.reload()
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
      {(list.data?.items ?? []).map((e) => (
        <div key={e.id} className="card card-pad stack" style={{ gap: 8 }}>
          <div className="row"><span className="serif" style={{ flex: 1, fontStyle: 'italic' }}>“{titleOf(e, 'body')}”</span><StatusBadge status={e.status} /></div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {(NEXT_STATUS[e.status ?? 'draft'] ?? []).map((n) => (
              <button key={n.to} type="button" className="chip" onClick={() => go(e.id, n.to)} disabled={act.busy}>{n.label}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="card card-pad stack" style={{ gap: 10 }}>
        <div className="eyebrow">Илҳоми нав</div>
        <textarea className="input" placeholder="Матн (ояти, ҳадис, ҳикмат, иқтибос…)" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="row" style={{ gap: 8 }}>
          <input className="input" placeholder="Муаллиф" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <input className="input" placeholder="Манбаъ (ҳатмӣ агар муаллиф бошад)" value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
        <button type="button" className="btn" onClick={create} disabled={act.busy || !body.trim() || (!!author.trim() && !source.trim())}>Илова</button>
        <Note message={act.message} />
      </div>
    </div>
  )
}

function UiStrings() {
  const rows = useApi<{ key: string; locale: Loc; value: string }[]>('/admin/ui-strings')
  const [loc, setLoc] = useState<Loc>('tg')
  const [filter, setFilter] = useState('')
  if (rows.error) return <ErrorState error={rows.error} onRetry={rows.reload} />
  if (!rows.data) return <Loading />
  const keys = Object.keys(DEFAULT_STRINGS.tg).filter((k) => !filter || k.includes(filter) || (DEFAULT_STRINGS.tg[k as keyof typeof DEFAULT_STRINGS.tg] ?? '').toLowerCase().includes(filter.toLowerCase()))
  const value = (k: string) => rows.data!.find((r) => r.key === k && r.locale === loc)?.value
  return (
    <div className="stack" style={{ gap: 10 }}>
      <LocaleTabs value={loc} onChange={setLoc} />
      <input className="input" type="search" placeholder="Ҷустуҷӯ" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {keys.map((k) => (
        <UiStringRow key={`${loc}-${k}`} k={k} loc={loc} current={value(k)}
          fallback={(DEFAULT_STRINGS[loc] as Record<string, string>)[k] ?? (DEFAULT_STRINGS.tg as Record<string, string>)[k] ?? ''} onSaved={rows.reload} />
      ))}
    </div>
  )
}

function UiStringRow({ k, loc, current, fallback, onSaved }: { k: string; loc: Loc; current?: string; fallback: string; onSaved: () => void }) {
  const [v, setV] = useState(current ?? fallback)
  const act = useAction()
  const dirty = v !== (current ?? fallback)
  const save = async () => {
    if (await act.run(() => send(`/admin/ui-strings/${encodeURIComponent(k)}/${loc}`, 'PUT', { value: v }))) onSaved()
  }
  return (
    <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
      <Field label={k}><input className="input" dir={loc === 'ar' ? 'rtl' : 'ltr'} value={v} maxLength={300} onChange={(e) => setV(e.target.value)} /></Field>
      <button type="button" className="btn btn-soft" onClick={save} disabled={act.busy || !dirty || !v.trim()} style={{ minWidth: 90 }}>{act.message?.ok ? '✓' : 'Захира'}</button>
    </div>
  )
}

function HelpTexts() {
  const rows = useApi<{ key: string; enabled: boolean; icon: string; translations: { locale: Loc; title: string | null; body: string; ready: boolean }[] }[]>('/admin/help-texts')
  const [loc, setLoc] = useState<Loc>('tg')
  const [newKey, setNewKey] = useState('')
  if (rows.error) return <ErrorState error={rows.error} onRetry={rows.reload} />
  if (!rows.data) return <Loading />
  return (
    <div className="stack" style={{ gap: 10 }}>
      <LocaleTabs value={loc} onChange={setLoc} />
      {rows.data.map((h) => <HelpRow key={`${loc}-${h.key}`} k={h.key} loc={loc} enabled={h.enabled} icon={h.icon} tr={h.translations.find((t) => t.locale === loc)} onSaved={rows.reload} />)}
      <div className="row" style={{ gap: 8 }}>
        <input className="input" placeholder="калиди нав, масалан lesson.audio" value={newKey} onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))} />
      </div>
      {newKey ? <HelpRow k={newKey} loc={loc} enabled icon="info" onSaved={() => { setNewKey(''); rows.reload() }} /> : null}
    </div>
  )
}

function HelpRow({ k, loc, enabled, icon, tr, onSaved }: { k: string; loc: Loc; enabled: boolean; icon: string; tr?: { title: string | null; body: string; ready: boolean }; onSaved: () => void }) {
  const [title, setTitle] = useState(tr?.title ?? '')
  const [body, setBody] = useState(tr?.body ?? '')
  const [on, setOn] = useState(enabled)
  const act = useAction()
  const save = async () => {
    if (await act.run(() => send(`/admin/help-texts/${encodeURIComponent(k)}`, 'PUT', { enabled: on, icon, translations: { [loc]: { title: title || null, body, ready: true } } }))) onSaved()
  }
  return (
    <div className="card card-pad stack" style={{ gap: 8 }} dir={loc === 'ar' ? 'rtl' : 'ltr'}>
      <div className="row"><b style={{ flex: 1, fontWeight: 500 }}>{k}</b>
        <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> фаъол</label></div>
      <input className="input" placeholder="Сарлавҳа" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input" placeholder="Шарҳ (то 600 аломат)" maxLength={600} value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 70 }} />
      <button type="button" className="btn btn-soft" onClick={save} disabled={act.busy || !body.trim()}>Захира</button>
      <Note message={act.message} />
    </div>
  )
}

'use client'

import { useState } from 'react'

import { ErrorState, Loading } from '../components/States'
import { DEFAULT_STRINGS } from '../i18n'
import { useApi } from '../useApi'
import { Field, LocaleTabs, NEXT_STATUS, Note, send, StatusBadge, titleOf, useAction, type Entity, type Loc } from './ui'

/** Texts managed without a release: interface strings, Daily Inspiration and the “!” help texts. */
export function Texts() {
  const [tab, setTab] = useState<'inspiration' | 'poem' | 'ui' | 'help' | 'welcome' | 'warnings'>('inspiration')
  return (
    <div className="stack">
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'inspiration'} onClick={() => setTab('inspiration')}>Илҳоми рӯз</button>
        <button type="button" role="tab" aria-selected={tab === 'poem'} onClick={() => setTab('poem')}>Гулбоғи эҷод</button>
        <button type="button" role="tab" aria-selected={tab === 'ui'} onClick={() => setTab('ui')}>Матнҳои интерфейс</button>
        <button type="button" role="tab" aria-selected={tab === 'help'} onClick={() => setTab('help')}>Кӯмак «!»</button>
        <button type="button" role="tab" aria-selected={tab === 'welcome'} onClick={() => setTab('welcome')}>Саволнома</button>
        <button type="button" role="tab" aria-selected={tab === 'warnings'} onClick={() => setTab('warnings')}>Ҷавобҳои сурх</button>
      </div>
      {tab === 'inspiration' ? <Inspirations key="i" /> : tab === 'poem' ? <Inspirations key="p" verse /> : tab === 'ui' ? <UiStrings /> : tab === 'help' ? <HelpTexts /> : tab === 'welcome' ? <Welcome /> : <Warnings />}
    </div>
  )
}

const VERSE = ['poem', 'story']

/**
 * Inspirations for the home screen, or (verse) the works of "Гулбоғи эҷод": a poem keeps its lines, one
 * per row; a story's text flows on line after line.
 */
function Inspirations({ verse = false }: { verse?: boolean }) {
  const all = useApi<{ items: Entity[] }>('/admin/inspirations?limit=200')
  const [kind, setKind] = useState<'poem' | 'story'>('poem')
  const placement = verse ? kind : 'home'
  const poem = verse && kind === 'poem'
  const story = verse && kind === 'story'
  const placeOf = (e: Entity) => (e as { placement?: string }).placement ?? 'home'
  const list = { ...all, data: all.data ? { items: all.data.items.filter((e) => VERSE.includes(placeOf(e)) === verse) } : all.data }
  const [body, setBody] = useState('')
  const [author, setAuthor] = useState('')
  const [source, setSource] = useState('')
  const act = useAction()
  const create = async () => {
    const tr = { body, author_name: author || null, source_title: source || null, ready: true }
    if (await act.run(() => send('/admin/inspirations', 'POST', { placement, translations: { tg: tr } }), 'Илова шуд')) {
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
          <div className="row">
            {verse ? <span className="chip" style={{ minHeight: 24 }}>{placeOf(e) === 'story' ? 'Ҳикоя' : 'Шеър'}</span> : null}
            <span className="serif" style={{ flex: 1, fontStyle: 'italic', whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {verse && titleOf(e, 'source_title') ? <b>{titleOf(e, 'source_title')}{'\n'}</b> : null}“{titleOf(e, 'body')}”
            </span>
            <StatusBadge status={e.status} />
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {(NEXT_STATUS[e.status ?? 'draft'] ?? []).map((n) => (
              <button key={n.to} type="button" className="chip" onClick={() => go(e.id, n.to)} disabled={act.busy}>{n.label}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="card card-pad stack" style={{ gap: 10 }}>
        <div className="eyebrow">{verse ? 'Асари нав' : 'Илҳоми нав'}</div>
        {verse ? (
          <div className="segmented" role="radiogroup" aria-label="Навъ">
            <button type="button" role="radio" aria-checked={poem} aria-pressed={poem} onClick={() => setKind('poem')}>Шеър</button>
            <button type="button" role="radio" aria-checked={story} aria-pressed={story} onClick={() => setKind('story')}>Ҳикоя</button>
          </div>
        ) : null}
        <textarea className="input" rows={verse ? 8 : 3} maxLength={verse ? 20000 : 1000}
          placeholder={poem ? 'Мисраъҳо — ҳар мисраъ дар сатри алоҳида' : story ? 'Матни ҳикоя — сатрҳо пай дар пай идома меёбанд (сархати нав: як сатри холӣ)' : 'Матн (ояти, ҳадис, ҳикмат, иқтибос…)'}
          value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="row" style={{ gap: 8 }}>
          <input className="input" placeholder={poem ? 'Шоир' : story ? 'Нависанда' : 'Муаллиф'} value={author} onChange={(e) => setAuthor(e.target.value)} />
          <input className="input" placeholder={poem ? 'Номи шеър (ҳатмӣ агар шоир бошад)' : story ? 'Номи ҳикоя (ҳатмӣ агар нависанда бошад)' : 'Манбаъ (ҳатмӣ агар муаллиф бошад)'} value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
        <button type="button" className="btn" onClick={create} disabled={act.busy || !body.trim() || (!!author.trim() && !source.trim())}>Илова</button>
        <Note message={act.message} />
      </div>
    </div>
  )
}

/** Welcome questions and notifications: their texts (filtered list below) and how learners answered. */
function Welcome() {
  const stats = useApi<{ answered: number; profiles: number; time: Record<string, number>; source: Record<string, number>; schools: Record<string, number> }>('/admin/welcome-stats')
  const block = (title: string, data?: Record<string, number>) => {
    const rows = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1])
    const max = Math.max(1, ...rows.map((r) => r[1]))
    return (
      <div className="card card-pad stack" style={{ gap: 8 }}>
        <div className="eyebrow">{title}</div>
        {rows.length ? rows.map(([k, n]) => (
          <div key={k} className="stack" style={{ gap: 4 }}>
            <div className="row" style={{ fontSize: '0.9em' }}><span style={{ flex: 1 }}>{k}</span><b>{n}</b></div>
            <div className="progress"><span style={{ width: `${(n * 100) / max}%` }} /></div>
          </div>
        )) : <span className="muted">—</span>}
      </div>
    )
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      {stats.error ? <ErrorState error={stats.error} onRetry={stats.reload} /> : null}
      {stats.data ? (
        <>
          <p className="muted" style={{ margin: 0 }}>Ҷавоб доданд: <b>{stats.data.answered}</b> аз {stats.data.profiles}</p>
          {block('Вақт дар як рӯз', stats.data.time)}
          {block('Мактабҳо', stats.data.schools)}
          {block('Аз куҷо пайдо карданд', stats.data.source)}
        </>
      ) : <Loading rows={2} />}
      <p className="muted" style={{ margin: 0, fontSize: '0.86em' }}>
        Саволҳо, ҷавобҳо ва огоҳиҳо: ҳар сатр — як вариант. Дар огоҳиҳо {'{name}'}, {'{lesson}'} ва {'{streak}'} худ ба худ пур мешаванд.
      </p>
      <UiStrings only={/^(welcome|notify)\./} />
    </div>
  )
}

function UiStrings({ only }: { only?: RegExp } = {}) {
  const rows = useApi<{ key: string; locale: Loc; value: string }[]>('/admin/ui-strings')
  const [loc, setLoc] = useState<Loc>('tg')
  const [filter, setFilter] = useState('')
  if (rows.error) return <ErrorState error={rows.error} onRetry={rows.reload} />
  if (!rows.data) return <Loading />
  const builtIn = (k: string) => (DEFAULT_STRINGS[loc] as Record<string, string>)[k] ?? (DEFAULT_STRINGS.tg as Record<string, string>)[k] ?? ''
  const value = (k: string) => rows.data!.find((r) => r.key === k && r.locale === loc)?.value
  const needle = filter.toLowerCase()
  // every text of the interface, grouped by screen (the part of the key before the dot)
  const keys = Object.keys(DEFAULT_STRINGS.tg).filter((k) => !only || only.test(k))
    .filter((k) => !needle || k.includes(needle) || builtIn(k).toLowerCase().includes(needle) || (value(k) ?? '').toLowerCase().includes(needle))
  const groups = new Map<string, string[]>()
  for (const k of keys) groups.set(k.split('.')[0], [...(groups.get(k.split('.')[0]) ?? []), k])
  const changed = rows.data.filter((r) => r.locale === loc).length
  return (
    <div className="stack" style={{ gap: 10 }}>
      <LocaleTabs value={loc} onChange={setLoc} />
      <input className="input" type="search" placeholder="Ҷустуҷӯ (калид ё матн)" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <span className="muted" style={{ fontSize: '0.85em' }}>Матнҳо: {keys.length} · ивазшуда: {changed}. Тағйирот дар барнома дар чанд сония пайдо мешавад.</span>
      {[...groups].map(([g, ks]) => (
        <details key={`${loc}-${g}`} className="card card-pad" open={!!needle || groups.size <= 3}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{g} <span className="muted">({ks.length})</span></summary>
          <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            {ks.map((k) => (
              <UiStringRow key={`${loc}-${k}-${value(k) ?? ''}`} k={k} loc={loc} current={value(k)} fallback={builtIn(k)} onSaved={rows.reload} />
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}

function UiStringRow({ k, loc, current, fallback, onSaved }: { k: string; loc: Loc; current?: string; fallback: string; onSaved: () => void }) {
  const [v, setV] = useState(current ?? fallback)
  const act = useAction()
  const dirty = v !== (current ?? fallback)
  const save = async () => {
    const clean = v.replace(/\r/g, '').trim()
    if (!clean) return
    if (await act.run(() => send(`/admin/ui-strings/${encodeURIComponent(k)}/${loc}`, 'PUT', { value: clean }), 'Захира шуд')) onSaved()
  }
  const restore = async () => {
    if (await act.run(() => send(`/admin/ui-strings/${encodeURIComponent(k)}/${loc}`, 'DELETE'), 'Ба аслӣ баргашт')) onSaved()
  }
  return (
    <>
    <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
      <Field label={k}>
        {fallback.includes('\n') || v.includes('\n') ? (
          <textarea className="input" value={v} maxLength={2000} rows={Math.min(8, v.split('\n').length + 1)}
            onChange={(e) => setV(e.target.value)} style={{ minHeight: 0 }} />
        ) : (
          <input className="input" value={v} maxLength={2000} onChange={(e) => setV(e.target.value)} />
        )}
      </Field>
      <div className="stack" style={{ gap: 4 }}>
        <button type="button" className="btn btn-soft" onClick={save} disabled={act.busy || !dirty || !v.trim()} style={{ minWidth: 90 }}>{act.message?.ok ? '✓' : 'Захира'}</button>
        {current !== undefined ? <button type="button" className="link-btn" onClick={restore} disabled={act.busy} title={fallback}>Аслӣ</button> : null}
      </div>
    </div>
    {act.message && !act.message.ok ? <Note message={act.message} /> : null}
    </>
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
    <div className="card card-pad stack" style={{ gap: 8 }}>
      <div className="row"><b style={{ flex: 1, fontWeight: 500 }}>{k}</b>
        <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> фаъол</label></div>
      <input className="input" placeholder="Сарлавҳа" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input" placeholder="Шарҳ (то 600 аломат)" maxLength={600} value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 70 }} />
      <button type="button" className="btn btn-soft" onClick={save} disabled={act.busy || !body.trim()}>Захира</button>
      <Note message={act.message} />
    </div>
  )
}

interface RedReply { word: string; reply: string }

/**
 * Mahliyo's red replies: as many as the staff like, each a word that may be in the learner's message and
 * her exact answer to it, in red ("Аблаҳ" → "Маро аблаҳ нагӯ …"). A reply without a word is a general
 * warning, chosen at random for other insults. No account is closed for it.
 */
function Warnings() {
  const list = useApi<{ items: RedReply[] }>('/admin/ai/warnings')
  const [items, setItems] = useState<RedReply[] | null>(null)
  const act = useAction()
  const shown = items ?? list.data?.items ?? []
  const change = (i: number, part: Partial<RedReply>) => setItems(shown.map((r, k) => (k === i ? { ...r, ...part } : r)))
  const save = async () => {
    const clean = shown.map((r) => ({ word: r.word.trim(), reply: r.reply.trim() })).filter((r) => r.reply)
    if (await act.run(() => send('/admin/ai/warnings', 'POST', { items: clean }), 'Сабт шуд')) { setItems(null); list.reload() }
  }
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />
  if (!list.data) return <Loading />
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="muted" style={{ margin: 0 }}>
        Агар дар паёми корбар калима бошад (ё шакли дигари он: «аблаҳ» дар «Ту аблаҳи бесаводӣ!»), Маҳлиё айнан ҷавоби ҳамон калимаро бо ранги сурх медиҳад.
        Ҷавоби бе калима — огоҳии умумӣ: барои ҳақорату фишори дигар яке аз онҳо тасодуфӣ меояд.
        <b> {'{ном}'}</b> — номи корбар: «Ман аблаҳ нестам, {'{ном}'}» → «Ман аблаҳ нестам, Малика»; <b>{'{ном}'}-и</b> → «Маликаи».
      </p>
      {shown.map((r, i) => (
        <div key={i} className="red-reply">
          <input className="input" value={r.word} maxLength={100} placeholder="Калима дар паёми корбар" aria-label={`Калимаи ${i + 1}`}
            onChange={(e) => change(i, { word: e.target.value })} />
          <textarea className="input" rows={2} value={r.reply} maxLength={400} placeholder="Ҷавоби сурхи Маҳлиё" aria-label={`Ҷавоби ${i + 1}`}
            onChange={(e) => change(i, { reply: e.target.value })} />
          <button type="button" className="btn btn-soft" aria-label={`Нест кардани ${i + 1}`} onClick={() => setItems(shown.filter((_, k) => k !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-soft" onClick={() => setItems([...shown, { word: '', reply: '' }])}>+ Ҷавоби сурх</button>
      <button type="button" className="btn" onClick={save} disabled={act.busy}>Сабт кардан</button>
      <Note message={act.message} />
    </div>
  )
}

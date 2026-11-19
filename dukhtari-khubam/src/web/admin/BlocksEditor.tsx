'use client'

import { useEffect, useState } from 'react'

import { ErrorState, Loading } from '../components/States'
import { youtubeId } from '../components/YouTube'
import { useApi } from '../useApi'
import { MediaPicker } from './Media'
import { Field, fromRich, LocaleTabs, Note, send, toRich, useAction, type Loc } from './ui'

/**
 * Full Text Editor for a lesson: an ordered list of schema-v1 blocks. Layout props are shared by every
 * language; the text of each block is written per language. Saving sends the whole list with the
 * version it was loaded at, so two editors cannot overwrite each other silently.
 */

interface Block { id?: string; type: string; props: Record<string, unknown>; content: Partial<Record<Loc, unknown>> }

const TYPES: { type: string; label: string }[] = [
  { type: 'heading', label: 'Сарлавҳа' }, { type: 'lead', label: 'Муқаддима' }, { type: 'paragraph', label: 'Параграф' },
  { type: 'bullet_list', label: 'Рӯйхат' }, { type: 'ordered_list', label: 'Рӯйхати рақамдор' }, { type: 'quote', label: 'Иқтибос' },
  { type: 'callout', label: 'Огоҳӣ / Маслиҳат' }, { type: 'practical_task', label: 'Супориши амалӣ' }, { type: 'source', label: 'Манбаъ' },
  { type: 'image', label: 'Сурат' }, { type: 'youtube', label: 'Видеои YouTube (пайванд)' }, { type: 'video', label: 'Видео (файл)' },
  { type: 'audio', label: 'Аудио' }, { type: 'divider', label: 'Ҷудокунанда' }
]
const LABEL = Object.fromEntries(TYPES.map((t) => [t.type, t.label]))
const RICH = new Set(['heading', 'subheading', 'paragraph', 'lead', 'caption', 'footnote'])
const LIST = new Set(['bullet_list', 'ordered_list'])
const MEDIA = new Set(['image', 'video', 'audio', 'illustration', 'full_width_media', 'file'])

function blank(type: string): Block {
  const props: Record<string, unknown> =
    type === 'heading' ? { level: 2 } : type === 'callout' ? { variant: 'note' } : type === 'quote' ? { style: 'elegant' } : {}
  return { type, props, content: {} }
}

export function BlocksEditor({ lessonId }: { lessonId: string }) {
  const doc = useApi<{ version: number; blocks: Block[]; has_unpublished_changes: boolean }>(`/admin/lessons/${lessonId}/blocks`)
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const [version, setVersion] = useState<number | null>(null)
  const [loc, setLoc] = useState<Loc>('tg')
  const [adding, setAdding] = useState('paragraph')
  const act = useAction()

  useEffect(() => {
    if (doc.data && blocks === null) {
      setBlocks(doc.data.blocks)
      setVersion(doc.data.version)
    }
  }, [doc.data, blocks])

  if (doc.error) return <ErrorState error={doc.error} onRetry={doc.reload} />
  if (!blocks) return <Loading />

  const update = (i: number, b: Block) => setBlocks(blocks.map((x, j) => (j === i ? b : x)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    setBlocks(next)
  }
  const save = async () => {
    const r = await act.run(() => send<{ version: number }>(`/admin/lessons/${lessonId}/blocks`, 'PUT', {
      expected_version: version,
      blocks: blocks.map((b) => ({ ...(b.id ? { id: b.id } : {}), type: b.type, schema_version: 1, props: b.props, content: b.content }))
    }))
    if (r && typeof r.version === 'number') setVersion(r.version)
  }

  return (
    <div className="stack">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <LocaleTabs value={loc} onChange={setLoc} />
        <span className="muted" style={{ fontSize: '0.85em' }}>**ғафс**, *курсив*</span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.82em' }}>
        Барои синну сол: дар аввали матни блок ё номи мавзӯъ/дарс нависед <code>&lt;синну сол&gt;16&lt;/синну сол&gt;</code> —
        он танҳо ба 16-солаҳо ва хурдтар нишон дода мешавад.
      </p>
      {blocks.map((b, i) => (
        <div key={b.id ?? `new-${i}`} className="card card-pad stack" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 6 }}>
            <b style={{ flex: 1, fontWeight: 500 }}>{i + 1}. {LABEL[b.type] ?? b.type}</b>
            <button type="button" className="icon-btn" aria-label="Боло" onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="icon-btn" aria-label="Поён" onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="icon-btn" aria-label="Нусха" onClick={() => setBlocks([...blocks.slice(0, i + 1), { ...b, id: undefined }, ...blocks.slice(i + 1)])}>⧉</button>
            <button type="button" className="icon-btn" aria-label="Нест кардан" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>×</button>
          </div>
          <BlockFields block={b} loc={loc} onChange={(nb) => update(i, nb)} />
        </div>
      ))}
      <div className="row" style={{ gap: 8 }}>
        <select className="input" value={adding} onChange={(e) => setAdding(e.target.value)} style={{ flex: 1 }}>
          {TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
        <button type="button" className="btn btn-soft" onClick={() => setBlocks([...blocks, blank(adding)])}>Блоки нав</button>
      </div>
      <button type="button" className="btn" onClick={save} disabled={act.busy}>Захираи дарс</button>
      <Note message={act.message} />
    </div>
  )
}

function BlockFields({ block, loc, onChange }: { block: Block; loc: Loc; onChange: (b: Block) => void }) {
  const c = (block.content[loc] ?? {}) as Record<string, unknown>
  const setContent = (v: unknown) => onChange({ ...block, content: { ...block.content, [loc]: v } })
  const setProps = (p: Record<string, unknown>) => onChange({ ...block, props: { ...block.props, ...p } })
  const dir = 'ltr'

  if (block.type === 'divider') return <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
  if (RICH.has(block.type)) {
    return (
      <>
        {block.type === 'heading' ? (
          <div className="segmented">{[2, 3].map((lv) => (
            <button key={lv} type="button" aria-pressed={block.props.level === lv} onClick={() => setProps({ level: lv })}>H{lv}</button>
          ))}</div>
        ) : null}
        <textarea className="input" dir={dir} style={{ minHeight: block.type === 'heading' ? 56 : 110 }}
          value={fromRich(block.content[loc])} onChange={(e) => setContent(toRich(e.target.value))} />
      </>
    )
  }
  if (LIST.has(block.type)) {
    const items = ((c.items as unknown[]) ?? []).map(fromRich).join('\n')
    return (
      <Field label="Ҳар сатр — як банд">
        <textarea className="input" dir={dir} value={items}
          onChange={(e) => setContent({ items: e.target.value.split('\n').map(toRich) })} />
      </Field>
    )
  }
  if (block.type === 'quote') {
    return (
      <>
        <textarea className="input" dir={dir} value={fromRich(c.text)} onChange={(e) => setContent({ ...c, text: toRich(e.target.value) })} />
        <div className="row" style={{ gap: 8 }}>
          <input className="input" dir={dir} placeholder="Муаллиф" value={(c.author as string) ?? ''} onChange={(e) => setContent({ ...c, author: e.target.value || undefined })} />
          <input className="input" dir={dir} placeholder="Манбаъ" value={(c.source as string) ?? ''} onChange={(e) => setContent({ ...c, source: e.target.value || undefined })} />
        </div>
      </>
    )
  }
  if (block.type === 'callout' || block.type === 'practical_task') {
    return (
      <>
        {block.type === 'callout' ? (
          <select className="input" value={(block.props.variant as string) ?? 'note'} onChange={(e) => setProps({ variant: e.target.value })}>
            <option value="important">Муҳим</option><option value="warning">Огоҳӣ</option><option value="note">Қайд</option>
            <option value="tip">Маслиҳат</option><option value="info">Маълумот</option>
          </select>
        ) : null}
        <input className="input" dir={dir} placeholder="Сарлавҳа" value={(c.title as string) ?? ''} onChange={(e) => setContent({ ...c, title: e.target.value || undefined })} />
        <textarea className="input" dir={dir} value={fromRich(c.body)} onChange={(e) => setContent({ ...c, body: toRich(e.target.value) })} />
      </>
    )
  }
  if (block.type === 'source') {
    return (
      <>
        <input className="input" dir={dir} placeholder="Номи манбаъ" value={(c.title as string) ?? ''} onChange={(e) => setContent({ ...c, title: e.target.value })} />
        <div className="row" style={{ gap: 8 }}>
          <input className="input" dir={dir} placeholder="Муаллиф" value={(c.author as string) ?? ''} onChange={(e) => setContent({ ...c, author: e.target.value || undefined })} />
          <input className="input" placeholder="Сол" value={(c.year as string) ?? ''} onChange={(e) => setContent({ ...c, year: e.target.value || undefined })} />
        </div>
        <input className="input" placeholder="https://…" value={(block.props.url as string) ?? ''} onChange={(e) => setProps({ url: e.target.value || undefined })} />
      </>
    )
  }
  if (block.type === 'youtube') {
    // only the 11-character video id is stored; nothing is uploaded
    const id = block.props.video_id as string | undefined
    return (
      <>
        <input className="input" placeholder="https://youtu.be/… ё https://www.youtube.com/watch?v=…" defaultValue={id ? `https://youtu.be/${id}` : ''}
          onChange={(e) => setProps({ video_id: youtubeId(e.target.value) ?? undefined })} />
        {id ? <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" style={{ width: 200, borderRadius: 14 }} />
          : <p className="muted" style={{ margin: 0, fontSize: '0.85em' }}>Пайванди видеоро аз YouTube гузоред.</p>}
        <input className="input" dir={dir} placeholder="Ном" value={(c.title as string) ?? ''} onChange={(e) => setContent({ ...c, title: e.target.value || undefined })} />
        <input className="input" dir={dir} placeholder="Тавзеҳ (caption)" value={(c.caption as string) ?? ''} onChange={(e) => setContent({ ...c, caption: e.target.value || undefined })} />
      </>
    )
  }
  if (MEDIA.has(block.type)) {
    const kind = block.type === 'video' ? 'video' : block.type === 'audio' ? 'audio' : block.type === 'file' ? 'file' : 'image'
    return (
      <>
        <MediaPicker kind={kind} value={block.props.asset_id as string | undefined} onChange={(asset_id) => setProps({ asset_id })} />
        {block.type === 'video' || block.type === 'audio' ? (
          <input className="input" dir={dir} placeholder="Ном" value={(c.title as string) ?? ''} onChange={(e) => setContent({ ...c, title: e.target.value || undefined })} />
        ) : null}
        <input className="input" dir={dir} placeholder="Тавзеҳ (caption)" value={(c.caption as string) ?? ''} onChange={(e) => setContent({ ...c, caption: e.target.value || undefined })} />
      </>
    )
  }
  return <p className="muted" style={{ margin: 0 }}>Ин навъи блок дар ин ҷо таҳрир намешавад.</p>
}

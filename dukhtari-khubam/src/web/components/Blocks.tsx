'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'

import { api } from '../api'
import { usePrefs } from '../prefs'
import { Icon, type IconName } from './Icon'

/** Renderer for CMS content blocks (schema v1) — the same structure Android renders natively. */

export interface Asset {
  id: string
  kind: string
  bucket: string
  path: string
  url: string | null
  protected?: boolean
  mime_type: string
  width?: number | null
  height?: number | null
  alt?: string | null
  caption?: string | null
  title?: string | null
  transcript?: string | null
  hls_path?: string | null
  poster?: { url: string | null } | null
}

interface Span { text: string; marks?: string[]; color?: string; highlight?: string; href?: string }
interface Rich { spans: Span[]; align?: 'start' | 'center' | 'end' }

export interface Block {
  id: string
  type: string
  props: Record<string, any>
  content: Record<string, any>
  ref?: { id: string; title?: string; question_count?: number }
}

export function RichText({ value, as: Tag = 'p', className }: { value?: Rich | null; as?: 'p' | 'h2' | 'h3' | 'span' | 'div'; className?: string }) {
  if (!value?.spans?.length) return null
  return (
    <Tag className={className} style={value.align ? { textAlign: value.align } : undefined}>
      {value.spans.map((s, i) => {
        let node: ReactNode = s.text
        if (s.marks?.includes('bold')) node = <strong>{node}</strong>
        if (s.marks?.includes('italic')) node = <em>{node}</em>
        if (s.marks?.includes('underline')) node = <u>{node}</u>
        if (s.marks?.includes('strike')) node = <s>{node}</s>
        const cls = [s.color ? `t-${s.color}` : '', s.highlight ? `hl-${s.highlight}` : ''].filter(Boolean).join(' ')
        if (cls) node = <span className={cls}>{node}</span>
        if (s.href) {
          const external = /^https:|^mailto:/.test(s.href)
          node = external
            ? <a href={s.href} target="_blank" rel="noopener noreferrer">{node}</a>
            : <Link href={s.href}>{node}</Link>
        }
        return <span key={i}>{node}</span>
      })}
    </Tag>
  )
}

/** Public assets come from the CDN; premium files get a short-lived signed URL. */
function useAssetUrl(asset?: Asset | null): string | null {
  const [signed, setSigned] = useState<string | null>(null)
  useEffect(() => {
    if (!asset?.protected) return
    let alive = true
    api<{ url: string }>('/media/signed-url', { method: 'POST', body: { path: asset.path } })
      .then((r) => alive && setSigned(r.url))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [asset?.path, asset?.protected])
  return asset?.protected ? signed : asset?.url ?? null
}

function Picture({ asset, caption, full }: { asset?: Asset; caption?: string; full?: boolean }) {
  const url = useAssetUrl(asset)
  if (!asset) return null
  return (
    <figure style={full ? { marginInline: 'calc(50% - 50vw + 8px)' } : undefined}>
      {url ? (
        <img src={url} alt={asset.alt ?? ''} loading="lazy" decoding="async" width={asset.width ?? undefined}
          height={asset.height ?? undefined} style={{ height: 'auto' }} />
      ) : <div className="skeleton" style={{ aspectRatio: '16 / 10' }} />}
      {caption || asset.caption ? <figcaption>{caption ?? asset.caption}</figcaption> : null}
    </figure>
  )
}

function Video({ asset, poster, title, caption }: { asset?: Asset; poster?: Asset; title?: string; caption?: string }) {
  const url = useAssetUrl(asset)
  const posterUrl = useAssetUrl(poster) ?? asset?.poster?.url ?? undefined
  if (!asset) return null
  return (
    <figure>
      {title ? <b style={{ display: 'block', marginBottom: 8 }}>{title}</b> : null}
      {url ? (
        <video controls preload="metadata" playsInline poster={posterUrl} style={{ width: '100%', borderRadius: 20, background: '#000' }}>
          <source src={url} type={asset.mime_type} />
        </video>
      ) : <div className="skeleton" style={{ aspectRatio: '16 / 9' }} />}
      {caption ? <figcaption>{caption}</figcaption> : null}
      {asset.transcript ? <details style={{ marginTop: 8 }}><summary>Транскрипт</summary><p>{asset.transcript}</p></details> : null}
    </figure>
  )
}

function Audio({ asset, title, speaker }: { asset?: Asset; title?: string; speaker?: string }) {
  const url = useAssetUrl(asset)
  if (!asset) return null
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row"><Icon name="play" /><b>{title ?? asset.title ?? ''}</b>{speaker ? <span className="muted">· {speaker}</span> : null}</div>
      {url ? <audio controls preload="metadata" src={url} style={{ width: '100%' }} /> : <div className="skeleton" style={{ height: 40 }} />}
      {asset.transcript ? <details><summary>Транскрипт</summary><p>{asset.transcript}</p></details> : null}
    </div>
  )
}

const CALLOUT_ICON: Record<string, IconName> = { important: 'star', warning: 'alert', note: 'book', tip: 'check', info: 'info' }

export function BlockView({ block, assets }: { block: Block; assets: Record<string, Asset> }) {
  const { t } = usePrefs()
  const p = block.props ?? {}
  const c = block.content ?? {}
  const a = (id?: string) => (id ? assets[id] : undefined)
  switch (block.type) {
    case 'heading':
      return <RichText value={c as Rich} as={p.level === 3 ? 'h3' : 'h2'} />
    case 'subheading':
      return <RichText value={c as Rich} as="h3" />
    case 'paragraph':
      return <RichText value={c as Rich} />
    case 'lead':
      return <RichText value={c as Rich} className="lead" />
    case 'caption':
      return <RichText value={c as Rich} className="muted" />
    case 'footnote':
      return <div className="muted" style={{ fontSize: '0.85em' }}>{p.marker ? <sup>{p.marker} </sup> : null}<RichText value={c as Rich} as="span" /></div>
    case 'rich_text':
      return <>{(c.paragraphs ?? []).map((r: Rich, i: number) => <RichText key={i} value={r} />)}</>
    case 'bullet_list':
      return <ul>{(c.items ?? []).map((r: Rich, i: number) => <li key={i}><RichText value={r} as="span" /></li>)}</ul>
    case 'ordered_list':
      return <ol start={p.start}>{(c.items ?? []).map((r: Rich, i: number) => <li key={i}><RichText value={r} as="span" /></li>)}</ol>
    case 'image':
    case 'illustration':
      return <Picture asset={a(p.asset_id)} caption={c.caption} />
    case 'full_width_media':
      return <Picture asset={a(p.asset_id)} caption={c.caption} full />
    case 'gallery':
      return (
        <div className="scroller" role="group" aria-label="Галерея">
          {(p.asset_ids ?? []).map((id: string) => <div key={id} style={{ width: 'min(80vw, 520px)' }}><Picture asset={a(id)} /></div>)}
        </div>
      )
    case 'side_by_side':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'center' }}>
          {p.media_side === 'end' ? <RichText value={c.text} /> : null}
          <Picture asset={a(p.asset_id)} caption={c.caption} />
          {p.media_side !== 'end' ? <RichText value={c.text} /> : null}
        </div>
      )
    case 'video':
      return <Video asset={a(p.asset_id)} poster={a(p.poster_asset_id)} title={c.title} caption={c.caption} />
    case 'audio':
      return <Audio asset={a(p.asset_id)} title={c.title} speaker={c.speaker} />
    case 'quote':
      return (
        <blockquote className="quote" style={{ margin: 0 }}>
          <span aria-hidden="true" style={{ fontSize: '2em', lineHeight: 0.5 }}>“</span>
          <RichText value={c.text} as="span" />
          {c.author || c.source ? <cite>{[c.author, c.source].filter(Boolean).join(' · ')}</cite> : null}
        </blockquote>
      )
    case 'callout':
      return (
        <aside className={`callout callout-${p.variant ?? 'note'}`}>
          <Icon name={CALLOUT_ICON[p.variant] ?? 'info'} size={22} />
          <div>{c.title ? <b>{c.title}</b> : null}<RichText value={c.body} as="div" /></div>
        </aside>
      )
    case 'table':
      return (
        <div style={{ overflowX: 'auto' }}>
          <table>
            {c.caption ? <caption className="muted">{c.caption}</caption> : null}
            <tbody>
              {(c.rows ?? []).map((row: Rich[], i: number) => (
                <tr key={i}>{row.map((cell, j) => (i === 0 && p.header_row !== false
                  ? <th key={j} scope="col"><RichText value={cell} as="span" /></th>
                  : <td key={j}><RichText value={cell} as="span" /></td>))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'source':
      return (
        <p className="muted" style={{ fontSize: '0.9em' }}>
          <b>{t('lesson.source')}: </b>
          {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{c.title}</a> : c.title}
          {[c.author, c.publisher, c.year, c.pages].filter(Boolean).length ? `, ${[c.author, c.publisher, c.year, c.pages].filter(Boolean).join(', ')}` : ''}
        </p>
      )
    case 'file': {
      const f = a(p.asset_id)
      return f?.url ? <a className="chip" href={f.url} download><Icon name="down" size={16} />{c.label ?? f.title ?? f.path.split('/').pop()}</a> : null
    }
    case 'practical_task':
      return <div className="card card-pad card-lilac"><b>{c.title}</b><RichText value={c.body} as="div" /></div>
    case 'quiz':
      return block.ref ? (
        <Link href={`/quizzes/${block.ref.id}`} className="card card-pad row" style={{ textDecoration: 'none' }}>
          <Icon name="check" /><div style={{ flex: 1 }}><b>{block.ref.title}</b><div className="muted">{block.ref.question_count} {t('quiz.question').toLowerCase()}</div></div><Icon name="forward" />
        </Link>
      ) : null
    case 'related_lesson':
      return block.ref ? <Link href={`/lessons/${block.ref.id}`} className="chip"><Icon name="book" size={16} />{block.ref.title}</Link> : null
    case 'model3d': {
      const m = a(p.asset_id)
      return m?.url ? <a className="chip" href={m.url} download><Icon name="sparkle" size={16} />3D · {m.title ?? 'GLB'}</a> : null
    }
    case 'divider':
      return <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
    default:
      return null
  }
}

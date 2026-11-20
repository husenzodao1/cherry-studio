'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { frameOf } from '@/lib/sources'

import { api } from '../api'
import { useOfflineSrc } from '../offline/media'
import type { UiKey } from '../i18n'
import { usePrefs } from '../prefs'
import { Icon, type IconName } from './Icon'
import { SourceChip } from './SourceChip'
import { YouTube } from './YouTube'

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

/**
 * A picture in its frame (16:9 or 1:1, filled edge to edge); a tap shows it whole. Where it comes from
 * sits on it as a small chip.
 */
function Picture({ asset, caption, full, source }: { asset?: Asset; caption?: string; full?: boolean; source?: { title?: string; url?: string } }) {
  const { t } = usePrefs()
  const url = useOfflineSrc(useAssetUrl(asset))
  const [natural, setNatural] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!asset) return null
  const known = asset.width && asset.height ? asset.width / asset.height : null
  const frame = frameOf(known ?? natural)
  return (
    <figure style={full ? { marginInline: 'calc(50% - 50vw + 8px)' } : undefined}>
      <div className="pic" style={{ aspectRatio: frame }} data-frame={frame === '1 / 1' ? 'square' : 'wide'}>
        {url ? (
          <button type="button" className="pic-open" aria-label={t('image.open')} onClick={() => setOpen(true)}>
            <img src={url} alt={asset.alt ?? ''} loading="lazy" decoding="async" className="fade"
              ref={(el) => { if (el?.complete && el.naturalWidth) el.classList.add('is-ready') }}
              onLoad={(e) => { e.currentTarget.classList.add('is-ready'); setNatural(e.currentTarget.naturalWidth / Math.max(1, e.currentTarget.naturalHeight)) }} />
          </button>
        ) : <div className="skeleton" style={{ height: '100%' }} />}
        {source?.title || source?.url ? <SourceChip title={source.title} url={source.url} className="on-media" /> : null}
      </div>
      {caption || asset.caption ? <figcaption>{caption ?? asset.caption}</figcaption> : null}
      {open && url ? createPortal(
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={asset.alt ?? t('image.open')} onClick={() => setOpen(false)}>
          <img src={url} alt={asset.alt ?? ''} />
          <button type="button" className="lightbox-x" aria-label={t('action.close')}><Icon name="x" size={20} /></button>
        </div>,
        document.body
      ) : null}
    </figure>
  )
}

function Video({ asset, poster, title, caption }: { asset?: Asset; poster?: Asset; title?: string; caption?: string }) {
  const url = useAssetUrl(asset)
  const posterUrl = useAssetUrl(poster) ?? asset?.poster?.url ?? undefined
  if (!asset) return null
  return (
    <figure className="media-block">
      <BlockLabel icon="play" text={title} kind="video" />
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

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Audio in a frosted glass player: round play button, time, seek bar. */
function Audio({ asset, title, speaker }: { asset?: Asset; title?: string; speaker?: string }) {
  const url = useOfflineSrc(useAssetUrl(asset))
  const el = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  if (!asset) return null
  const name = title ?? asset.title ?? ''
  return (
    <div className="media-block stack" style={{ gap: 8 }}>
      <BlockLabel icon="volume" text={[name, speaker].filter(Boolean).join(' · ')} kind="audio" />
      <div className="player">
        <button type="button" className="play-btn" style={{ width: 42, height: 42 }} disabled={!url} aria-label={name || 'audio'}
          onClick={() => (el.current?.paused ? el.current.play() : el.current?.pause())}>
          <Icon name={playing ? 'pause' : 'play'} size={18} fill="currentColor" />
        </button>
        <span className="time">{clock(time)} / {clock(duration)}</span>
        <input type="range" min={0} max={Math.max(duration, 1)} step={1} value={time} aria-label="seek"
          onChange={(e) => { if (el.current) el.current.currentTime = Number(e.target.value) }} />
        {url ? <audio ref={el} preload="metadata" src={url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)} /> : null}
      </div>
      {asset.transcript ? <details><summary>Транскрипт</summary><p>{asset.transcript}</p></details> : null}
    </div>
  )
}

const CALLOUT_ICON: Record<string, IconName> = { important: 'star', warning: 'alert', note: 'book', tip: 'check', info: 'info' }
const CALLOUTS = ['important', 'warning', 'note', 'tip', 'info']

/** A small line above a lesson block: its kind (Video, Audio, Note…) with an icon, then its title. */
function BlockLabel({ icon, kind, text }: { icon: IconName; kind: string; text?: string | null }) {
  const { t } = usePrefs()
  return (
    <span className={`block-label block-label-${kind}`}>
      <Icon name={icon} size={15} strokeWidth={2} />
      <span className="block-kind">{t(`block.${kind}` as UiKey)}</span>
      {text ? <span className="block-title">{text}</span> : null}
    </span>
  )
}

export function BlockView({ block, assets }: { block: Block; assets: Record<string, Asset> }) {
  const { t } = usePrefs()
  const p = block.props ?? {}
  const c = block.content ?? {}
  const a = (id?: string) => (id ? assets[id] : undefined)
  // where a picture, video or audio comes from (content.source: a name or a link; props.source_url)
  const src = c.source || p.source_url ? { title: c.source, url: p.source_url } : undefined
  const chip = src ? <SourceChip title={src.title} url={src.url} /> : null
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
      return <Picture asset={a(p.asset_id)} caption={c.caption} source={src} />
    case 'full_width_media':
      return <Picture asset={a(p.asset_id)} caption={c.caption} full source={src} />
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
          <Picture asset={a(p.asset_id)} caption={c.caption} source={src} />
          {p.media_side !== 'end' ? <RichText value={c.text} /> : null}
        </div>
      )
    case 'video':
      return <>{<Video asset={a(p.asset_id)} poster={a(p.poster_asset_id)} title={c.title} caption={c.caption} />}{chip}</>
    case 'audio':
      return <>{<Audio asset={a(p.asset_id)} title={c.title} speaker={c.speaker} />}{chip}</>
    case 'youtube':
      return typeof p.video_id === 'string' ? (
        <div className="media-block stack" style={{ gap: 8 }}>
          <BlockLabel icon="play" kind="video" />
          <YouTube id={p.video_id} start={p.start} title={c.title} />
          {c.caption ? <p className="muted" style={{ fontSize: '0.88em' }}>{c.caption}</p> : null}
          {chip}
        </div>
      ) : null
    case 'quote':
      return (
        <blockquote className="quote" style={{ margin: 0 }}>
          <span aria-hidden="true" style={{ fontSize: '2em', lineHeight: 0.5 }}>“</span>
          <RichText value={c.text} as="span" />
          {c.author || c.source ? (
            <cite className="quote-cite">
              {c.author ? <span>{c.author}</span> : null}
              {c.source ? <SourceChip title={c.source} /> : null}
            </cite>
          ) : null}
        </blockquote>
      )
    case 'callout':
      return (
        <aside className={`callout callout-${CALLOUTS.includes(p.variant) ? p.variant : 'note'}`}>
          <BlockLabel icon={CALLOUT_ICON[p.variant] ?? 'book'} kind={CALLOUTS.includes(p.variant) ? p.variant : 'note'} />
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
    case 'source': {
      // the source as a chip (its icon and name); author, publisher, year and pages quietly after it
      // a site's chip shows the site's name, so the source's own title follows it
      const more = [p.url && c.title !== p.url ? c.title : null, c.author, c.publisher, c.year, c.pages].filter(Boolean).join(', ')
      return (
        <p className="src-line" aria-label={t('source.label')}>
          <SourceChip title={c.title} url={p.url} />
          {more ? <span className="muted">{more}</span> : null}
        </p>
      )
    }
    case 'file': {
      const f = a(p.asset_id)
      return f?.url ? <a className="chip" href={f.url} download><Icon name="down" size={16} />{c.label ?? f.title ?? f.path.split('/').pop()}</a> : null
    }
    case 'practical_task':
      return (
        <div className="callout callout-task">
          <BlockLabel icon="check" kind="task" />
          <div>{c.title ? <b>{c.title}</b> : null}<RichText value={c.body} as="div" /></div>
        </div>
      )
    case 'quiz':
      return block.ref ? (
        <Link href={`/quiz?id=${block.ref.id}`} className="glass list-row">
          <span className="row-icon"><Icon name="check" /></span>
          <span className="row-main"><b>{block.ref.title}</b><span className="row-sub">{block.ref.question_count} {t('quiz.question').toLowerCase()}</span></span>
          <Icon name="forward" />
        </Link>
      ) : null
    case 'related_lesson':
      return block.ref ? <Link href={`/lesson?id=${block.ref.id}`} className="chip"><Icon name="book" size={16} />{block.ref.title}</Link> : null
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

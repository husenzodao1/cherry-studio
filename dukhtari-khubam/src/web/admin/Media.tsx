'use client'

import { useState } from 'react'

import { ErrorState, Loading } from '../components/States'
import { browserSupabase } from '../supabase-browser'
import { useApi } from '../useApi'
import { Field, Note, send, useAction } from './ui'

/**
 * Media library. Every file is registered with its origin, author and licence (spec §9); lessons with
 * unlicensed, AI-generated or alt-less images cannot be published.
 */

type Kind = 'image' | 'video' | 'audio' | 'file' | 'model3d'
interface Asset {
  id: string; kind: Kind; path: string; url: string | null; mime_type: string; license?: string | null; author_name?: string | null
  translations?: { locale: string; alt_text?: string | null; title?: string | null }[]
}

const ACCEPT: Record<Kind, string> = { image: 'image/*', video: 'video/*', audio: 'audio/*', file: '*/*', model3d: '.glb,.gltf,model/*' }

function imageSize(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith('image/')) return Promise.resolve({})
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(img.src) }
    img.onerror = () => resolve({})
    img.src = URL.createObjectURL(file)
  })
}

export function Upload({ kind, onUploaded }: { kind: Kind; onUploaded: (a: Asset) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState('')
  const [author, setAuthor] = useState('')
  const [license, setLicense] = useState('')
  const [source, setSource] = useState('')
  const [origin, setOrigin] = useState('photo')
  const act = useAction()
  const upload = async () => {
    if (!file) return
    const asset = await act.run(async () => {
      const slot = await send<{ bucket: 'media'; path: string; token: string }>('/admin/media/upload-url', 'POST', { bucket: 'media', kind, filename: file.name })
      const sb = browserSupabase()!
      const { error } = await sb.storage.from(slot.bucket).uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type })
      if (error) throw error
      return send<Asset>('/admin/media', 'POST', {
        kind, bucket: slot.bucket, path: slot.path, mime_type: file.type || 'application/octet-stream', size_bytes: file.size,
        ...(await imageSize(file)), origin, author_name: author || null, license: license || null, source_url: source || null,
        is_ai_generated: false, translations: { tg: { alt_text: alt || null, title: file.name } }
      })
    }, 'Бор шуд')
    if (asset) {
      setFile(null)
      onUploaded(asset)
    }
  }
  return (
    <div className="card card-pad stack" style={{ gap: 10 }}>
      <input type="file" accept={ACCEPT[kind]} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {kind === 'image' ? <Field label="Матни алтернативӣ (барои нобиноён)"><input className="input" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={500} /></Field> : null}
      <div className="row" style={{ gap: 8 }}>
        <select className="input" value={origin} onChange={(e) => setOrigin(e.target.value)}>
          <option value="photo">Акс</option><option value="stock">Сток</option><option value="illustration">Иллюстратсия</option>
          <option value="render3d">Рендери 3D</option><option value="model3d">Модели 3D</option><option value="document">Ҳуҷҷат</option><option value="other">Дигар</option>
        </select>
        <input className="input" placeholder="Муаллиф" value={author} onChange={(e) => setAuthor(e.target.value)} />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" placeholder="Иҷозатнома (масалан CC BY 4.0)" value={license} onChange={(e) => setLicense(e.target.value)} />
        <input className="input" placeholder="https://манбаъ" value={source} onChange={(e) => setSource(e.target.value)} />
      </div>
      <button type="button" className="btn" onClick={upload} disabled={act.busy || !file || (kind === 'image' && !alt.trim()) || !license.trim()}>Бор кардан</button>
      <Note message={act.message} />
    </div>
  )
}

function Thumb({ asset }: { asset: Asset }) {
  if (asset.kind === 'image' && asset.url) return <img src={asset.url} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 14 }} />
  return <div className="card" style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', fontSize: '0.8em', padding: 6, overflow: 'hidden' }}>{asset.kind}<br />{asset.path.split('/').pop()}</div>
}

/** Pick an asset of one kind for a block; upload a new one in place. */
export function MediaPicker({ kind, value, onChange }: { kind: Kind; value?: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = useApi<Asset>(value ? `/admin/media/${value}` : null)
  const list = useApi<{ items: Asset[] }>(open ? `/admin/media?kind=${kind}&limit=60` : null)
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 10 }}>
        <div style={{ width: 72 }}>{current.data ? <Thumb asset={current.data} /> : <div className="skeleton" style={{ width: 72, height: 72, borderRadius: 14 }} />}</div>
        <button type="button" className="btn btn-soft" onClick={() => setOpen(!open)}>{open ? 'Пӯшидан' : value ? 'Иваз кардан' : 'Интихоби файл'}</button>
      </div>
      {open ? (
        <>
          <Upload kind={kind} onUploaded={(a) => { onChange(a.id); setOpen(false) }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
            {(list.data?.items ?? []).map((a) => (
              <button key={a.id} type="button" onClick={() => { onChange(a.id); setOpen(false) }} style={{ border: a.id === value ? '2px solid var(--focus)' : '0', padding: 0, background: 'none', borderRadius: 16, cursor: 'pointer' }}>
                <Thumb asset={a} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function MediaLibrary() {
  const [kind, setKind] = useState<Kind>('image')
  const list = useApi<{ items: Asset[]; total: number }>(`/admin/media?kind=${kind}&limit=120`)
  return (
    <div className="stack">
      <div className="segmented" role="tablist">
        {(['image', 'video', 'audio', 'file'] as Kind[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
            {k === 'image' ? 'Сурат' : k === 'video' ? 'Видео' : k === 'audio' ? 'Аудио' : 'Файл'}
          </button>
        ))}
      </div>
      <Upload kind={kind} onUploaded={list.reload} />
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
      {list.loading && !list.data ? <Loading rows={2} /> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
        {(list.data?.items ?? []).map((a) => (
          <figure key={a.id} style={{ margin: 0 }}>
            <Thumb asset={a} />
            <figcaption className="muted" style={{ fontSize: '0.75em', marginTop: 4 }}>{a.license ?? 'бе иҷозатнома'}{a.author_name ? ` · ${a.author_name}` : ''}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

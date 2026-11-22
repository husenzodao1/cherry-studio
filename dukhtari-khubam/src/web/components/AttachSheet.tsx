'use client'

import { Capacitor } from '@capacitor/core'
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'

import type { AiMode } from '../offline/mahliyo'
import { usePrefs } from '../prefs'
import { Icon, type IconName } from './Icon'

/**
 * What the paperclip opens in Mahliyo's chat: a sheet from the bottom, like a messenger's. First the camera
 * (in the app itself), then the phone's newest photos ready to tap (several may be chosen); under them
 * a document, the whole gallery, and four ways of answering. Pulled up, the sheet grows and shows more
 * photos; pulled down, it closes. On the website the photos come from the browser's own picker.
 */

interface Photo { id: string; thumb: string }
const MODES: { id: AiMode; icon: IconName; key: 'ai.mode_precise' | 'ai.mode_science' | 'ai.mode_friendly' | 'ai.mode_girly' }[] = [
  { id: 'precise', icon: 'target', key: 'ai.mode_precise' },
  { id: 'science', icon: 'flask', key: 'ai.mode_science' },
  { id: 'friendly', icon: 'smile', key: 'ai.mode_friendly' },
  { id: 'girly', icon: 'heart', key: 'ai.mode_girly' }
]

/** the phone's newest photos (the app asks for the gallery first); none on the website or when refused */
async function recentPhotos(count: number): Promise<Photo[]> {
  if (!Capacitor.isNativePlatform()) return []
  try {
    const { Camera } = await import('@capacitor/camera')
    const allowed = await Camera.requestPermissions({ permissions: ['photos'] })
    if (allowed.photos === 'denied') return []
    const { Media } = await import('@capacitor-community/media')
    const { medias } = await Media.getMedias({ quantity: count, types: 'photos', thumbnailWidth: 256, thumbnailHeight: 256, thumbnailQuality: 70 })
    return medias.map((m) => ({ id: m.identifier, thumb: `data:image/jpeg;base64,${m.data}` }))
  } catch {
    return []
  }
}
/** a gallery photo as a file to send (on Android its identifier is its path) */
async function photoFile(p: Photo): Promise<File | null> {
  try {
    const res = await fetch(Capacitor.convertFileSrc(p.id))
    const blob = await res.blob()
    return new File([blob], p.id.split('/').pop() || 'photo.jpg', { type: blob.type || 'image/jpeg' })
  } catch {
    return null
  }
}

export function AttachSheet({ max, mode, onMode, onFiles, onClose }: {
  max: number
  mode: AiMode | null
  onMode: (m: AiMode | null) => void
  onFiles: (files: File[]) => void
  onClose: () => void
}) {
  const { t } = usePrefs()
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [tall, setTall] = useState(false)
  const [camera, setCamera] = useState(false)
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)
  const docs = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)

  useEffect(() => { void recentPhotos(tall ? 90 : 30).then(setPhotos) }, [tall])
  useEffect(() => {
    const back = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', back)
    return () => window.removeEventListener('keydown', back)
  }, [onClose])

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < max ? [...p, id] : p))
  const sendPicked = async () => {
    const files = (await Promise.all((photos ?? []).filter((p) => picked.includes(p.id)).map(photoFile))).filter((f): f is File => !!f)
    if (files.length) onFiles(files)
    onClose()
  }
  const fromInput = (list: FileList | null) => {
    const files = [...(list ?? [])].slice(0, max)
    if (files.length) onFiles(files)
    onClose()
  }
  // the handle: pulled up it grows, pulled down it closes
  const down = (e: RPointerEvent) => { start.current = e.clientY; (e.target as Element).setPointerCapture?.(e.pointerId) }
  const move = (e: RPointerEvent) => { if (start.current !== null) setDrag(e.clientY - start.current) }
  const up = () => {
    if (start.current === null) return
    if (drag < -60) setTall(true)
    else if (drag > 80) (tall ? setTall(false) : onClose())
    start.current = null
    setDrag(0)
  }

  if (camera) return <InAppCamera onShot={(f) => { onFiles([f]); onClose() }} onClose={() => setCamera(false)} onGallery={() => { setCamera(false); setTall(true) }} />
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="attach-veil" onClick={onClose}>
      <section className={`attach${tall ? ' is-tall' : ''}`} role="dialog" aria-modal="true" aria-label={t('ai.attach')}
        style={drag ? { transform: `translateY(${Math.max(drag, -80)}px)`, transition: 'none' } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="attach-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><span /></div>

        {picked.length ? (
          <button type="button" className="btn attach-send" onClick={() => void sendPicked()}><Icon name="up" size={18} />{t('ai.attach_send').replace('{n}', String(picked.length))}</button>
        ) : (
          <div className="attach-actions">
            <button type="button" onClick={() => docs.current?.click()}><span className="attach-ico tone-doc"><Icon name="file" size={22} /></span>{t('ai.document')}</button>
            <button type="button" onClick={() => gallery.current?.click()}><span className="attach-ico tone-gallery"><Icon name="image" size={22} /></span>{t('ai.gallery')}</button>
            {MODES.map((m) => (
              <button key={m.id} type="button" aria-pressed={mode === m.id} className={mode === m.id ? 'is-on' : ''} onClick={() => onMode(mode === m.id ? null : m.id)}>
                <span className={`attach-ico tone-${m.id}`}><Icon name={m.icon} size={22} /></span>{t(m.key)}
              </button>
            ))}
          </div>
        )}

        {/* below: the camera first, then the newest photos, all in the same square tiles */}
        <div className="attach-photos">
          <button type="button" className="attach-tile attach-cam" onClick={() => setCamera(true)} aria-label={t('ai.camera')}>
            <Icon name="camera" size={30} /><span>{t('ai.camera')}</span>
          </button>
          {(photos ?? []).map((p) => {
            const n = picked.indexOf(p.id)
            return (
              <button key={p.id} type="button" className={`attach-tile attach-photo${n >= 0 ? ' is-on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={n >= 0}>
                <img src={p.thumb} alt="" loading="lazy" />
                <i aria-hidden="true">{n >= 0 ? n + 1 : ''}</i>
              </button>
            )
          })}
          {photos && !photos.length ? (
            <button type="button" className="attach-tile attach-more" onClick={() => gallery.current?.click()}><Icon name="image" size={28} /><span>{t('ai.gallery')}</span></button>
          ) : null}
        </div>
        <input ref={docs} type="file" hidden multiple accept="application/pdf,text/plain" onChange={(e) => fromInput(e.target.files)} />
        <input ref={gallery} type="file" hidden multiple accept="image/*" onChange={(e) => fromInput(e.target.files)} />
      </section>
    </div>,
    document.body
  )
}

/**
 * The camera inside the app: the picture fills the screen; the flash (where the phone has a torch), the
 * front or back camera, close, the gallery, and the round button that takes the photo.
 */
function InAppCamera({ onShot, onClose, onGallery }: { onShot: (f: File) => void; onClose: () => void; onGallery: () => void }) {
  const { t } = usePrefs()
  const video = useRef<HTMLVideoElement>(null)
  const [front, setFront] = useState(false)
  const [torch, setTorch] = useState(false)
  const [canTorch, setCanTorch] = useState(false)
  const [failed, setFailed] = useState(false)
  const stream = useRef<MediaStream | null>(null)

  useEffect(() => {
    let live = true
    const open = async () => {
      stream.current?.getTracks().forEach((tr) => tr.stop())
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: front ? 'user' : 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
        if (!live) return s.getTracks().forEach((tr) => tr.stop())
        stream.current = s
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => undefined) }
        const caps = (s.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as { torch?: boolean }
        setCanTorch(!!caps.torch)
        setFailed(false)
      } catch {
        setFailed(true)
      }
    }
    void open()
    return () => { live = false; stream.current?.getTracks().forEach((tr) => tr.stop()) }
  }, [front])

  const flash = async () => {
    const track = stream.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] })
      setTorch(!torch)
    } catch { /* no torch */ }
  }
  const shoot = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const g = c.getContext('2d')!
    if (front) { g.translate(c.width, 0); g.scale(-1, 1) }
    g.drawImage(v, 0, 0)
    c.toBlob((b) => { if (b) onShot(new File([b], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })) }, 'image/jpeg', 0.9)
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="cam" role="dialog" aria-modal="true" aria-label={t('ai.camera')}>
      <video ref={video} className={front ? 'is-front' : ''} playsInline muted />
      {failed ? <p className="cam-fail">{t('ai.camera_denied')}</p> : null}
      <div className="cam-side">
        {canTorch ? <button type="button" aria-pressed={torch} aria-label={t('ai.flash')} onClick={() => void flash()}><Icon name={torch ? 'flash' : 'flashOff'} size={24} /></button> : null}
        <button type="button" aria-label={t('ai.flip')} onClick={() => setFront(!front)}><Icon name="refresh" size={24} /></button>
      </div>
      <div className="cam-bar">
        <button type="button" aria-label={t('ai.gallery')} onClick={onGallery}><Icon name="image" size={26} /></button>
        <button type="button" className="cam-shoot" aria-label={t('ai.shoot')} onClick={shoot} disabled={failed} />
        <button type="button" aria-label={t('action.close')} onClick={onClose}><Icon name="x" size={26} /></button>
      </div>
    </div>,
    document.body
  )
}

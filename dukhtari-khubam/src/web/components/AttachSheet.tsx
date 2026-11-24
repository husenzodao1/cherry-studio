'use client'

import { Capacitor, registerPlugin } from '@capacitor/core'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import type { AiMode } from '../offline/mahliyo'
import { AI_MODES } from '../aiModes'
import { usePrefs } from '../prefs'
import { Icon, type IconName } from './Icon'

/**
 * What the paperclip opens in Mahliyo's chat: a sheet from the bottom, like a messenger's. First the camera
 * (in the app itself), then the phone's newest photos ready to tap (several may be chosen); under them
 * a document, the whole gallery, and four ways of answering. Pulled up, the sheet grows and shows more
 * photos; pulled down, it closes. On the website the photos come from the browser's own picker.
 */

interface Photo { id: string; thumb: string; name?: string }

/** the app's own gallery reader (android RecentPhotosPlugin.java) */
interface NativePhotos {
  recent(o: { limit: number; thumb: number }): Promise<{ photos: { id: string; name: string; thumb: string }[]; denied?: boolean }>
  read(o: { id: string }): Promise<{ data: string; mime: string }>
}
const Photos = registerPlugin<NativePhotos>('RecentPhotos')

/** the phone's newest photos (the app asks for the gallery first); none on the website or when refused */
async function recentPhotos(count: number): Promise<Photo[]> {
  if (!Capacitor.isNativePlatform()) return []
  try {
    const { photos } = await Photos.recent({ limit: count, thumb: 256 })
    return photos.map((p) => ({ id: p.id, thumb: p.thumb, name: p.name }))
  } catch {
    return []
  }
}
/** a gallery photo as a file to send (a JPEG, at most 2048 px on its long side) */
async function photoFile(p: Photo): Promise<File | null> {
  try {
    const { data, mime } = await Photos.read({ id: p.id })
    const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0))
    return new File([bytes], (p.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: mime })
  } catch {
    return null
  }
}

/** the files she can ask Mahliyo to make: each opens its ready command ("/pdf") in the box */
const MAKE: { command: string; tone: string; key: 'ai.make_slides' | 'ai.make_pdf' | 'ai.make_word'; glyph: () => ReactNode }[] = [
  { command: 'презентатсия', tone: 'slides', key: 'ai.make_slides', glyph: SlidesGlyph },
  { command: 'pdf', tone: 'pdf', key: 'ai.make_pdf', glyph: PdfGlyph },
  { command: 'word', tone: 'word', key: 'ai.make_word', glyph: WordGlyph }
]

/** the photos picked and not sent yet (kept while the app is open) */
let keptPicks: string[] = []

export function AttachSheet({ max, mode, onMode, onCommand, onFiles, onClose, onStudy }: {
  max: number
  mode: AiMode | null
  onMode: (m: AiMode | null) => void
  /** the student Workspace's chat */
  onStudy?: () => void
  /** a file to make was chosen: its ready command */
  onCommand: (title: string) => void
  onFiles: (files: File[]) => void
  onClose: () => void
}) {
  const { t } = usePrefs()
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  // what she picked and has not sent yet stays picked, even when the sheet is closed and opened again
  const [picked, setPickedNow] = useState<string[]>(() => keptPicks)
  const setPicked = (next: string[] | ((was: string[]) => string[])) => setPickedNow((was) => {
    const v = typeof next === 'function' ? next(was) : next
    keptPicks = v
    return v
  })
  const [tall, setTall] = useState(false)
  const [camera, setCamera] = useState(false)
  const sheet = useRef<HTMLElement>(null)
  const docs = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)

  // once the sheet was tall, the longer list stays (her picks among them stay in sight)
  const [many, setMany] = useState(() => keptPicks.length > 0)
  useEffect(() => { if (tall) setMany(true) }, [tall])
  useEffect(() => { void recentPhotos(many ? 90 : 30).then(setPhotos) }, [many])
  useEffect(() => {
    const back = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', back)
    return () => window.removeEventListener('keydown', back)
  }, [onClose])

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < max ? [...p, id] : p))
  const sendPicked = async () => {
    const files = (await Promise.all((photos ?? []).filter((p) => picked.includes(p.id)).map(photoFile))).filter((f): f is File => !!f)
    if (files.length) onFiles(files)
    // sent: nothing stays picked
    keptPicks = []
    onClose()
  }
  const fromInput = (list: FileList | null) => {
    const files = [...(list ?? [])].slice(0, max)
    if (files.length) onFiles(files)
    onClose()
  }
  // the sheet follows the finger — from anywhere on its top part, and from the photos when they are at
  // their top (pulled down) or the sheet can still grow (pulled up); let go, it settles by where it is
  // and how fast it was moving: tall, as it was, or closed. Moved straight on the page, frame by frame.
  const closing = useRef(false)
  /** how tall it was when it opened (half), to come back to; and whether it is tall now (read in the touch handlers) */
  const half = useRef(0)
  const isTall = useRef(tall)
  isTall.current = tall
  const close = () => {
    const el = sheet.current
    if (!el || closing.current) return onClose()
    closing.current = true
    el.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 1, 1)'
    el.style.transform = 'translateY(105%)'
    setTimeout(onClose, 200)
  }
  useEffect(() => {
    const el = sheet.current
    if (!el) return
    let y0 = 0
    let x0 = 0
    let h0 = 0
    let engaged = false
    let ignored = false
    let fromGrid = false
    let height = 0
    let frame = 0
    let samples: { y: number; t: number }[] = []
    const vh = () => window.innerHeight
    const top = () => Math.min(vh() * 0.92, vh() - 24)
    const paint = () => {
      frame = 0
      el.style.maxHeight = 'none'
      if (height < h0) {
        // pulled down: the sheet slides (cheap), its size stays
        el.style.height = `${h0}px`
        el.style.transform = `translateY(${h0 - height}px)`
      } else {
        el.style.transform = ''
        el.style.height = `${height}px`
      }
    }
    const start = (e: TouchEvent | PointerEvent) => {
      if (closing.current) return
      const p = 'touches' in e ? e.touches[0] : e
      y0 = p.clientY
      x0 = p.clientX
      h0 = el.offsetHeight
      if (!isTall.current) half.current = h0
      height = h0
      engaged = false
      ignored = false
      fromGrid = !!(e.target as HTMLElement).closest?.('.attach-photos')
      samples = [{ y: y0, t: performance.now() }]
      el.style.transition = 'none'
    }
    const move = (e: TouchEvent | PointerEvent) => {
      if (ignored || closing.current || (!('touches' in e) && !(e.buttons & 1))) return
      const p = 'touches' in e ? e.touches[0] : e
      const dy = p.clientY - y0
      if (!engaged) {
        if (Math.abs(dy) < 6 && Math.abs(p.clientX - x0) < 6) return
        // sideways (the row of modes): not the sheet's
        if (Math.abs(p.clientX - x0) > Math.abs(dy)) { ignored = true; return }
        if (fromGrid) {
          const grid = el.querySelector<HTMLElement>('.attach-photos')
          const atTop = !grid || grid.scrollTop <= 0
          if (!((dy > 0 && atTop) || (dy < 0 && h0 < top() - 4))) { ignored = true; return }
        }
        engaged = true
        y0 = p.clientY
      }
      if (e.cancelable) e.preventDefault()
      const d = p.clientY - y0
      // past the top it gives a little, like rubber
      const raw = h0 - d
      height = raw > top() ? top() + (raw - top()) * 0.15 : Math.max(0, raw)
      samples.push({ y: p.clientY, t: performance.now() })
      if (samples.length > 6) samples.shift()
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const end = () => {
      if (!engaged) return
      engaged = false
      cancelAnimationFrame(frame)
      frame = 0
      const first = samples[0]
      const last = samples[samples.length - 1]
      // px per ms, downwards positive
      const v = last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0
      const ease = 'cubic-bezier(0.22, 1, 0.36, 1)'
      // tall and pulled down: back to where it began (half), never closed at once
      if (isTall.current && (v > 0.25 || height < h0 - 60)) {
        el.style.transition = `transform 0.32s ${ease}, height 0.32s ${ease}`
        el.style.transform = ''
        el.style.height = `${half.current || Math.min(vh() * 0.62, h0)}px`
        setTimeout(() => {
          if (closing.current) return
          el.style.transition = ''
          el.style.height = ''
          el.style.maxHeight = ''
          setTall(false)
        }, 320)
        return
      }
      if (v > 0.55 || (v > -0.2 && height < h0 * 0.6 && height < vh() * 0.4)) return close()
      const wantTall = v < -0.45 || height > Math.max(h0, vh() * 0.55) + 24 || (isTall.current && height > vh() * 0.62)
      const target = wantTall ? top() : Math.min(el.scrollHeight, vh() * 0.78)
      el.style.transition = `transform 0.32s ${ease}, height 0.32s ${ease}`
      el.style.transform = ''
      el.style.height = `${wantTall || isTall.current ? target : h0}px`
      setTimeout(() => {
        if (closing.current) return
        el.style.transition = ''
        el.style.height = ''
        el.style.maxHeight = ''
        setTall(wantTall)
      }, 320)
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    // a mouse: by the handle only
    const handle = el.querySelector<HTMLElement>('.attach-handle')
    const pdown = (e: PointerEvent) => { if (e.pointerType === 'mouse') { handle?.setPointerCapture(e.pointerId); start(e) } }
    const pmove = (e: PointerEvent) => { if (e.pointerType === 'mouse') move(e) }
    const pup = (e: PointerEvent) => { if (e.pointerType === 'mouse') end() }
    handle?.addEventListener('pointerdown', pdown)
    handle?.addEventListener('pointermove', pmove)
    handle?.addEventListener('pointerup', pup)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
      handle?.removeEventListener('pointerdown', pdown)
      handle?.removeEventListener('pointermove', pmove)
      handle?.removeEventListener('pointerup', pup)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tall, camera])

  if (camera) return <InAppCamera onShot={(f) => { onFiles([f]); onClose() }} onClose={() => setCamera(false)} onGallery={() => { setCamera(false); setTall(true) }} />
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="attach-veil" onClick={close}>
      <section ref={sheet} className={`attach${tall ? ' is-tall' : ''}${picked.length ? ' has-picked' : ''}`} role="dialog" aria-modal="true" aria-label={t('ai.attach')} onClick={(e) => e.stopPropagation()}>
        <div className="attach-handle"><span /></div>

        {/* what to add, and what she can make: bright little app icons */}
        <div className="attach-actions">
          <button type="button" onClick={() => gallery.current?.click()}><span className="attach-ico tone-gallery"><Icon name="image" size={24} /></span>{t('ai.gallery')}</button>
          <button type="button" onClick={() => docs.current?.click()}><span className="attach-ico tone-doc"><Icon name="file" size={24} /></span>{t('ai.document')}</button>
          {MAKE.map((m) => (
            <button key={m.command} type="button" onClick={() => onCommand(m.command)}><span className={`attach-ico tone-${m.tone}`}>{m.glyph()}</span>{t(m.key)}</button>
          ))}
          {onStudy ? <button type="button" className="attach-study" onClick={onStudy}><span className="attach-ico tone-study"><Icon name="cap" size={24} /></span>{t('ai.study')}</button> : null}
        </div>
        {/* how she answers: quiet chips in a row */}
        <div className="attach-modes" role="group" aria-label={t('ai.modes')}>
          {AI_MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} className={`tone-${m.id}${mode === m.id ? ' is-on' : ''}`} style={{ ['--c' as string]: m.color }} onClick={() => onMode(mode === m.id ? null : m.id)}>
              <Icon name={m.icon} size={15} />{t(`ai.mode_${m.id}`)}
            </button>
          ))}
        </div>
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
        {/* chosen photos: a bar over the bottom of the sheet (what is above it never moves) */}
        {picked.length ? (
          <div className="attach-send-bar">
            <button type="button" className="btn attach-send" onClick={() => void sendPicked()}><Icon name="up" size={18} />{t('ai.attach_send').replace('{n}', String(picked.length))}</button>
          </div>
        ) : null}
        <input ref={docs} type="file" hidden multiple accept="application/pdf,text/plain" onChange={(e) => fromInput(e.target.files)} />
        <input ref={gallery} type="file" hidden multiple accept="image/*" onChange={(e) => fromInput(e.target.files)} />
      </section>
    </div>,
    document.body
  )
}

/** a transparent pixel: the video's poster until the camera's picture comes */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

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
  const [live, setLive] = useState(false)
  const stream = useRef<MediaStream | null>(null)

  useEffect(() => {
    let live = true
    const open = async () => {
      stream.current?.getTracks().forEach((tr) => tr.stop())
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: front ? 'user' : 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
        if (!live) return s.getTracks().forEach((tr) => tr.stop())
        stream.current = s
        setLive(false)
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
      {/* black until the picture comes (no grey "play" poster of the phone's own), then it fades in */}
      <video ref={video} className={`${front ? 'is-front' : ''}${live ? ' is-live' : ''}`} playsInline muted poster={BLANK} onPlaying={() => setLive(true)} />
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

/** a slide on its stand, with a small rising chart */
function SlidesGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3.5" width="18" height="12.5" rx="2" />
      <path d="M12 16v3.5M8.5 20.5h7" />
      <path d="M7.5 12.5v-2M11 12.5V8M14.5 12.5V9.5" strokeWidth="2.2" />
      <circle cx="17.5" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
/** a page with its corner folded and "PDF" across it */
function PdfGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.5 2.5h8l4.5 4.5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14.5 2.5V7H19" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <text x="12" y="17.2" textAnchor="middle" fill="currentColor" fontSize="6.4" fontWeight="800" fontFamily="system-ui, sans-serif" letterSpacing="0.2">PDF</text>
    </svg>
  )
}
/** a page with a bold "W" */
function WordGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.5 2.5h8l4.5 4.5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14.5 2.5V7H19" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 10.5l1.4 6 2.6-5.2 2.6 5.2 1.4-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

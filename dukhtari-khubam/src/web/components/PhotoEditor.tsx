'use client'

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'

import { clearPhoto, writePhoto } from '../offline/photo'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

const OUT = 512
const MAX_ZOOM = 4

/**
 * Cutting the profile photo: the picture lies under a fixed round frame; one finger moves it, two fingers
 * (or the slider) bring it closer or further, and "Тайёр" keeps exactly what is inside the circle.
 */
export function PhotoCropper({ file, onClose }: { file: File; onClose: () => void }) {
  const { t } = usePrefs()
  const [url] = useState(() => URL.createObjectURL(file))
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const frame = useRef<HTMLDivElement>(null)
  const [side, setSide] = useState(300)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; zoom: number } | null>(null)

  useEffect(() => {
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = url
    return () => URL.revokeObjectURL(url)
  }, [url])
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const ro = new ResizeObserver(() => setSide(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const base = img ? side / Math.min(img.naturalWidth, img.naturalHeight) : 1
  const scale = base * zoom
  const w = img ? img.naturalWidth * scale : side
  const h = img ? img.naturalHeight * scale : side
  // the picture always covers the whole circle
  const clamp = (p: { x: number; y: number }, ww = w, hh = h) => ({
    x: Math.max(-(ww - side) / 2, Math.min((ww - side) / 2, p.x)),
    y: Math.max(-(hh - side) / 2, Math.min((hh - side) / 2, p.y))
  })
  const setZoomTo = (z: number) => {
    const next = Math.max(1, Math.min(MAX_ZOOM, z))
    const k = next / zoom
    setZoom(next)
    if (img) setPos((p) => clamp({ x: p.x * k, y: p.y * k }, img.naturalWidth * base * next, img.naturalHeight * base * next))
  }

  const down = (e: RPointerEvent) => {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }
  const move = (e: RPointerEvent) => {
    const last = pointers.current.get(e.pointerId)
    if (!last) return
    const now = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, now)
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()]
      setZoomTo(gesture.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.current.dist))
    } else if (pointers.current.size === 1) {
      setPos((p) => clamp({ x: p.x + now.x - last.x, y: p.y + now.y - last.y }))
    }
  }
  const up = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current = null
  }

  const done = () => {
    if (!img) return
    const c = document.createElement('canvas')
    c.width = c.height = OUT
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    const size = side / scale
    const sx = img.naturalWidth / 2 - (side / 2 + pos.x) / scale
    const sy = img.naturalHeight / 2 - (side / 2 + pos.y) / scale
    ctx.drawImage(img, sx, sy, size, size, 0, 0, OUT, OUT)
    writePhoto(c.toDataURL('image/jpeg', 0.88))
    onClose()
  }

  return createPortal(
    <div className="crop-screen" role="dialog" aria-modal="true" aria-label={t('photo.crop')}>
      <p className="crop-title">{t('photo.crop')}</p>
      <div ref={frame} className="crop-frame" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onWheel={(e) => setZoomTo(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}>
        {img ? (
          <img src={url} alt="" draggable={false} style={{ width: w, height: h, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }} />
        ) : null}
        <span className="crop-ring" aria-hidden="true" />
      </div>
      <div className="crop-zoom">
        <Icon name="search" size={16} />
        <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} aria-label={t('photo.zoom')} onChange={(e) => setZoomTo(Number(e.target.value))} />
        <Icon name="search" size={22} />
      </div>
      <p className="crop-hint">{t('photo.crop_hint')}</p>
      <div className="crop-actions">
        <button type="button" className="btn btn-soft" onClick={onClose}>{t('pin.cancel')}</button>
        <button type="button" className="btn" onClick={done} disabled={!img}><Icon name="check" size={18} /> {t('photo.done')}</button>
      </div>
    </div>,
    document.body
  )
}

/** The choices that open from the profile photo: change it, take a new one, or remove the current one. */
export function PhotoSheet({ hasPhoto, onClose }: { hasPhoto: boolean; onClose: () => void }) {
  const { t } = usePrefs()
  const pick = useRef<HTMLInputElement>(null)
  const shoot = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const onFile = (f?: File | null) => {
    if (f) setFile(f)
  }
  if (file) return <PhotoCropper file={file} onClose={onClose} />
  return createPortal(
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet glass" role="dialog" aria-modal="true" aria-label={t('profile.photo')} onClick={(e) => e.stopPropagation()}>
        <span className="sheet-grip" aria-hidden="true" />
        <button type="button" className="sheet-row" onClick={() => pick.current?.click()}>
          <span className="sheet-icon"><Icon name="image" size={20} /></span>{t(hasPhoto ? 'photo.change' : 'photo.choose')}
        </button>
        <button type="button" className="sheet-row" onClick={() => shoot.current?.click()}>
          <span className="sheet-icon"><Icon name="camera" size={20} /></span>{t('photo.new')}
        </button>
        {hasPhoto ? (
          <button type="button" className="sheet-row danger" onClick={() => { clearPhoto(); onClose() }}>
            <span className="sheet-icon"><Icon name="trash" size={20} /></span>{t('photo.remove')}
          </button>
        ) : null}
        <button type="button" className="sheet-cancel" onClick={onClose}>{t('pin.cancel')}</button>
        <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={shoot} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </div>,
    document.body
  )
}

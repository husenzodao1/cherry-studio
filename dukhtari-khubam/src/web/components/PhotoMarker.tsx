'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { AiUpload } from '../offline/mahliyo'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/**
 * A picture about to go to Mahliyo, opened large: with a red pen the learner circles or underlines the
 * places she means. "Done" draws her marks into the picture itself (and its small copy), so Mahliyo sees
 * exactly what was pointed at.
 */

type Stroke = { x: number; y: number }[]
const RED = '#ff2d2d'
/** the small copy's longest side, as when the picture was chosen */
const THUMB_SIDE = 360

export function PhotoMarker({ file, onDone, onClose }: { file: AiUpload; onDone: (f: AiUpload) => void; onClose: () => void }) {
  const { t } = usePrefs()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const drawing = useRef<Stroke | null>(null)

  useEffect(() => {
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = `data:${file.mime};base64,${file.data}`
  }, [file])

  // the picture and the marks, in the picture's own pixels (the canvas is shown fitted to the screen)
  const paint = (list: Stroke[]) => {
    const c = canvas.current
    if (!c || !img) return
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0, c.width, c.height)
    g.strokeStyle = RED
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.lineWidth = Math.max(4, Math.round(Math.max(c.width, c.height) / 160))
    g.shadowColor = 'rgba(0, 0, 0, 0.25)'
    g.shadowBlur = g.lineWidth / 2
    for (const s of list) {
      if (!s.length) continue
      g.beginPath()
      g.moveTo(s[0].x, s[0].y)
      if (s.length === 1) g.lineTo(s[0].x + 0.1, s[0].y)
      for (const p of s.slice(1)) g.lineTo(p.x, p.y)
      g.stroke()
    }
    g.shadowBlur = 0
  }
  useEffect(() => {
    const c = canvas.current
    if (!c || !img) return
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    paint(strokes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img])

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget
    // the canvas fills the stage with the picture fitted inside it (object-fit: contain)
    const r = c.getBoundingClientRect()
    const k = Math.min(r.width / c.width, r.height / c.height)
    const left = r.left + (r.width - c.width * k) / 2
    const top = r.top + (r.height - c.height * k) / 2
    return { x: (e.clientX - left) / k, y: (e.clientY - top) / k }
  }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = [at(e)]
    paint([...strokes, drawing.current])
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    drawing.current.push(at(e))
    paint([...strokes, drawing.current])
  }
  const up = () => {
    if (!drawing.current) return
    const next = [...strokes, drawing.current]
    drawing.current = null
    setStrokes(next)
    paint(next)
  }
  const undo = () => {
    const next = strokes.slice(0, -1)
    setStrokes(next)
    paint(next)
  }
  const done = () => {
    const c = canvas.current
    if (!c || !strokes.length) return onClose()
    const data = c.toDataURL('image/jpeg', 0.86)
    const k = Math.min(1, THUMB_SIDE / Math.max(c.width, c.height))
    const small = document.createElement('canvas')
    small.width = Math.max(1, Math.round(c.width * k))
    small.height = Math.max(1, Math.round(c.height * k))
    small.getContext('2d')!.drawImage(c, 0, 0, small.width, small.height)
    onDone({ ...file, mime: 'image/jpeg', data: data.split(',')[1], thumb: small.toDataURL('image/jpeg', 0.75) })
  }

  return createPortal(
    <div className="pmark" role="dialog" aria-modal="true" aria-label={t('ai.mark_title')}>
      <header className="pmark-top">
        <button type="button" className="pmark-btn" aria-label={t('pin.cancel')} onClick={onClose}><Icon name="x" size={20} /></button>
        <span className="pmark-hint"><i className="pmark-dot" />{t('ai.mark_hint')}</span>
        <button type="button" className="pmark-btn" aria-label={t('ai.mark_undo')} disabled={!strokes.length} onClick={undo}><Icon name="back" size={20} /></button>
      </header>
      <div className="pmark-stage">
        <canvas ref={canvas} className="pmark-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      </div>
      <footer className="pmark-bottom">
        <button type="button" className="pmark-clear" disabled={!strokes.length} onClick={() => { setStrokes([]); paint([]) }}>{t('ai.mark_clear')}</button>
        <button type="button" className="pmark-done" onClick={done}><Icon name="check" size={18} />{t('ai.mark_done')}</button>
      </footer>
    </div>,
    document.body
  )
}

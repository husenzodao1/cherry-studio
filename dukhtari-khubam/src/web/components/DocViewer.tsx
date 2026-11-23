'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'

import { bodyFont, innerColours, innerHeader, type SlideStyle } from '@/lib/slideStyles'

import { parseSlides, type Slide } from '../files/markdown'
import { usePrefs } from '../prefs'
import { AiMarkdown } from './AiMarkdown'
import { Icon } from './Icon'
import { SlideCover } from './SlidesSetup'
import { showToast } from './Toast'

/**
 * A document shown inside the app, over the whole screen: a PDF page by page, a presentation as slides
 * that come in like PowerPoint's (with a pen to mark what to change), a text or code, or a document's
 * words. "Кушодан дар барнома" hands the file to another app of the phone.
 */
export interface DocSource {
  name: string
  /** the file itself, built or read when needed (for "open in an app" and for a PDF's pages) */
  file?: () => Promise<Blob>
  kind: 'pdf' | 'slides' | 'markdown' | 'code' | 'text'
  /** the words: a document's Markdown, a presentation's slides, or code */
  content?: string
  lang?: string
  style?: SlideStyle
}

/** "Where shall it open?": inside the app, or another app of the phone. */
export function OpenChoice({ name, onInside, onOther, onClose }: { name: string; onInside: () => void; onOther: () => void; onClose: () => void }) {
  const { t } = usePrefs()
  return createPortal(
    <div className="attach-veil" onClick={onClose}>
      <section className="open-choice" role="dialog" aria-modal="true" aria-label={t('doc.where')} onClick={(e) => e.stopPropagation()}>
        <b>{t('doc.where')}</b>
        <span className="open-choice-name">{name}</span>
        <button type="button" className="open-choice-opt" onClick={onInside}><span className="attach-ico tone-doc"><Icon name="eye" size={20} /></span>{t('doc.inside')}</button>
        <button type="button" className="open-choice-opt" onClick={onOther}><span className="attach-ico tone-gallery"><Icon name="share" size={20} /></span>{t('doc.other_app')}</button>
      </section>
    </div>,
    document.body
  )
}

export function DocViewer({ doc, onClose, onEdit }: { doc: DocSource; onClose: () => void; onEdit?: (change: string) => void }) {
  const { t } = usePrefs()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const back = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', back)
    return () => window.removeEventListener('keydown', back)
  }, [onClose])
  const other = async () => {
    if (!doc.file) return
    setBusy(true)
    try {
      const { openFile } = await import('../files/build')
      if ((await openFile(doc.name, await doc.file(), doc.name)) === 'no_app') showToast(t('ai.file_no_app'), 'info')
    } catch {
      showToast(t('ai.file_failed'), 'alert')
    } finally {
      setBusy(false)
    }
  }
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className={`docv kind-${doc.kind}`} role="dialog" aria-modal="true" aria-label={doc.name}>
      <header className="docv-top">
        <button type="button" className="docv-btn" aria-label={t('action.close')} onClick={onClose}><Icon name="x" size={20} /></button>
        <b className="grow docv-name">{doc.name}</b>
        {doc.file ? <button type="button" className="docv-open" onClick={() => void other()} disabled={busy}><Icon name="share" size={16} />{t('doc.open_app')}</button> : null}
      </header>
      <div className="docv-body">
        {doc.kind === 'pdf' && doc.file ? <PdfPages file={doc.file} />
          : doc.kind === 'slides' ? <SlidesPlayer content={doc.content ?? ''} style={doc.style} onEdit={onEdit} />
          : doc.kind === 'code' ? <div className="docv-paper ai-md"><AiMarkdown text={`\`\`\`${doc.lang ?? ''}\n${doc.content ?? ''}\n\`\`\``} /></div>
          : doc.kind === 'markdown' ? <div className="docv-paper ai-md"><AiMarkdown text={doc.content ?? ''} /></div>
          : <TextFile doc={doc} />}
      </div>
    </div>,
    document.body
  )
}

function TextFile({ doc }: { doc: DocSource }) {
  const [text, setText] = useState<string | null>(doc.content ?? null)
  useEffect(() => { if (text === null && doc.file) void doc.file().then((b) => b.text()).then(setText).catch(() => setText('')) }, [doc, text])
  return <pre className="docv-paper docv-text">{text ?? ''}</pre>
}

/** A PDF, page after page, drawn sharp for the screen (pdf.js, loaded only here). */
function PdfPages({ file }: { file: () => Promise<Blob> }) {
  const { t } = usePrefs()
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        const data = new Uint8Array(await (await file()).arrayBuffer())
        const pdf = await pdfjs.getDocument({ data }).promise
        if (!live || !box.current) return
        setState('ready')
        const width = box.current.clientWidth
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        for (let n = 1; n <= Math.min(pdf.numPages, 80) && live; n++) {
          const page = await pdf.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const view = page.getViewport({ scale: (width / base.width) * dpr })
          const canvas = document.createElement('canvas')
          canvas.width = view.width
          canvas.height = view.height
          canvas.className = 'docv-page'
          box.current?.appendChild(canvas)
          await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: view }).promise
        }
      } catch {
        if (live) setState('failed')
      }
    })()
    return () => { live = false }
  }, [file])
  return (
    <div className="docv-pages" ref={box}>
      {state === 'loading' ? <p className="docv-note"><span className="mi-dots"><i /><i /><i /></span></p> : null}
      {state === 'failed' ? <p className="docv-note">{t('ai.file_failed')}</p> : null}
    </div>
  )
}

/**
 * A presentation played inside the app: each slide comes in, its title and then its points one after
 * another (a tap shows the next point, then the next slide); ‹ › and a swipe move between slides, ▶ plays
 * them on their own. The pen marks what to change; the marked parts and her words go to Mahliyo.
 */
function SlidesPlayer({ content, style, onEdit }: { content: string; style?: SlideStyle; onEdit?: (change: string) => void }) {
  const { t } = usePrefs()
  const slides = useMemo(() => parseSlides(content), [content])
  const [at, setAt] = useState(0)
  const [shown, setShown] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [pen, setPen] = useState(false)
  const [marked, setMarked] = useState<string[] | null>(null)
  const [change, setChange] = useState('')
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<{ x: number; y: number }[][]>([])
  const swipe = useRef<number | null>(null)
  const slide = slides[at]
  const parts = slide && at > 0 ? slide.points.length + (slide.table ? 1 : 0) : 0

  const go = (n: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, n))
    setAt(next)
    setShown(0)
    clearPen()
  }
  // a tap: all the slide's points at once (when still coming in), then the next slide
  const step = () => {
    if (shown < parts) setShown(parts)
    else if (at < slides.length - 1) go(at + 1)
    else setPlaying(false)
  }
  // a new slide builds itself: its points come in one after another, as in a slide show
  useEffect(() => {
    if (pen || shown >= parts) return
    const timer = setTimeout(() => setShown((x) => x + 1), shown === 0 ? 650 : 420)
    return () => clearTimeout(timer)
  }, [shown, parts, pen])
  // playing: the next point (or slide) every few seconds
  useEffect(() => {
    if (!playing) return
    if (shown < parts) return
    const timer = setTimeout(step, 4200)
    return () => clearTimeout(timer)
  })

  // the pen: strokes on a canvas over the slide
  const clearPen = () => {
    strokes.current = []
    const c = canvas.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
  }
  const penDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!
    const r = c.getBoundingClientRect()
    if (c.width !== Math.round(r.width)) { c.width = Math.round(r.width); c.height = Math.round(r.height) }
    c.setPointerCapture(e.pointerId)
    strokes.current.push([{ x: e.clientX - r.left, y: e.clientY - r.top }])
  }
  const penMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const line = strokes.current[strokes.current.length - 1]
    if (!line || !e.buttons) return
    const c = canvas.current!
    const r = c.getBoundingClientRect()
    const p = { x: e.clientX - r.left, y: e.clientY - r.top }
    const g = c.getContext('2d')!
    g.strokeStyle = '#ff3b6b'
    g.lineWidth = 4
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(line[line.length - 1].x, line[line.length - 1].y)
    g.lineTo(p.x, p.y)
    g.stroke()
    line.push(p)
  }
  /** the parts of the slide under the pen's marks (its title, points, table) */
  const underPen = (): string[] => {
    const all = strokes.current.flat()
    if (!all.length || !stage.current) return []
    const box = canvas.current!.getBoundingClientRect()
    const xs = all.map((p) => p.x + box.left)
    const ys = all.map((p) => p.y + box.top)
    const area = { l: Math.min(...xs) - 6, r: Math.max(...xs) + 6, t: Math.min(...ys) - 6, b: Math.max(...ys) + 6 }
    return [...stage.current.querySelectorAll<HTMLElement>('[data-part]')].filter((el) => {
      const e = el.getBoundingClientRect()
      return e.left < area.r && e.right > area.l && e.top < area.b && e.bottom > area.t
    }).map((el) => el.dataset.part!)
  }
  const finishPen = () => {
    setPen(false)
    setMarked(underPen())
  }
  const send = () => {
    if (!onEdit || !change.trim() || !slide) return
    const parts = marked?.length ? marked.map((p) => `«${p}»`).join(', ') : t('doc.whole_slide')
    onEdit(`${t('doc.edit_slide').replace('{n}', String(at + 1)).replace('{title}', slide.title)} ${t('doc.edit_parts')}: ${parts}. ${t('doc.edit_change')}: ${change.trim()}`)
    setMarked(null)
    setChange('')
    clearPen()
  }

  if (!slides.length || !slide) return <p className="docv-note">{t('ai.file_failed')}</p>
  return (
    <div className="sp">
      <div ref={stage} className={`sp-stage${pen ? ' is-pen' : ''}`}
        onPointerDown={(e) => { if (!pen) swipe.current = e.clientX }}
        onPointerUp={(e) => {
          if (pen || swipe.current === null) return
          const dx = e.clientX - swipe.current
          swipe.current = null
          if (dx < -50) go(at + 1)
          else if (dx > 50) go(at - 1)
          else step()
        }}>
        <SlideView key={at} slide={slide} n={at} style={style} shown={shown} />
        <canvas ref={canvas} className="sp-pen" style={{ pointerEvents: pen ? 'auto' : 'none' }} onPointerDown={penDown} onPointerMove={penMove} />
      </div>
      <div className="sp-ctl">
        <button type="button" className="docv-btn" aria-label={t('doc.prev')} onClick={() => go(at - 1)} disabled={at === 0}><Icon name="back" size={22} /></button>
        <button type="button" className="docv-btn sp-play" aria-label={playing ? t('doc.pause') : t('doc.play')} onClick={() => setPlaying(!playing)}><Icon name={playing ? 'pause' : 'play'} size={24} fill="currentColor" /></button>
        <span className="sp-count">{at + 1} / {slides.length}</span>
        <button type="button" className="docv-btn" aria-label={t('doc.next')} onClick={step} disabled={at === slides.length - 1 && shown >= parts}><Icon name="forward" size={22} /></button>
        {onEdit ? (
          pen
            ? <button type="button" className="docv-open" onClick={finishPen}><Icon name="check" size={16} />{t('doc.pen_done')}</button>
            : <button type="button" className="docv-btn sp-pen-btn" aria-label={t('doc.pen')} onClick={() => { setPen(true); setMarked(null); setShown(parts) }}><Icon name="edit" size={22} /></button>
        ) : null}
      </div>
      {slide.notes ? <p className="sp-notes"><Icon name="volume" size={14} />{slide.notes}</p> : null}
      {marked !== null && onEdit ? (
        <div className="sp-change">
          <b>{t('doc.change_title')}</b>
          <span className="sp-marked">{marked.length ? marked.join(' · ') : t('doc.whole_slide')}</span>
          <textarea rows={3} value={change} maxLength={1200} placeholder={t('doc.change_ph')} onChange={(e) => setChange(e.target.value)} autoFocus />
          <div className="sp-change-acts">
            <button type="button" className="docv-btn-text" onClick={() => { setMarked(null); setChange(''); clearPen() }}>{t('pin.cancel')}</button>
            <button type="button" className="btn" disabled={!change.trim()} onClick={send}>{t('doc.change_send')}</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** One slide, as the PowerPoint draws it: the cover, or the title held the style's way and its points. */
function SlideView({ slide, n, style, shown }: { slide: Slide; n: number; style?: SlideStyle; shown: number }) {
  if (!style) return <div className="sp-slide is-plain" data-part={slide.title}><b>{slide.title}</b></div>
  if (n === 0) {
    return (
      <div className="sp-slide is-cover" data-part={slide.title}>
        <SlideCover style={style} title={slide.title} sub={slide.subtitle || slide.points.map((p) => p.text.map((r) => r.text).join('')).join(' · ')} />
      </div>
    )
  }
  const c = innerColours(style)
  const head = innerHeader(style)
  return (
    <div className={`sp-slide head-${head}`} style={{ background: c.paper, color: c.ink, ['--ac' as string]: style.accent, ['--mk' as string]: c.mark, ['--hb' as string]: style.bg, ['--hf' as string]: style.fg }}>
      <h3 className="sp-title" data-part={slide.title} style={{ fontFamily: `'${style.font}', sans-serif`, color: head === 'top' ? style.fg : c.title }}>{slide.title}</h3>
      <div className="sp-body" style={{ fontFamily: `'${bodyFont(style)}', sans-serif` }}>
        {slide.subtitle ? <p className="sp-sub">{slide.subtitle}</p> : null}
        <ul>
          {slide.points.map((p, i) => {
            const text = p.text.map((r) => r.text).join('')
            return <li key={i} data-part={text} className={`sp-pt lvl-${p.level}${i < shown ? ' is-in' : ''}`}>{text}</li>
          })}
        </ul>
        {slide.table ? (
          <table data-part={slide.table.head.join(' | ')} className={`sp-table${slide.points.length < shown ? ' is-in' : ''}`}>
            <thead><tr>{slide.table.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{slide.table.rows.map((r, i) => <tr key={i}>{r.map((c2, k) => <td key={k}>{c2}</td>)}</tr>)}</tbody>
          </table>
        ) : null}
      </div>
    </div>
  )
}

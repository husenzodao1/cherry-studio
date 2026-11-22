'use client'

import { useEffect, useRef } from 'react'

/**
 * "Nothing found", "Nothing saved yet"…: the words in a soft hand, and a real magnifying glass (a 3D
 * render: rose-gold rim, plum handle) drifting over them as a hand would move it — easing out at each
 * end, a little sway, the glass tilting with the movement and its shadow following on the page.
 *
 * The view through the glass is computed like a real lens, pixel by pixel on a small canvas: the
 * middle magnifies most (about ×2), and towards the rim the magnification falls off, so the letters
 * bulge in the centre and curve away to both sides. It is the same on every phone (no SVG filter),
 * and cheap: the glass is small. The words beneath it are hidden, so nothing shows twice.
 */
const R = 21 // radius of the glass, px
const CENTRE = 2.05 // magnification in the middle
const EDGE = 1.05 // magnification at the rim
const PERIOD = 5.2 // s for a sweep there and back
// where the hole of the rendered rim sits in magnifier.webp (fractions of its width), and its radius
const IMG = { cx: 273 / 742, cy: 270 / 742, r: 228 / 742 }

const smooth = (u: number) => u * u * (3 - 2 * u)

export function LensText({ text }: { text: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const line = useRef<HTMLSpanElement>(null)
  const glass = useRef<HTMLDivElement>(null)
  const view = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLImageElement>(null)
  const shadow = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const S = Math.round(R * 2 * dpr)
    const out = view.current!.getContext('2d')!
    view.current!.width = view.current!.height = S
    const lensImg = out.createImageData(S, S)
    // the words, drawn once (again when the fonts or the size change) into an off-screen picture
    let src: { data: Uint8ClampedArray; w: number; h: number } | null = null
    const paint = () => {
      const l = line.current
      if (!l) return
      const r = l.getBoundingClientRect()
      const cs = getComputedStyle(l)
      const w = Math.ceil(r.width * dpr)
      const h = Math.ceil(r.height * dpr)
      if (!w || !h) return
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      ctx.fillStyle = cs.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      const m = ctx.measureText(text)
      const asc = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent
      const desc = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent
      // the baseline where the browser puts it in the line box
      ctx.fillText(text, r.width / 2, (r.height - (asc + desc)) / 2 + asc)
      src = { data: ctx.getImageData(0, 0, w, h).data, w, h }
    }
    paint()
    document.fonts?.ready.then(paint).catch(() => undefined)
    const ro = new ResizeObserver(paint)
    if (line.current) ro.observe(line.current)

    let raf = 0
    const t0 = performance.now()
    let lastX = -1
    let tilt = 0
    const tick = (now: number) => {
      const w = wrap.current
      const l = line.current
      if (!w || !l || !glass.current || !frame.current || !shadow.current) return
      const t = (now - t0) / 1000
      const box = w.getBoundingClientRect()
      const lb = l.getBoundingClientRect()
      const lx0 = lb.left - box.left
      const ly0 = lb.top - box.top
      // there and back along the line, slowing at each end like a hand reading
      const u = (t % PERIOD) / PERIOD
      const v = u < 0.5 ? smooth(u * 2) : 1 - smooth((u - 0.5) * 2)
      const left = lx0 + R * 0.5
      const right = lb.right - box.left - R * 0.5
      const x = left + v * Math.max(0, right - left)
      // the middle of the letters themselves (handwriting sits low in its line)
      const y = ly0 + lb.height * 0.68 + Math.sin(t * 1.9) * 1.5
      const vx = lastX < 0 ? 0 : x - lastX
      lastX = x
      tilt += (Math.max(-14, Math.min(14, vx * 4)) - tilt) * 0.12 // eased, so the hand never jerks
      glass.current.style.transform = `translate(${x - R}px, ${y - R}px)`
      frame.current.style.transform = `rotate(${tilt}deg)`
      shadow.current.style.transform = `translate(${x - R + 6}px, ${y - R + 10}px) rotate(${tilt}deg)`
      l.style.setProperty('--lx', `${x - lx0}px`)
      l.style.setProperty('--ly', `${y - ly0}px`)
      // the view through the glass: each pixel looks back at the words, nearer the centre the closer
      // it is to the middle (strong magnification), less so towards the rim (the letters curve away)
      if (src) {
        const d = lensImg.data
        const sd = src.data
        for (let j = 0; j < S; j++) {
          const py = (j + 0.5) / dpr - R
          for (let i = 0; i < S; i++) {
            const px = (i + 0.5) / dpr - R
            const rr = (px * px + py * py) / (R * R)
            const o = (j * S + i) * 4
            if (rr >= 1) { d[o + 3] = 0; continue }
            const mag = CENTRE + (EDGE - CENTRE) * rr // falls off with r²: the barrel of a real lens
            const sx = Math.round((x + px / mag - lx0) * dpr)
            const sy = Math.round((y + py / mag - ly0) * dpr)
            if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) { d[o + 3] = 0; continue }
            const so = (sy * src.w + sx) * 4
            d[o] = sd[so]; d[o + 1] = sd[so + 1]; d[o + 2] = sd[so + 2]; d[o + 3] = sd[so + 3]
          }
        }
        out.putImageData(lensImg, 0, 0)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [text])

  const size = R / IMG.r // rendered image width in px
  return (
    <div ref={wrap} className="lens-text" style={{ ['--r' as string]: `${R}px` }}>
      <span ref={line} className="lens-line">{text}</span>
      <span ref={shadow} className="lens-shadow" aria-hidden="true" />
      <div ref={glass} className="lens-glass" aria-hidden="true">
        <div className="lens-clip"><canvas ref={view} className="lens-view" /></div>
        <img ref={frame} className="lens-frame" src="/assets/3d/magnifier.webp" alt=""
          style={{ width: size, left: R - IMG.cx * size, top: R - IMG.cy * size, transformOrigin: `${IMG.cx * size}px ${IMG.cy * size}px` }} />
      </div>
    </div>
  )
}

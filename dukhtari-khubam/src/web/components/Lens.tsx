'use client'

import { useEffect, useId, useRef, useState } from 'react'

/**
 * "Nothing found", "Nothing saved yet"…: the words in a soft hand, and a real magnifying glass (a 3D
 * render: rose-gold rim, plum handle) drifting over them as a hand would move it — easing out at each
 * end, a little sway, the glass tilting with the movement and its shadow following on the page.
 * Under the glass the letters are magnified, most in the middle and bent outwards towards the rim
 * (a barrel displacement map); the words beneath are hidden there, so nothing shows twice.
 */
const R = 26 // radius of the glass, px
const ZOOM = 1.65
const PERIOD = 5.2 // s for a sweep there and back
// where the hole of the rendered rim sits in magnifier.webp (fractions of its width), and its radius
const IMG = { cx: 273 / 742, cy: 270 / 742, r: 228 / 742 }

/** Barrel map: pixels near the rim are taken from nearer the middle, so letters swell towards the edge. */
function barrelMap(size: number): string {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const h = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - h) / h
      const dy = (y + 0.5 - h) / h
      const r = Math.hypot(dx, dy)
      const k = r < 1 ? -0.5 * r * r : 0
      const o = (y * size + x) * 4
      img.data[o] = Math.round(128 + 127 * dx * k)
      img.data[o + 1] = Math.round(128 + 127 * dy * k)
      img.data[o + 2] = 128
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}

const smooth = (u: number) => u * u * (3 - 2 * u)

export function LensText({ text }: { text: string }) {
  const id = `lens${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const wrap = useRef<HTMLDivElement>(null)
  const line = useRef<HTMLSpanElement>(null)
  const glass = useRef<HTMLDivElement>(null)
  const zoom = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLImageElement>(null)
  const shadow = useRef<HTMLSpanElement>(null)
  const [map, setMap] = useState<string | null>(null)

  useEffect(() => {
    if (!document.documentElement.classList.contains('lite')) setMap(barrelMap(R * 2))
  }, [])

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    let lastX = -1
    let tilt = 0
    const tick = (now: number) => {
      const w = wrap.current
      const l = line.current
      if (!w || !l || !glass.current || !zoom.current || !frame.current || !shadow.current) return
      const t = (now - t0) / 1000
      const box = w.getBoundingClientRect()
      const lb = l.getBoundingClientRect()
      // there and back along the line, slowing at each end like a hand reading
      const u = (t % PERIOD) / PERIOD
      const v = u < 0.5 ? smooth(u * 2) : 1 - smooth((u - 0.5) * 2)
      const left = lb.left - box.left + R * 0.6
      const right = lb.right - box.left - R * 0.6
      const x = left + v * Math.max(0, right - left)
      // the middle of the letters themselves (handwriting sits low in its line)
      const y = lb.top - box.top + lb.height * 0.72 + Math.sin(t * 1.9) * 1.5
      const vx = lastX < 0 ? 0 : x - lastX
      lastX = x
      tilt += (Math.max(-14, Math.min(14, vx * 4)) - tilt) * 0.12 // eased, so the hand never jerks
      glass.current.style.transform = `translate(${x - R}px, ${y - R}px)`
      zoom.current.style.width = `${box.width}px`
      zoom.current.style.transformOrigin = `${x}px ${y}px`
      zoom.current.style.transform = `translate(${R - x}px, ${R - y}px) scale(${ZOOM})`
      frame.current.style.transform = `rotate(${tilt}deg)`
      shadow.current.style.transform = `translate(${x - R + 7}px, ${y - R + 12}px) rotate(${tilt}deg)`
      // the words under the glass are hidden: only the magnified ones show there
      l.style.setProperty('--lx', `${x - (lb.left - box.left)}px`)
      l.style.setProperty('--ly', `${y - (lb.top - box.top)}px`)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const size = (R / IMG.r) // rendered image width in px
  return (
    <div ref={wrap} className="lens-text" style={{ ['--r' as string]: `${R}px` }}>
      <span ref={line} className="lens-line">{text}</span>
      <span ref={shadow} className="lens-shadow" aria-hidden="true" />
      <div ref={glass} className="lens-glass" aria-hidden="true">
        {/* clipped to the round glass outside the bending, so nothing spills past the rim */}
        <div className="lens-clip">
          <div className="lens-view" style={map ? { filter: `url(#${id})` } : undefined}>
            <div ref={zoom} className="lens-zoom">
              <span className="lens-line lens-copy">{text}</span>
            </div>
          </div>
        </div>
        <img ref={frame} className="lens-frame" src="/assets/3d/magnifier.webp" alt=""
          style={{ width: size, left: R - IMG.cx * size, top: R - IMG.cy * size, transformOrigin: `${IMG.cx * size}px ${IMG.cy * size}px` }} />
      </div>
      {map ? (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <filter id={id} x="0" y="0" width={R * 2} height={R * 2} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map} x="0" y="0" width={R * 2} height={R * 2} result="m" preserveAspectRatio="none" />
            <feDisplacementMap in="SourceGraphic" in2="m" scale={R * 0.9} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      ) : null}
    </div>
  )
}

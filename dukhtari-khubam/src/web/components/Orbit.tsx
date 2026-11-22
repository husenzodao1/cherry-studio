'use client'

import { useEffect, useRef } from 'react'

/**
 * Objects circling a centre like real bodies in space: a tilted elliptical path seen in perspective,
 * so each one grows and comes forward as it passes in front, shrinks, dims and slips behind the centre
 * as it goes round the back; each also bobs and turns a little on its own. The centre (children) sits
 * between the back and the front half of the path.
 */
export function Orbit({ items, children, period = 7.5 }: { items: string[]; children: React.ReactNode; period?: number }) {
  const refs = useRef<(HTMLImageElement | null)[]>([])
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = (now - t0) / 1000
      const n = items.length
      const k = (stage.current?.clientWidth ?? 340) / 100 // px per % of the stage
      refs.current.forEach((el, i) => {
        if (!el) return
        const a = (t / period) * Math.PI * 2 + (i / n) * Math.PI * 2
        const depth = Math.sin(a) // -1 far, +1 near
        const x = Math.cos(a) * 47 // % of the stage
        const y = depth * 17 - 3 + Math.sin(t * 1.7 + i) * 2.2 // tilted path and a soft bob
        const s = 0.68 + (depth + 1) * 0.22
        el.style.transform = `translate(-50%, -50%) translate(${x * k}px, ${y * k}px) scale(${s}) rotate(${Math.sin(t * 0.9 + i * 1.3) * 8}deg)`
        el.style.zIndex = depth > 0 ? '3' : '1'
        el.style.opacity = String(0.55 + (depth + 1) * 0.225)
        el.style.filter = `drop-shadow(0 ${6 + depth * 6}px ${8 + depth * 4}px rgba(86,56,160,${0.18 + depth * 0.08}))${depth < -0.4 ? ` blur(${((-depth - 0.4) * 2).toFixed(2)}px)` : ''}`
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [items, period])
  return (
    <div ref={stage} className="orbit-stage">
      {items.map((src, i) => <img key={src + i} ref={(el) => { refs.current[i] = el }} className="orbit-body" src={src} alt="" aria-hidden="true" style={{ animationDelay: `${i * 0.07}s` }} />)}
      <div className="orbit-centre">{children}</div>
    </div>
  )
}

'use client'

import { useEffect, useRef, type RefObject } from 'react'

/** Where on the flower picture the drop hangs: the tip of the lower left petal (fractions of the image). */
const TIP = { x: 0.2, y: 0.74 }
const GROW_MS = 1700
const GRAVITY = 2300 // px/s²

const ease = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * A drop of rain on the home screen's glass flower. It gathers at the tip of a petal — a clear bead with
 * a bright highlight, a softer one at the bottom and a dark rim, bending what is behind it — swells until
 * it is heavy, stretches and lets go; the petal springs up and down once as the weight leaves it, and the
 * drop falls with real gravity, stretching with its speed. The drop passes behind the glass boxes, so
 * their frosted glass shows it broken and blurred. One every 9–15 seconds while the screen is shown.
 */
export function RainDrop({ flower }: { flower: RefObject<HTMLImageElement | null> }) {
  const drop = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let timer: ReturnType<typeof setTimeout>
    let alive = true

    const run = () => {
      const img = flower.current
      const el = drop.current
      const layer = el?.offsetParent as HTMLElement | null
      if (!alive || !img || !el || !layer || document.hidden || document.documentElement.classList.contains('locked')) return schedule()
      const box = img.getBoundingClientRect()
      const base = layer.getBoundingClientRect()
      if (!box.width) return schedule()
      const x0 = box.left - base.left + box.width * TIP.x
      const y0 = box.top - base.top + box.height * TIP.y
      const fallTo = window.innerHeight - base.top + 40
      const start = performance.now()
      let released = 0
      let v = 0
      let y = 0
      let last = start
      el.style.opacity = '1'

      const frame = (now: number) => {
        if (!alive) return
        const t = now - start
        let sx = 1
        let sy = 1
        let s = 1
        if (t < GROW_MS) {
          // gathering: it swells and begins to sag
          const k = ease(t / GROW_MS)
          s = 0.15 + 0.85 * k
          sy = 1 + 0.12 * k
          sx = 1 - 0.04 * k
          y = 3 * k
        } else if (t < GROW_MS + 260) {
          // heavy: a stretched neck, then it lets go
          const k = (t - GROW_MS) / 260
          sy = 1.12 + 0.3 * Math.sin(k * Math.PI * 0.9)
          sx = 0.96 - 0.1 * Math.sin(k * Math.PI * 0.9)
          y = 3 + 6 * k
        } else {
          if (!released) {
            released = now
            last = now
            img.classList.remove('petal-spring')
            void img.offsetWidth
            img.classList.add('petal-spring')
          }
          const dt = Math.min(0.05, (now - last) / 1000)
          last = now
          v += GRAVITY * dt
          y += v * dt
          // falling: long along the way it goes, thinner across
          sy = 1 + Math.min(v / 1400, 0.65)
          sx = 1 / Math.sqrt(sy)
        }
        el.style.transform = `translate(${x0}px, ${y0 + y}px) translate(-50%, -30%) scale(${s * sx}, ${s * sy})`
        if (y0 + y < fallTo) raf = requestAnimationFrame(frame)
        else {
          el.style.opacity = '0'
          schedule()
        }
      }
      raf = requestAnimationFrame(frame)
    }
    const schedule = (ms = 9000 + Math.random() * 6000) => {
      clearTimeout(timer)
      if (alive) timer = setTimeout(run, ms)
    }
    schedule(3200)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [flower])

  return (
    <span className="rain-layer" aria-hidden="true">
      <span ref={drop} className="rain-drop" />
    </span>
  )
}

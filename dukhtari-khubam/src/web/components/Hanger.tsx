'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A block hung on the wall by a ribbon bow and two cords: shaking or tilting the phone sets it swinging
 * like a pendulum, as far as the shake was strong, and it settles by itself. A flick of the finger
 * on it swings it too. The loop sleeps while it hangs still.
 */
const GRAVITY = 9.81
const LENGTH = 0.55 // metres: how slow the swing is
const DAMPING = 1.35 // per second
const PUSH = 0.075 // how much the phone's sideways acceleration moves it
const MAX = 0.34 // radians (about 20°)

export function Hanger({ children, className = '' }: { children: ReactNode; className?: string }) {
  const swing = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = swing.current
    if (!el) return
    let angle = 0
    let speed = 0
    let ax = 0
    let raf = 0
    let last = 0
    const step = (now: number) => {
      const dt = Math.min(0.033, (now - (last || now)) / 1000 || 0.016)
      last = now
      const accel = -(GRAVITY / LENGTH) * Math.sin(angle) - DAMPING * speed - (PUSH * ax) / LENGTH
      speed += accel * dt
      angle = Math.max(-MAX, Math.min(MAX, angle + speed * dt))
      ax *= 0.6
      el.style.transform = `rotate(${angle.toFixed(4)}rad)`
      if (Math.abs(angle) < 0.0008 && Math.abs(speed) < 0.002 && Math.abs(ax) < 0.05) {
        el.style.transform = ''
        raf = 0
        last = 0
        return
      }
      raf = requestAnimationFrame(step)
    }
    const wake = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(step)
    }
    // the sideways acceleration of the phone (without gravity), smoothed a little
    const onMotion = (e: DeviceMotionEvent) => {
      const x = e.acceleration?.x ?? null
      if (x === null || Math.abs(x) < 0.35) return
      ax = ax * 0.4 + x * 0.6
      wake()
    }
    // a flick of the finger on the block
    let start: { x: number; t: number } | null = null
    const down = (e: PointerEvent) => { start = { x: e.clientX, t: performance.now() } }
    const up = (e: PointerEvent) => {
      if (!start) return
      const dx = e.clientX - start.x
      const dt = Math.max(60, performance.now() - start.t)
      start = null
      if (Math.abs(dx) < 12) return
      speed += Math.max(-1.6, Math.min(1.6, (dx / dt) * 1.2))
      wake()
    }
    window.addEventListener('devicemotion', onMotion)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    // a small swing when the screen opens, as if it had just been hung
    const hello = setTimeout(() => { speed = 0.42; wake() }, 900)
    return () => {
      clearTimeout(hello)
      cancelAnimationFrame(raf)
      window.removeEventListener('devicemotion', onMotion)
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
    }
  }, [])
  return (
    <div className={`hanger ${className}`}>
      <div ref={swing} className="hanger-swing">
        <svg className="hanger-cords" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d="M50 2 L20 40 M50 2 L80 40" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="hanger-ring is-left" aria-hidden="true" />
        <span className="hanger-ring is-right" aria-hidden="true" />
        {children}
      </div>
      <Bow />
    </div>
  )
}

/** A ribbon bow in the theme's colours: two loops, two tails and the knot. */
function Bow() {
  return (
    <svg className="hanger-bow" viewBox="0 0 64 44" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bow-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--bow-a, #ffb3c8)" />
          <stop offset="1" stopColor="var(--bow-b, #c75a9b)" />
        </linearGradient>
        <linearGradient id="bow-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* tails */}
      <path d="M29 22 C25 30 21 36 15 42 L21 41 L23 44 C27 37 30 30 31.5 24 Z" fill="url(#bow-a)" opacity="0.92" />
      <path d="M35 22 C39 30 43 36 49 42 L43 41 L41 44 C37 37 34 30 32.5 24 Z" fill="url(#bow-a)" opacity="0.92" />
      {/* loops */}
      <path d="M30 19 C22 6 6 4 4 13 C2 22 16 27 30 22 Z" fill="url(#bow-a)" />
      <path d="M34 19 C42 6 58 4 60 13 C62 22 48 27 34 22 Z" fill="url(#bow-a)" />
      <path d="M28 18.5 C21 10 10 8.5 8.5 13.5 C14 11 21 13 28 18.5 Z" fill="#000" opacity="0.12" />
      <path d="M36 18.5 C43 10 54 8.5 55.5 13.5 C50 11 43 13 36 18.5 Z" fill="#000" opacity="0.12" />
      <path d="M30 19 C22 6 6 4 4 13 C2 22 16 27 30 22 Z M34 19 C42 6 58 4 60 13 C62 22 48 27 34 22 Z" fill="url(#bow-shine)" />
      {/* knot */}
      <rect x="27.5" y="15" width="9" height="10" rx="3.6" fill="url(#bow-a)" />
      <rect x="28.6" y="15.8" width="6.8" height="3.4" rx="1.7" fill="#fff" opacity="0.45" />
    </svg>
  )
}

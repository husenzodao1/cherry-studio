'use client'

import { useEffect } from 'react'

/**
 * Watches how smoothly the first seconds draw. A phone that keeps missing frames (median frame over
 * 24 ms, under ~40 fps) is switched to light mode (<html class="lite">: no live blur,
 * the panes turn nearly opaque) and remembers it (dk.lite=1), so the next start is light from the first paint.
 */
const FRAMES = 90
const SLOW_MS = 24

export function PerfProbe() {
  useEffect(() => {
    const root = document.documentElement
    if (root.classList.contains('lite')) return
    let raf = 0
    let last = 0
    const times: number[] = []
    const tick = (now: number) => {
      if (document.hidden) { last = 0; raf = requestAnimationFrame(tick); return }
      if (last) times.push(now - last)
      last = now
      if (times.length < FRAMES) { raf = requestAnimationFrame(tick); return }
      const median = [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)]
      if (median > SLOW_MS) {
        root.classList.add('lite')
        try { localStorage.setItem('dk.lite', '1') } catch { /* storage blocked: light for this session */ }
      }
    }
    // after the opening screen and the entrance, when the home screen is what is drawn
    const start = setTimeout(() => { raf = requestAnimationFrame(tick) }, 3500)
    return () => { clearTimeout(start); cancelAnimationFrame(raf) }
  }, [])
  return null
}

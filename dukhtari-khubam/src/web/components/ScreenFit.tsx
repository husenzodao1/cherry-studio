'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const PULL = 0.28
const MAX = 64

/**
 * A screen whose content fits the phone does not scroll at all: the page stays put, and a vertical drag
 * only stretches it a little, like rubber, and lets it spring back. Longer screens scroll as usual. The
 * check is made on every page and whenever the content or the window changes size (the keyboard).
 */
export function ScreenFit() {
  const path = usePathname()
  useEffect(() => {
    const root = document.documentElement
    const app = document.querySelector<HTMLElement>('main.app')
    if (!app) return
    const measure = () => {
      const fits = root.classList.contains('still') || app.scrollHeight <= window.innerHeight + 2
      root.classList.toggle('fits', fits)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(app)
    window.addEventListener('resize', measure)

    let y0 = 0
    let x0 = 0
    let pulling = false
    const scrollableAbove = (el: EventTarget | null) => {
      for (let n = el as HTMLElement | null; n && n !== app; n = n.parentElement) {
        if (n.matches('input, textarea, select, [contenteditable="true"]')) return true
        const s = getComputedStyle(n)
        if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return true
      }
      return false
    }
    const start = (e: TouchEvent) => {
      pulling = root.classList.contains('fits') && !root.classList.contains('locked') && !scrollableAbove(e.target)
      y0 = e.touches[0].clientY
      x0 = e.touches[0].clientX
      app.style.transition = 'none'
    }
    const move = (e: TouchEvent) => {
      if (!pulling) return
      const dy = e.touches[0].clientY - y0
      const dx = e.touches[0].clientX - x0
      if (Math.abs(dx) > Math.abs(dy)) return
      const d = Math.sign(dy) * Math.min(MAX, Math.abs(dy) * PULL)
      app.style.transform = `translateY(${d}px)`
    }
    const end = () => {
      if (!pulling) return
      pulling = false
      app.style.transition = 'transform 0.45s cubic-bezier(0.2, 1.4, 0.4, 1)'
      app.style.transform = ''
    }
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchmove', move, { passive: true })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
      app.style.transform = ''
      app.style.transition = ''
    }
  }, [path])
  return null
}

'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/** Rubber: share of the finger's travel the page follows, and how far it can go. */
const PULL = 0.28
const MAX = 64
/** Screens where a pull downwards is rubber too (elsewhere it opens the signature space, PullSignature). */
export const STILL_PATHS = /^\/(start|welcome)(\/|$)/

/**
 * A screen whose content fits the phone never scrolls (<html class="fits">): it always shows its
 * standard view, from its top. A drag only stretches it a little, like rubber, and it springs back.
 * Longer screens scroll as usual. The check is made on every page and whenever the content or the
 * window changes size (the keyboard).
 */
export function ScreenFit() {
  const path = usePathname()
  useEffect(() => {
    const root = document.documentElement
    let app: HTMLElement | null = null
    const measure = () => {
      if (!app) return
      const fits = root.classList.contains('still') || app.scrollHeight <= window.innerHeight + 2
      root.classList.toggle('fits', fits)
    }
    // the page is at least as tall as the phone, so its own size may not change when its content
    // shrinks: the content is watched too
    const ro = new ResizeObserver(measure)
    const attach = () => {
      const found = document.querySelector<HTMLElement>('main.app')
      if (found === app) return
      app?.removeEventListener('animationend', measure)
      ro.disconnect()
      app = found
      if (!app) return
      ro.observe(app)
      for (const child of app.children) ro.observe(child)
      // entrance animations move things for a moment (and so the page's height): checked again after
      app.addEventListener('animationend', measure)
      measure()
    }
    attach()
    // the page may appear only after this (behind the sign-in check) or be replaced
    const mo = new MutationObserver(attach)
    mo.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', measure)

    let y0 = 0
    let x0 = 0
    let pulling = false
    let moved = false
    const scrollableAbove = (el: EventTarget | null) => {
      for (let n = el as HTMLElement | null; n && n !== app; n = n.parentElement) {
        if (n.matches('input, textarea, select, [contenteditable="true"]')) return true
        const cs = getComputedStyle(n)
        if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return true
      }
      return false
    }
    const start = (e: TouchEvent) => {
      // Mahliyo's full screen stretches its own conversation (app/mahliyo/page.tsx)
      const own = (e.target as HTMLElement | null)?.closest?.('.ai-scene, .ai-history, .attach-veil, .pmark, .docv, [role="dialog"]')
      pulling = !!app && !own && root.classList.contains('fits') && !root.classList.contains('locked') && !scrollableAbove(e.target)
      y0 = e.touches[0].clientY
      x0 = e.touches[0].clientX
      moved = false
    }
    const move = (e: TouchEvent) => {
      if (!pulling || !app) return
      const dy = e.touches[0].clientY - y0
      const dx = e.touches[0].clientX - x0
      if (Math.abs(dx) > Math.abs(dy)) return
      // a pull downwards opens the signature space on the app's own screens (PullSignature)
      if (dy > 0 && !STILL_PATHS.test(location.pathname)) return
      const d = Math.sign(dy) * MAX * (1 - Math.exp((-Math.abs(dy) * PULL) / MAX))
      moved = true
      app.style.transition = 'none'
      app.style.transform = `translateY(${d}px)`
    }
    const end = () => {
      if (!pulling) return
      pulling = false
      if (!moved || !app) return
      app.style.transition = 'transform 0.5s cubic-bezier(0.2, 1.3, 0.4, 1)'
      app.style.transform = ''
    }
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchmove', move, { passive: true })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    return () => {
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
      if (app) { app.style.transform = ''; app.style.transition = '' }
      mo.disconnect()
      ro.disconnect()
      app?.removeEventListener('animationend', measure)
      window.removeEventListener('resize', measure)
    }
  }, [path])
  return null
}

'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * A screen whose content fits the phone does not move at all: no scrolling and no rubber bounce up or
 * down (<html class="fits">). Longer screens scroll as usual. The check is made on every page and
 * whenever the content or the window changes size (the keyboard).
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
    return () => {
      mo.disconnect()
      ro.disconnect()
      app?.removeEventListener('animationend', measure)
      window.removeEventListener('resize', measure)
    }
  }, [path])
  return null
}

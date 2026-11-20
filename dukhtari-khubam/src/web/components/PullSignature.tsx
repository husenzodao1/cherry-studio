'use client'

import { useEffect, useRef } from 'react'

/**
 * Pulling any screen down at its top opens a small space above it; the page's edge below it becomes a
 * row of soft scallops in the page's own colour. In that space the studio's
 * signature "Gratorslab" writes itself in a fine hand, sliding in from the top left, as far as the
 * finger has pulled. Let go after a full pull and the scene plays out: the word gathers into its
 * middle and is gone, five little hearts in the app's colours fly out of that point, all of them come
 * forward at once, and the space closes. A short pull just springs back.
 * Transforms and opacity only (cheap enough for light mode too).
 */
const MAX = 120 // px of open space at most
// Real touch physics: the first stretch of finger travel does nothing (a casual swipe never opens it),
// then the space opens like rubber — easily at first, harder and harder towards MAX — and the scene
// plays only after a long, deliberate pull that is held for a moment.
const DEAD = 46 // px of finger travel that is ignored
const STRETCH = 210 // px of finger travel for the space to reach ~63 % of MAX
const FULL = 0.9 // share of MAX that counts as a full pull
const HOLD_MS = 160 // a full pull must last this long (a fast flick does not count)
const HEARTS = [
  { c1: '#ffb3c7', c2: '#f2577f', x: -86, y: -10, r: -22 },
  { c1: '#ffd2b3', c2: '#f3895c', x: -44, y: -34, r: -10 },
  { c1: '#e6d4ff', c2: '#9a6bf0', x: 0, y: -44, r: 0 },
  { c1: '#ffe7a8', c2: '#f0a92a', x: 44, y: -34, r: 10 },
  { c1: '#ffc9e4', c2: '#d955a8', x: 86, y: -10, r: 22 }
]

export function PullSignature() {
  const layer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = document.documentElement
    const box = layer.current
    if (!box) return
    // the page (it may appear after this layer, once the learner is read): looked up on each touch
    let app = document.querySelector<HTMLElement>('main.app') ?? document.body
    const word = box.querySelector<HTMLElement>('.ps-word')!
    const ink = box.querySelector<HTMLElement>('.ps-ink')!
    const hearts = [...box.querySelectorAll<HTMLElement>('.ps-heart')]
    let y0 = 0
    let x0 = 0
    let d = 0
    let pulling = false
    let playing = false
    let fullSince = 0

    const blocked = (el: EventTarget | null) => {
      for (let n = el as HTMLElement | null; n && n !== app; n = n.parentElement) {
        if (n.matches('input, textarea, select, [contenteditable="true"], .school-row, .scroller')) return true
        const s = getComputedStyle(n)
        if (/(auto|scroll)/.test(s.overflowY) && n.scrollTop > 0) return true
      }
      return false
    }
    const draw = () => {
      const p = Math.min(1, d / MAX)
      app.style.transform = d ? `translateY(${d}px)` : ''
      box.style.height = `${d}px`
      box.style.opacity = d ? '1' : '0'
      // the hand writes from the left, the word glides in from the top left
      ink.style.clipPath = `inset(-20% ${Math.max(0, 100 - p * 112)}% -20% 0)`
      word.style.transform = `translate(${(1 - p) * -36}px, ${(1 - p) * -22}px) rotate(${-8 + p * 4}deg)`
    }
    const reset = () => {
      d = 0
      word.getAnimations().forEach((a) => a.cancel())
      hearts.forEach((h) => { h.getAnimations().forEach((a) => a.cancel()); h.style.opacity = '0' })
      word.style.opacity = ''
      ink.style.clipPath = 'inset(-20% 100% -20% 0)'
      box.style.height = '0px'
      box.style.opacity = '0'
    }
    const close = (ms = 450) => {
      app.style.transition = `transform ${ms}ms cubic-bezier(0.2, 1.3, 0.4, 1)`
      app.style.transform = ''
      box.style.transition = `height ${ms}ms cubic-bezier(0.2, 1.3, 0.4, 1)`
      box.style.height = '0px'
      setTimeout(() => {
        app.style.transition = ''
        box.style.transition = ''
        reset()
        playing = false
      }, ms + 30)
    }
    // the scene after a full pull
    const play = async () => {
      playing = true
      const ease = 'cubic-bezier(0.5, 0, 0.2, 1)'
      // 1. the word gathers into its middle and is gone
      await word.animate([
        { transform: word.style.transform, opacity: 1, letterSpacing: '0px' },
        { transform: 'translate(0, 0) rotate(-4deg) scale(0.08, 0.5)', opacity: 0, letterSpacing: '-6px' }
      ], { duration: 420, easing: ease, fill: 'forwards' }).finished
      // 2. five hearts fly out of that point
      await Promise.all(hearts.map((h, i) => h.animate([
        { transform: 'translate(-50%, -50%) scale(0.1) rotate(0deg)', opacity: 0 },
        { offset: 0.45, opacity: 1 },
        { transform: `translate(calc(-50% + ${HEARTS[i].x}px), calc(-50% + ${HEARTS[i].y}px)) scale(1) rotate(${HEARTS[i].r}deg)`, opacity: 1 }
      ], { duration: 520, delay: i * 45, easing: 'cubic-bezier(0.25, 1.4, 0.4, 1)', fill: 'forwards' }).finished))
      // 3. all come forward at once while the space closes
      hearts.forEach((h, i) => h.animate([
        { transform: `translate(calc(-50% + ${HEARTS[i].x}px), calc(-50% + ${HEARTS[i].y}px)) scale(1) rotate(${HEARTS[i].r}deg)`, opacity: 1 },
        { transform: `translate(calc(-50% + ${HEARTS[i].x * 1.6}px), calc(-50% + ${HEARTS[i].y * 1.6 + 30}px)) scale(3.2) rotate(${HEARTS[i].r}deg)`, opacity: 0 }
      ], { duration: 460, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }))
      try { navigator.vibrate?.(10) } catch { /* no motor */ }
      close(480)
    }

    const start = (e: TouchEvent) => {
      if (!playing) app = document.querySelector<HTMLElement>('main.app') ?? app
      pulling = !playing && window.scrollY <= 0 && !root.classList.contains('locked') && !document.querySelector('.pin-screen, .sheet-scrim, .crop')
        && !blocked(e.target)
      y0 = e.touches[0].clientY
      x0 = e.touches[0].clientX
      d = 0
      fullSince = 0
    }
    const move = (e: TouchEvent) => {
      if (!pulling) return
      const dy = e.touches[0].clientY - y0
      const dx = e.touches[0].clientX - x0
      if (d === 0 && (dy <= 0 || Math.abs(dx) > Math.abs(dy))) return
      // rubber band: nothing within DEAD, then MAX·(1 − e^(−x/STRETCH))
      const x = Math.max(0, dy - DEAD)
      d = MAX * (1 - Math.exp(-x / STRETCH))
      if (d >= MAX * FULL) fullSince ||= performance.now()
      else fullSince = 0
      app.style.transition = 'none'
      draw()
    }
    const end = () => {
      if (!pulling) return
      pulling = false
      if (!d) return
      const held = fullSince && performance.now() - fullSince >= HOLD_MS
      fullSince = 0
      if (d >= MAX * FULL && held) play()
      else close()
    }
    reset()
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchmove', move, { passive: true })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    return () => {
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
    }
  }, [])

  return (
    <div ref={layer} className="pull-sign" aria-hidden="true">
      <div className="ps-word"><span className="ps-ink">Gratorslab</span></div>
      {HEARTS.map((h, i) => (
        <svg key={i} className="ps-heart" viewBox="0 0 32 30" style={{ ['--i' as string]: i }}>
          <defs>
            <linearGradient id={`ps-h${i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={h.c1} /><stop offset="1" stopColor={h.c2} /></linearGradient>
          </defs>
          <path d="M16 28C7 21.5 2 16.6 2 10.4 2 6 5.4 2.6 9.6 2.6c2.7 0 5 1.4 6.4 3.6 1.4-2.2 3.7-3.6 6.4-3.6C26.6 2.6 30 6 30 10.4 30 16.6 25 21.5 16 28z" fill={`url(#ps-h${i})`} />
          <ellipse cx="10" cy="9" rx="3.4" ry="2.2" fill="#fff" opacity="0.55" transform="rotate(-30 10 9)" />
        </svg>
      ))}
    </div>
  )
}

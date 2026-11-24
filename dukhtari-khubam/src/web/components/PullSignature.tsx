'use client'

import { useEffect, useRef } from 'react'

import { STILL_PATHS } from './ScreenFit'

/** screens where a pull down is the screen's own (the map is moved by it; the voice screen is spoken to) */
const NO_PULL = /^\/(navigate|voice)(\/|$)/

/**
 * Pulling a screen of the app down at its top opens a small space above it; the page's edge below it becomes a
 * row of soft scallops in the page's own colour. In that space the studio's
 * signature "Gratorslab" writes itself in a fine hand, sliding in from the top left, as far as the
 * finger has pulled. Let go after a full pull and the scene plays out: the word gathers into its
 * middle and is gone, five little hearts in the app's colours fly out of that point, all of them come
 * forward at once, and the space closes. A short pull just springs back.
 * Transforms and opacity only (cheap enough for light mode too). Not on the sign-in and welcome screens:
 * there a pull downwards is plain rubber (ScreenFit).
 */
const MAX = 88 // px of open space at most: just the room the word and the hearts need
// Real touch physics: the first stretch of finger travel does nothing (a casual swipe never opens it),
// then the space opens like rubber — easily at first, harder and harder towards MAX — and the scene
// plays only after a long, deliberate pull that is held for a moment.
const DEAD = 46 // px of finger travel that is ignored
const STRETCH = 170 // px of finger travel for the space to reach ~63 % of MAX
const FULL = 0.9 // share of MAX that counts as a full pull
const HOLD_MS = 160 // a full pull must last this long (a fast flick does not count)
// five hearts side by side in one row, where the word was
const HEARTS = [
  { c1: '#ffb3c7', c2: '#f2577f', x: -84, y: 0, r: 0 },
  { c1: '#ffd2b3', c2: '#f3895c', x: -42, y: 0, r: 0 },
  { c1: '#e6d4ff', c2: '#9a6bf0', x: 0, y: 0, r: 0 },
  { c1: '#ffe7a8', c2: '#f0a92a', x: 42, y: 0, r: 0 },
  { c1: '#ffc9e4', c2: '#d955a8', x: 84, y: 0, r: 0 }
]
// returning to place: a soft ease-out with no overshoot, so the page settles without a pause
const SETTLE = 'cubic-bezier(0.22, 1, 0.36, 1)'

export function PullSignature() {
  const layer = useRef<HTMLDivElement>(null)
  const flight = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = document.documentElement
    const box = layer.current
    if (!box) return
    // the page (it may appear after this layer, once the learner is read): looked up on each touch
    let app = document.querySelector<HTMLElement>('main.app') ?? document.body
    const word = box.querySelector<HTMLElement>('.ps-word')!
    const ink = box.querySelector<HTMLElement>('.ps-ink')!
    // the hearts live in their own layer above the page: the space's scalloped mask never cuts them,
    // so they can come forward over the page while the space closes behind them
    const sky = flight.current!
    const hearts = [...sky.querySelectorAll<HTMLElement>('.ps-heart')]
    let y0 = 0
    let x0 = 0
    let d = 0
    let pulling = false
    let playing = false
    // the status bar's height: the space opens below it, so the page's edge and the scallops meet
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)
    const inset = () => probe.getBoundingClientRect().height
    let fullSince = 0

    const blocked = (el: EventTarget | null) => {
      // never in Mahliyo's chat (its own pull makes a new chat) or over a sheet or a dialog: a pull there
      // drags the sheet, chooses photos or scrolls — the signature must not take it
      if (location.pathname.replace(/\/$/, '').endsWith('/mahliyo')) return true
      if ((el as HTMLElement | null)?.closest?.('[role="dialog"], .attach-veil, .pmark, .docv, .open-choice')) return true
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
      // the space ends exactly where the page's top edge now is
      box.style.height = d ? `${d + inset()}px` : '0px'
      box.style.opacity = d ? '1' : '0'
      // the hand writes from the left, the word glides in from the top left
      ink.style.clipPath = `inset(-20% ${Math.max(0, 100 - p * 112)}% -20% 0)`
      // straight, gliding in from the left
      word.style.transform = `translateX(${(1 - p) * -40}px)`
    }
    const resetHearts = () => hearts.forEach((h) => { h.getAnimations().forEach((a) => a.cancel()); h.style.opacity = '0' })
    const reset = () => {
      d = 0
      word.getAnimations().forEach((a) => a.cancel())
      if (!playing) resetHearts()
      word.style.opacity = ''
      ink.style.clipPath = 'inset(-20% 100% -20% 0)'
      box.style.height = '0px'
      box.style.opacity = '0'
    }
    let closing: ReturnType<typeof setTimeout> | undefined
    const close = () => {
      // the further it was open, the longer the way back (but never slow)
      const ms = Math.round(260 + (d / MAX) * 160)
      app.style.transition = `transform ${ms}ms ${SETTLE}`
      app.style.transform = ''
      box.style.transition = `height ${ms}ms ${SETTLE}, opacity ${ms}ms ease-out`
      box.style.height = '0px'
      box.style.opacity = '0'
      clearTimeout(closing)
      closing = setTimeout(() => {
        app.style.transition = ''
        box.style.transition = ''
        reset()
        playing = false
      }, ms)
    }
    // the scene after a full pull: the word gathers and is gone, hearts appear in a row one after
    // another, then all of them come forward together — growing towards her over the page — while the
    // space closes behind them. Whatever happens, it closes.
    const play = async () => {
      playing = true
      // the hearts' row sits where the word was: the middle of the stage at the space's lower edge
      sky.style.top = `${Math.round(inset() + d - 44 - 4)}px`
      const at = (i: number) => `translate(calc(-50% + ${HEARTS[i].x}px), -50%)`
      try {
        await word.animate([
          { transform: word.style.transform || 'none', opacity: 1, letterSpacing: '0px' },
          { transform: 'scale(0.06, 0.6)', opacity: 0, letterSpacing: '-6px' }
        ], { duration: 380, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'forwards' }).finished
        await Promise.all(hearts.map((h, i) => h.animate([
          { transform: `${at(i)} scale(0.2)`, opacity: 0 },
          { transform: `${at(i)} scale(1.15)`, opacity: 1, offset: 0.6 },
          { transform: `${at(i)} scale(1)`, opacity: 1 }
        ], { duration: 340, delay: i * 70, easing: 'ease-out', fill: 'forwards' }).finished))
        await new Promise((r) => setTimeout(r, 160))
        try { navigator.vibrate?.(10) } catch { /* no motor */ }
        // forward: each heart grows towards her, drifting a little apart and down over the page,
        // staying bright most of the way and fading only at the very end
        const forward = Promise.all(hearts.map((h, i) => h.animate([
          { transform: `${at(i)} scale(1)`, opacity: 1 },
          { transform: `translate(calc(-50% + ${HEARTS[i].x * 1.35}px), calc(-50% + 26px)) scale(2.1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${HEARTS[i].x * 1.9}px), calc(-50% + 70px)) scale(3.4)`, opacity: 0 }
        ], { duration: 760, delay: Math.abs(i - 2) * 30, easing: 'cubic-bezier(0.3, 0, 0.6, 1)', fill: 'forwards' }).finished))
        close()
        await forward
      } catch {
        /* an animation was interrupted: just close */
        close()
      }
      resetHearts()
    }
    const start = (e: TouchEvent) => {
      if (!playing) app = document.querySelector<HTMLElement>('main.app') ?? app
      pulling = !playing && window.scrollY <= 0 && !STILL_PATHS.test(location.pathname) && !NO_PULL.test(location.pathname) && !root.classList.contains('locked') && !document.querySelector('.pin-screen, .sheet-scrim, .crop')
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
      probe.remove()
    }
  }, [])

  return (
    <>
    <div ref={layer} className="pull-sign" aria-hidden="true">
      {/* the stage sits on the page's edge, below the status bar: word and hearts are never under it */}
      <div className="ps-stage">
      <div className="ps-word"><span className="ps-ink">Gratorslab</span></div>
      </div>
    </div>
    {/* the hearts fly in front of everything, unclipped */}
    <div ref={flight} className="ps-hearts" aria-hidden="true">
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
    </>
  )
}

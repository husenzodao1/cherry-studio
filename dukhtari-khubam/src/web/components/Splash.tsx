'use client'

import { useEffect } from 'react'

import { playIntro } from '../intro'
import { useContent } from '../offline/content'
import { useLearner } from '../offline/learner'
import { hasPin } from '../offline/pin'

const MIN_MS = 1100
const MAX_MS = 6000

/**
 * Takes away the opening screen (drawn in layout.tsx) once the first screen is ready: the catalogue
 * and the learner read from the phone and the fonts loaded — at least a moment, at most six seconds.
 * The bar fills to the end, the screen fades, and the home screen's entrance plays. With a PIN the lock
 * comes first and the opening screen is simply removed.
 */
export function Splash() {
  const { bundle, offlineEmpty } = useContent()
  const { ready: learnerReady } = useLearner()
  const ready = learnerReady && (!!bundle || offlineEmpty)

  useEffect(() => {
    const el = document.getElementById('splash')
    if (!el) return
    // the element belongs to React (layout.tsx): it is hidden, never removed, or React's later
    // updates of <body> fail ("insertBefore … not a child") and the page breaks
    if (hasPin()) {
      el.hidden = true
      return
    }
    let gone = false
    const finish = () => {
      if (gone) return
      gone = true
      el.classList.add('is-done')
      setTimeout(() => {
        el.hidden = true
        playIntro()
      }, 520)
    }
    const max = setTimeout(finish, MAX_MS)
    ;(window as { __dkSplash?: () => void }).__dkSplash = finish
    return () => clearTimeout(max)
  }, [])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    ;(document.fonts?.ready ?? Promise.resolve()).catch(() => undefined).then(() => {
      // performance.now() counts from the page's start: the opening screen stays at least MIN_MS
      setTimeout(() => { if (!cancelled) (window as { __dkSplash?: () => void }).__dkSplash?.() }, Math.max(0, MIN_MS - performance.now()))
    })
    return () => { cancelled = true }
  }, [ready])

  return null
}

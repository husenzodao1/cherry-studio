'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { ART, type Art } from '../art'

/**
 * Fixed page backdrop: a lavender sky with rendered glass pieces resting at the screen edges — a crocus,
 * a water lily, a tulip, a leafy spray, a crystal cluster, loose petals and glass lenses. It never moves
 * with scrolling (sized to the large viewport); the pieces sway softly as if in a breeze, and stand
 * still while the page scrolls, for a moment after moving to another screen, and on the schools screen,
 * so the glass above is not redrawn on every frame. Reading screens keep a
 * calmer set so nothing sits behind running text.
 */
type Piece = [Art, string]

const FULL: Piece[] = [
  [ART.bubble, 'bd-bubble'],
  [ART.leaves, 'bd-leaves'],
  [ART.tulip, 'bd-tulip'],
  [ART.crystals, 'bd-crystals'],
  [ART.petals, 'bd-petals'],
  [ART.lens, 'bd-lens'],
  [ART.lotus, 'bd-lotus'],
  [ART.flowerOpen, 'bd-crocus']
]
const QUIZ: Piece[] = [[ART.bubble, 'bd-bubble'], [ART.crystals, 'bd-crystals'], [ART.petals, 'bd-petals'], [ART.flowerSide, 'bd-side']]
const CALM: Piece[] = [[ART.bubble, 'bd-bubble'], [ART.leaves, 'bd-calm-leaves']]
const START: Piece[] = [[ART.bubble, 'bd-bubble'], [ART.leaves, 'bd-leaves'], [ART.crystals, 'bd-crystals'], [ART.lens, 'bd-lens'], [ART.petals, 'bd-petals']]

export function Backdrop() {
  const path = usePathname() ?? '/'
  // <html class="scrolling"> while the page moves: the swaying stops for that time
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const root = document.documentElement
    const onScroll = () => {
      if (!timer) root.classList.add('scrolling')
      clearTimeout(timer)
      timer = setTimeout(() => { root.classList.remove('scrolling'); timer = undefined }, 180)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(timer)
    }
  }, [])
  // a new screen comes in first, then the breeze: the pieces rest for a moment after every move, and
  // stay still on the schools screen, whose many bending glass tiles would redraw with every sway
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('settling')
    root.classList.toggle('glassy', /^\/schools(\/|$)/.test(path))
    const timer = setTimeout(() => root.classList.remove('settling'), 1500)
    return () => clearTimeout(timer)
  }, [path])
  // documents are plain paper: no glass pieces around them
  if (/^\/page(\/|$)/.test(path)) return <div className="backdrop backdrop-paper" aria-hidden="true" />
  // inside the topics (courses and lessons): a soft white page to read on
  if (/^\/(lesson|course)(\/|$)/.test(path)) return <div className="backdrop backdrop-lesson" aria-hidden="true" />
  const set = /^\/admin(\/|$)/.test(path) ? [] : /^\/(lesson|garden|support)(\/|$)/.test(path) ? CALM : /^\/(quiz|review)(\/|$)/.test(path) ? QUIZ
    : /^\/(start|welcome)(\/|$)/.test(path) ? START : FULL
  return (
    <div className="backdrop" aria-hidden="true">
      {set.map(([art, cls]) => (
        <img key={cls} className={`bd ${cls}`} src={art.src} alt="" decoding="async" />
      ))}
    </div>
  )
}

'use client'

import { usePathname } from 'next/navigation'

import { ART, type Art } from '../art'

/**
 * Fixed page backdrop: a lavender sky with rendered glass pieces resting at the screen edges — a crocus,
 * a water lily, a tulip, a leafy spray, a crystal cluster, loose petals and glass lenses. It never moves
 * with scrolling (sized to the large viewport); cards above it blur and bend it. Reading screens keep a
 * calmer set so nothing sits behind running text.
 */
type Piece = [Art, string, string?]

const FULL: Piece[] = [
  [ART.bubble, 'bd-bubble', 'float'],
  [ART.leaves, 'bd-leaves', 'float-slow'],
  [ART.tulip, 'bd-tulip', 'float'],
  [ART.crystals, 'bd-crystals'],
  [ART.petals, 'bd-petals', 'float-slow'],
  [ART.lens, 'bd-lens', 'float'],
  [ART.lotus, 'bd-lotus'],
  [ART.flowerOpen, 'bd-crocus']
]
const QUIZ: Piece[] = [[ART.bubble, 'bd-bubble', 'float'], [ART.crystals, 'bd-crystals'], [ART.petals, 'bd-petals', 'float-slow'], [ART.flowerSide, 'bd-side']]
const CALM: Piece[] = [[ART.bubble, 'bd-bubble', 'float'], [ART.leaves, 'bd-calm-leaves']]
const START: Piece[] = [[ART.bubble, 'bd-bubble', 'float'], [ART.leaves, 'bd-leaves', 'float-slow'], [ART.crystals, 'bd-crystals'], [ART.lens, 'bd-lens', 'float'], [ART.petals, 'bd-petals', 'float-slow']]

export function Backdrop() {
  const path = usePathname() ?? '/'
  const set = /^\/admin(\/|$)/.test(path) ? [] : /^\/(lesson|page|garden|support)(\/|$)/.test(path) ? CALM : /^\/(quiz|review)(\/|$)/.test(path) ? QUIZ
    : /^\/start(\/|$)/.test(path) ? START : FULL
  return (
    <div className="backdrop" aria-hidden="true">
      {set.map(([art, cls, motion]) => (
        <img key={cls} className={`bd ${cls}${motion ? ` ${motion}` : ''}`} src={art.src} alt="" decoding="async" />
      ))}
    </div>
  )
}

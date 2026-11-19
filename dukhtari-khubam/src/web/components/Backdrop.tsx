'use client'

import { usePathname } from 'next/navigation'

import { ART, type Art } from '../art'

/**
 * Fixed page backdrop: a lavender sky with rendered glass pieces resting at the screen edges — a crocus,
 * a water lily, a tulip, a leafy spray, a crystal cluster, loose petals and glass lenses. It never moves
 * with scrolling (sized to the large viewport) and stays still, so the glass above it is not redrawn
 * every frame; cards above it blur and bend it. Reading screens keep a
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
  // documents are plain paper: no glass pieces around them
  if (/^\/page(\/|$)/.test(path)) return <div className="backdrop backdrop-paper" aria-hidden="true" />
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

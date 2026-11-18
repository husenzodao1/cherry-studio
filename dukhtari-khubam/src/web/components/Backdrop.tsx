'use client'

import { usePathname } from 'next/navigation'

import { ART } from '../art'

/**
 * Fixed page backdrop: a lavender sky with rendered glass flowers and glass lenses resting at the edges,
 * so frosted cards blur them as content scrolls over. It is sized to the large viewport (lvh) and never
 * moves with scrolling. Reading and quiz screens keep a calmer version with one flower.
 */
export function Backdrop() {
  const path = usePathname() ?? '/'
  if (/^\/admin(\/|$)/.test(path)) return <div className="backdrop" aria-hidden="true" />
  const calm = /^\/(lesson|page)(\/|$)/.test(path)
  const quiz = /^\/quiz(\/|$)/.test(path)
  // the start screen has its own large flower; keep only the glass lenses behind it
  const start = /^\/start(\/|$)/.test(path)
  return (
    <div className="backdrop" aria-hidden="true">
      {calm ? null : (
        <>
          <img className="bd bd-bubble float" src={ART.bubble.src} alt="" decoding="async" />
          <img className="bd bd-lens float-slow" src={ART.lens.src} alt="" decoding="async" />
          {quiz || start ? null : <img className="bd bd-flower-open" src={ART.flowerOpen.src} alt="" decoding="async" />}
        </>
      )}
      {start ? null : <img className={`bd bd-flower-side${quiz ? ' bd-quiz' : ''}`} src={ART.flowerSide.src} alt="" decoding="async" />}
    </div>
  )
}

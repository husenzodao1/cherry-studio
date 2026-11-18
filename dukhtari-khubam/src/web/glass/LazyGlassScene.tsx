'use client'

import dynamic from 'next/dynamic'

/**
 * Loads the WebGL glass scene (and three.js) after the page is interactive, so it never delays
 * first paint; until then a light layered placeholder with the same palette holds the space.
 */
export const GlassScene = dynamic(() => import('./GlassScene').then((m) => m.GlassScene), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0 1.5px, transparent 1.5px 22px), linear-gradient(180deg, var(--lavender), var(--lilac) 62%, var(--rose))'
      }}
    />
  )
})

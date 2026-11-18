'use client'

import { usePathname } from 'next/navigation'
import type { CSSProperties } from 'react'

/**
 * Fixed page backdrop: ray-traced gems (tools/render-assets, see PROVENANCE.json) floating in space.
 * Far gems are small and slightly out of focus; near gems are sharp and carry a glint.
 * Hidden while reading a lesson or taking a quiz, so nothing sits behind running text.
 */
interface Gem { cut: string; at: CSSProperties; w: number; far?: boolean; tilt: number; glint?: [string, string] }

/** Home: gems sit in the gaps of the home layout (header/hero, hero/heading, beside the chip). */
const HOME: Gem[] = [
  { cut: 'princess', at: { left: '31%', top: '3.2%' }, w: 24, far: true, tilt: 12 },
  { cut: 'round', at: { left: '47%', top: '8.6%' }, w: 50, tilt: -8, glint: ['74%', '18%'] },
  { cut: 'baguette', at: { right: '3%', top: '30%' }, w: 20, far: true, tilt: 24 },
  { cut: 'oval', at: { left: '5%', top: '40%' }, w: 30, far: true, tilt: 8 },
  { cut: 'trillion', at: { right: '38%', top: '49.5%' }, w: 36, tilt: -14, glint: ['50%', '24%'] },
  { cut: 'pear', at: { right: '6%', top: '59%' }, w: 64, tilt: 18, glint: ['22%', '30%'] },
  { cut: 'emerald', at: { left: -20, top: '71%' }, w: 84, tilt: -6, glint: ['64%', '12%'] },
  { cut: 'marquise', at: { right: -10, top: '87%' }, w: 50, tilt: -22 }
]

/** Other pages: one gem above the content, the rest peek in from the side edges, clear of running text. */
const EDGES: Gem[] = [
  { cut: 'princess', at: { left: '31%', top: '3.2%' }, w: 24, far: true, tilt: 12 },
  { cut: 'round', at: { left: '47%', top: '8.6%' }, w: 50, tilt: -8, glint: ['74%', '18%'] },
  { cut: 'baguette', at: { right: '3%', top: '30%' }, w: 20, far: true, tilt: 24 },
  { cut: 'pear', at: { right: -30, top: '42%' }, w: 64, tilt: 18, glint: ['22%', '30%'] },
  { cut: 'trillion', at: { left: '2%', top: '55%' }, w: 22, far: true, tilt: -14 },
  { cut: 'emerald', at: { left: -36, top: '71%' }, w: 84, tilt: -6, glint: ['64%', '12%'] },
  { cut: 'marquise', at: { right: -18, top: '87%' }, w: 50, tilt: -22 }
]

export function GemField() {
  const path = usePathname()
  if (/^\/(lessons|quizzes)\//.test(path)) return null
  return (
    <div className="gem-field" aria-hidden="true">
      {(path === '/' ? HOME : EDGES).map((g, i) => (
        <span key={g.cut} className={`gem${g.far ? ' gem-far' : ''}`}
          style={{ ...g.at, width: g.w, ['--tilt' as string]: `${g.tilt}deg`, animationDelay: `${-i * 1.7}s` }}>
          <img src={`/assets/3d/gems/${g.cut}.webp`} alt="" decoding="async" />
          {g.glint ? <i className="glint" style={{ left: g.glint[0], top: g.glint[1], animationDelay: `${i * 0.9}s` }} /> : null}
        </span>
      ))}
    </div>
  )
}

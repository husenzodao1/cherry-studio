'use client'

import { usePathname } from 'next/navigation'
import type { CSSProperties } from 'react'

/**
 * Fixed page backdrop: ray-traced gems (tools/render-assets, see PROVENANCE.json) floating in space.
 * Far gems are small and slightly out of focus; near gems are sharp and carry a glint. The field does not
 * move: it is sized to the large viewport (lvh), so mobile toolbars showing or hiding never shift it.
 * Hidden while reading a lesson, taking a quiz or working in the staff panel, so nothing sits behind running text.
 */
interface Gem { cut: string; at: CSSProperties; w: number; far?: boolean; tilt: number; glint?: [string, string] }

/** Home: gems sit in the gaps of the home layout (header/hero, hero/heading, beside the chip). */
const HOME: Gem[] = [
  { cut: 'princess', at: { left: '29%', top: '2.6%' }, w: 32, far: true, tilt: 12 },
  { cut: 'round', at: { left: '44%', top: '7.2%' }, w: 66, tilt: -8, glint: ['74%', '18%'] },
  { cut: 'baguette', at: { right: '3%', top: '30%' }, w: 28, far: true, tilt: 24 },
  { cut: 'oval', at: { left: '4%', top: '40%' }, w: 42, far: true, tilt: 8 },
  { cut: 'trillion', at: { right: '36%', top: '48.6%' }, w: 50, tilt: -14, glint: ['50%', '24%'] },
  { cut: 'pear', at: { right: '4%', top: '57.5%' }, w: 90, tilt: 18, glint: ['22%', '30%'] },
  { cut: 'emerald', at: { left: -30, top: '70%' }, w: 116, tilt: -6, glint: ['64%', '12%'] },
  { cut: 'marquise', at: { right: -16, top: '86%' }, w: 72, tilt: -22 }
]

/** Other pages: one gem above the content, the rest peek in from the side edges, clear of running text. */
const EDGES: Gem[] = [
  { cut: 'princess', at: { left: '29%', top: '2.6%' }, w: 32, far: true, tilt: 12 },
  { cut: 'round', at: { left: '44%', top: '7.2%' }, w: 66, tilt: -8, glint: ['74%', '18%'] },
  { cut: 'baguette', at: { right: '3%', top: '30%' }, w: 28, far: true, tilt: 24 },
  { cut: 'pear', at: { right: -42, top: '41%' }, w: 90, tilt: 18, glint: ['22%', '30%'] },
  { cut: 'trillion', at: { left: '1%', top: '55%' }, w: 30, far: true, tilt: -14 },
  { cut: 'emerald', at: { left: -50, top: '70%' }, w: 116, tilt: -6, glint: ['64%', '12%'] },
  { cut: 'marquise', at: { right: -26, top: '86%' }, w: 72, tilt: -22 }
]

export function GemField() {
  const path = usePathname()
  if (/^\/(lessons|quizzes|admin)(\/|$)/.test(path)) return null
  return (
    <div className="gem-field" aria-hidden="true">
      {(path === '/' ? HOME : EDGES).map((g, i) => (
        <span key={g.cut} className={`gem${g.far ? ' gem-far' : ''}`}
          style={{ ...g.at, width: g.w, transform: `rotate(${g.tilt}deg)` }}>
          <img src={`/assets/3d/gems/${g.cut}.webp`} alt="" decoding="async" />
          {g.glint ? <i className="glint" style={{ left: g.glint[0], top: g.glint[1], animationDelay: `${i * 0.9}s` }} /> : null}
        </span>
      ))}
    </div>
  )
}

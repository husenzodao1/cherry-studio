'use client'

import type { CSSProperties } from 'react'

import type { Bloom } from '../offline/garden'

const DAY = 24 * 60 * 60 * 1000

/**
 * The garden scene: glass flowers standing on a soft lavender meadow, back rows smaller and higher.
 * Flowers grown in the last day bloom in with a sparkle; a study streak adds drifting light.
 */
export function GardenScene({ blooms, rows, streak = 0, compact = false, picked, onPick }: {
  blooms: Bloom[]; rows: number; streak?: number; compact?: boolean; picked?: string | null; onPick?: (b: Bloom) => void
}) {
  const now = Date.now()
  const height = compact ? 150 : Math.min(620, 220 + rows * 54)
  return (
    <div className={`garden${compact ? ' garden-compact' : ''}`} style={{ height }}>
      <span className="garden-hill garden-hill-back" />
      <span className="garden-hill garden-hill-front" />
      {streak >= 3 ? Array.from({ length: Math.min(12, streak + 3) }, (_, i) => (
        <i key={i} className="garden-light" style={{ left: `${(i * 37) % 96}%`, top: `${10 + ((i * 53) % 60)}%`, animationDelay: `${(i % 6) * 0.7}s` }} />
      )) : null}
      {blooms.map((b) => {
        const fresh = now - Date.parse(b.at) < DAY
        const size = (compact ? 30 + b.depth * 22 : 40 + b.depth * 34) * (b.big ? 1.7 : 1)
        const style = {
          left: `${b.x}%`,
          bottom: `${(compact ? 10 : 6) + (1 - b.depth) * (compact ? 46 : 58)}%`,
          width: size,
          zIndex: Math.round(b.depth * 100) + (b.big ? 1 : 0),
          ['--hue' as string]: `${b.hue}deg`,
          ['--tilt' as string]: `${b.tilt}deg`
        } as CSSProperties
        const art = <img src={b.art.src} alt="" decoding="async" />
        return onPick ? (
          <button key={b.id} type="button" className={`bloom${b.big ? ' bloom-big' : ''}${fresh ? ' bloom-new' : ''}${picked === b.id ? ' bloom-picked' : ''}`}
            style={style} aria-label={b.title} onClick={() => onPick(b)}>{art}</button>
        ) : (
          <span key={b.id} className={`bloom${b.big ? ' bloom-big' : ''}${fresh ? ' bloom-new' : ''}`} style={style} aria-hidden="true">{art}</span>
        )
      })}
    </div>
  )
}

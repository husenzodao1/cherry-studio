'use client'

import type { CSSProperties } from 'react'

import type { Bed, Bloom } from '../offline/garden'

const DAY = 24 * 60 * 60 * 1000

/**
 * The garden as a glass cabinet: one glass shelf per school, its icon and count above, the flowers
 * standing in an even row on the shelf. A flower grown in the last day opens with a glint.
 */
export function GardenShelves({ beds, picked, onPick }: { beds: Bed[]; picked?: string | null; onPick: (b: Bloom) => void }) {
  const now = Date.now()
  return (
    <div className="shelves stagger">
      {beds.map((bed) => (
        <section key={bed.school} className="shelf" aria-label={bed.title}>
          <header className="shelf-head">
            {bed.icon ? <img src={bed.icon.src} alt="" aria-hidden="true" /> : null}
            <span className="shelf-title">{bed.title}</span>
            <span className="shelf-count">{bed.lessons}</span>
          </header>
          <div className="shelf-row">
            {bed.blooms.map((b, i) => (
              <button key={b.id} type="button" aria-label={b.title} onClick={() => onPick(b)}
                className={`bloom${b.big ? ' bloom-big' : ''}${now - Date.parse(b.at) < DAY ? ' bloom-new' : ''}${picked === b.id ? ' bloom-picked' : ''}`}
                style={{ ['--hue' as string]: `${b.hue}deg`, animationDelay: `${Math.min(i, 12) * 0.05}s` } as CSSProperties}>
                <img src={b.art.src} alt="" decoding="async" />
              </button>
            ))}
          </div>
          <span className="shelf-glass" aria-hidden="true" />
        </section>
      ))}
    </div>
  )
}

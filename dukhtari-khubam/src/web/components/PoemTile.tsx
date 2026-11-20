'use client'

import Link from 'next/link'

import { LiquidGlass } from '../glass/LiquidGlass'
import { useContent } from '../offline/content'
import { usePrefs } from '../prefs'

export const VERSE_ART = '/assets/3d/verse-garden.webp'

/**
 * "Гулбоғи эҷод" among the schools: a tile like theirs (3D book and quill, name, number of works);
 * the poems and stories themselves open on their own screen (/verse).
 */
export function PoemTile({ long = false }: { long?: boolean }) {
  const { t } = usePrefs()
  const { bundle } = useContent()
  const count = (bundle?.poems?.length ?? 0) + (bundle?.stories?.length ?? 0)
  return (
    <Link href="/verse" className={`tile-link${long ? ' tile-long' : ''}`}>
      <LiquidGlass radius={24} bezel={22} refract className="tile tile-wide tile-clear tile-verse">
        <img className="tile-art" src={VERSE_ART} alt="" aria-hidden="true" decoding="async" />
        <span className="tile-text">
          <span className="tile-title">{t('poem.title')}</span>
          <span className="tile-meta">{t('verse.count').replace('{n}', String(count))}</span>
        </span>
      </LiquidGlass>
    </Link>
  )
}

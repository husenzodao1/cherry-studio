'use client'

import Link from 'next/link'

import { SCHOOL_ART } from '../art'
import type { SchoolSummary } from '../offline/content'
import { usePrefs } from '../prefs'

/** Square frosted-glass school tile with its 3D icon; `wide` adds the course count (schools screen). */
export function SchoolTile({ school, wide = false }: { school: SchoolSummary; wide?: boolean }) {
  const { t } = usePrefs()
  const art = school.icon?.url ? { src: school.icon.url } : SCHOOL_ART[school.slug]
  return (
    <Link href={`/school?key=${encodeURIComponent(school.slug)}`} className={`glass tile${wide ? ' tile-wide' : ''}`}>
      {art ? <img className="tile-art" src={art.src} alt="" aria-hidden="true" decoding="async" /> : <span className="tile-art" />}
      <span className="tile-title">{school.title}</span>
      {wide ? <span className="tile-meta">{t('school.courses_n').replace('{n}', String(school.course_count))}</span> : null}
    </Link>
  )
}

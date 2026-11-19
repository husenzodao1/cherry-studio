'use client'

import Link from 'next/link'

import { SCHOOL_ART } from '../art'
import { LiquidGlass } from '../glass/LiquidGlass'
import type { SchoolSummary } from '../offline/content'
import { usePrefs } from '../prefs'

/**
 * School tile in clear, refracting glass with its 3D icon. `count` adds the number of courses
 * (schools screen); `long` lays the tile out sideways for a last tile that spans two columns.
 */
export function SchoolTile({ school, count = false, long = false }: { school: SchoolSummary; count?: boolean; long?: boolean }) {
  const { t } = usePrefs()
  const art = school.icon?.url ? { src: school.icon.url } : SCHOOL_ART[school.slug]
  return (
    <Link href={`/school?key=${encodeURIComponent(school.slug)}`} className={`tile-link${long ? ' tile-long' : ''}`}>
      <LiquidGlass radius={24} bezel={14} refract={false} className={`tile${count ? ' tile-wide' : ''}`}>
        {art ? <img className="tile-art" src={art.src} alt="" aria-hidden="true" decoding="async" /> : <span className="tile-art" />}
        <span className="tile-text">
          <span className="tile-title">{school.title}</span>
          {count ? <span className="tile-meta">{t('school.courses_n').replace('{n}', String(school.course_count))}</span> : null}
        </span>
      </LiquidGlass>
    </Link>
  )
}

/** Grid of school tiles; a lone tile in the last row spans two columns. */
export function SchoolGrid({ schools, cols, count = false }: { schools: SchoolSummary[]; cols: 2 | 3; count?: boolean }) {
  const lone = schools.length % cols === 1
  return (
    <div className={`tile-grid tile-grid-${cols} stagger`}>
      {schools.map((s, i) => <SchoolTile key={s.id} school={s} count={count} long={lone && i === schools.length - 1} />)}
    </div>
  )
}

/** All schools in one row that the finger moves sideways; a fling carries it as far as the swipe was fast. */
export function SchoolRow({ schools }: { schools: SchoolSummary[] }) {
  return (
    <div className="school-row" role="list">
      {schools.map((s) => <div key={s.id} role="listitem" className="school-row-item"><SchoolTile school={s} /></div>)}
    </div>
  )
}

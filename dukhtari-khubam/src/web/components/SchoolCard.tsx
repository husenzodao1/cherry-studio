'use client'

import Link from 'next/link'

import { SCHOOL_ART } from '../art'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

export interface SchoolSummary {
  id: string
  slug: string
  title: string
  description?: string | null
  theme_color?: string | null
  course_count: number
  icon?: { url: string | null; alt?: string | null } | null
}

/** School tile in the reference-2 language: soft solid colour, a 3D icon rising from the top edge. */
export function SchoolCard({ school, index }: { school: SchoolSummary; index: number }) {
  const { t } = usePrefs()
  const tone = index % 3 === 0 ? 'card-lilac' : index % 3 === 1 ? 'card-rose' : ''
  const art = school.icon?.url ? { src: school.icon.url } : SCHOOL_ART[school.slug]
  return (
    <Link href={`/school?key=${encodeURIComponent(school.slug)}`} className={`card school-card ${tone}`}>
      {art ? <img className="art-pop school-card-art" src={art.src} alt="" aria-hidden="true" loading="lazy" decoding="async" /> : null}
      <b className="school-card-title">{school.title}</b>
      <div className="row school-card-foot">
        <div style={{ flex: 1 }}>
          <div className="eyebrow">{t('section.courses')}</div>
          <div className="big-number">{school.course_count}</div>
        </div>
        <span className="btn" aria-hidden="true"><Icon name="arrow" size={14} /></span>
      </div>
    </Link>
  )
}

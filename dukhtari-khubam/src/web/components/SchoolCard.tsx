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

/** School tile in the reference-2 language: soft solid colour, large light numerals. */
export function SchoolCard({ school, index }: { school: SchoolSummary; index: number }) {
  const { t } = usePrefs()
  const tone = index % 3 === 0 ? 'card-lilac' : index % 3 === 1 ? 'card-rose' : ''
  const art = school.icon?.url ? { src: school.icon.url, w: 1, h: 1 } : SCHOOL_ART[school.slug]
  return (
    <Link href={`/schools/${school.slug}`} className={`card card-pad ${tone}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 190, textDecoration: 'none', position: 'relative', overflow: 'visible' }}>
      {art ? (
        <img className="art-pop" src={art.src} alt="" aria-hidden="true" loading="lazy" decoding="async"
          style={{ top: -38, right: 6, height: 112, width: 'auto', maxWidth: 120 }} />
      ) : null}
      <div className="row" style={{ alignItems: 'flex-start', paddingRight: 92 }}>
        <b style={{ flex: 1, fontWeight: 500, fontSize: '1.08em', lineHeight: 1.25 }}>{school.title}</b>
      </div>
      <div style={{ marginTop: 'auto' }} className="row">
        <div>
          <div className="eyebrow">{t('section.courses')}</div>
          <div className="big-number">{school.course_count}</div>
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        <span className="btn" style={{ width: 40, minHeight: 40, padding: 0 }} aria-hidden="true"><Icon name="arrow" size={16} /></span>
      </div>
    </Link>
  )
}

'use client'

import { useMemo, useState } from 'react'

import { formatDay, streak } from '@/lib/progress'
import { SCHOOL_ART } from '@/web/art'
import { GardenScene } from '@/web/components/Garden'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { useContent } from '@/web/offline/content'
import { gardenOf, type Bloom } from '@/web/offline/garden'
import { useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'

/** "Боғи ман": the learner's progress as a garden of glass flowers. */
export default function GardenPage() {
  const { t, locale } = usePrefs()
  const { bundle } = useContent()
  const { progress } = useLearner()
  const garden = useMemo(() => gardenOf(bundle, progress), [bundle, progress])
  const [picked, setPicked] = useState<Bloom | null>(null)
  const days = streak(progress.days)
  const schools = (bundle?.schools ?? []).filter((s) => garden.bySchool[s.slug])
  return (
    <>
      <Header back="/profile" title={t('garden.title')} />
      <div className="row" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        <span className="chip"><Icon name="sparkle" size={16} /> {t('garden.flowers').replace('{n}', String(garden.flowers))}</span>
        {garden.courses ? <span className="chip"><Icon name="trophy" size={16} /> {t('garden.courses').replace('{n}', String(garden.courses))}</span> : null}
        {days ? <span className="chip"><Icon name="flame" size={16} /> {days}</span> : null}
      </div>
      <div className="glass garden-frame" style={{ marginTop: 16 }}>
        <GardenScene blooms={garden.blooms} rows={garden.rows} streak={days} picked={picked?.id} onPick={(b) => setPicked(picked?.id === b.id ? null : b)} />
        {garden.blooms.length === 0 ? (
          <div className="garden-empty">
            <img src={SCHOOL_ART['ilm-va-salomati']?.src} alt="" aria-hidden="true" />
            <span>{t('garden.empty')}</span>
          </div>
        ) : null}
      </div>
      <p className="muted" role="status" style={{ textAlign: 'center', minHeight: '2.6em', margin: '12px 8px 0', fontSize: '0.92em' }}>
        {picked ? <><b style={{ color: 'var(--ink)' }}>{picked.title}</b> · {formatDay(picked.at, locale)}</> : t('garden.hint')}
      </p>
      {schools.length ? (
        <div className="section stagger">
          {schools.map((s) => (
            <div key={s.id} className="glass list-row">
              <img src={(s.icon?.url ? { src: s.icon.url } : SCHOOL_ART[s.slug])?.src} alt="" style={{ width: 42, height: 42, objectFit: 'contain' }} />
              <span className="row-main"><b>{s.title}</b></span>
              <span className="row-end">{t('garden.flowers').replace('{n}', String(garden.bySchool[s.slug]))}</span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}

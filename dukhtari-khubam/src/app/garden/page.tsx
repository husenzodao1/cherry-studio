'use client'

import { useMemo } from 'react'

import { Header } from '@/web/components/Header'
import { ProgressMap } from '@/web/components/ProgressMap'
import { Empty } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { journeyOf, type Grade } from '@/web/offline/journey'
import { useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'

const GRADES: Grade[] = ['good', 'fair', 'weak']

/** "Харитаи пешравӣ": the learner's progress map — every begun course a road through its lessons. */
export default function GardenPage() {
  const { t } = usePrefs()
  const { bundle } = useContent()
  const { progress } = useLearner()
  const journey = useMemo(() => journeyOf(bundle, progress), [bundle, progress])
  return (
    <>
      <Header back="/profile" title={t('garden.title')} />
      {journey.legs.length === 0 ? <Empty icon="sparkle" title={t('garden.empty')} /> : (
        <>
          <div className="map-legend" role="list">
            {GRADES.map((g) => (
              <span key={g} role="listitem" className={`chip map-key is-${g}`}><i aria-hidden="true" />{t(`map.${g}`)} · {journey.counts[g]}</span>
            ))}
          </div>
          <ProgressMap legs={journey.legs} />
        </>
      )}
    </>
  )
}

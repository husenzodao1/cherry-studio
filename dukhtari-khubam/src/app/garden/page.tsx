'use client'

import { useMemo, useState } from 'react'

import { formatDay } from '@/lib/progress'
import { GardenShelves } from '@/web/components/Garden'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { Empty } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { gardenOf, type Bloom } from '@/web/offline/garden'
import { useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'

/** "Боғи ман": finished lessons and courses as glass flowers, one shelf per school. */
export default function GardenPage() {
  const { t, locale } = usePrefs()
  const { bundle } = useContent()
  const { progress } = useLearner()
  const garden = useMemo(() => gardenOf(bundle, progress), [bundle, progress])
  const [picked, setPicked] = useState<Bloom | null>(null)
  return (
    <>
      <Header back="/profile" title={t('garden.title')} />
      {garden.beds.length === 0 ? <Empty icon="sparkle" title={t('garden.empty')} /> : (
        <>
          <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 6 }}>
            <span className="chip"><Icon name="sparkle" size={16} /> {t('garden.flowers').replace('{n}', String(garden.flowers))}</span>
            <span className="chip"><Icon name="trophy" size={16} /> {t('garden.courses').replace('{n}', String(garden.courses))}</span>
          </div>
          <GardenShelves beds={garden.beds} picked={picked?.id} onPick={(b) => setPicked(picked?.id === b.id ? null : b)} />
          <p className="muted" role="status" style={{ textAlign: 'center', minHeight: '1.5em', margin: '14px 8px 0', fontSize: '0.9em' }}>
            {picked ? <><b style={{ color: 'var(--ink)' }}>{picked.title}</b> · {formatDay(picked.at, locale)}</> : t('garden.hint')}
          </p>
        </>
      )}
    </>
  )
}

'use client'

import { SchoolCard, type SchoolSummary } from '@/web/components/SchoolCard'
import { ErrorState, Loading } from '@/web/components/States'
import { usePrefs } from '@/web/prefs'
import { useApi } from '@/web/useApi'

export default function Schools() {
  const { t, locale } = usePrefs()
  const schools = useApi<SchoolSummary[]>(`/schools?locale=${locale}`)
  return (
    <>
      <header className="topbar"><h1 className="h-page">{t('nav.schools')}</h1></header>
      <div style={{ marginTop: 18 }}>
        {schools.error ? <ErrorState error={schools.error} onRetry={schools.reload} />
          : !schools.data ? <Loading />
            : <div className="grid-auto pop-row" style={{ rowGap: 46, gridTemplateColumns: 'repeat(auto-fill, minmax(min(46%, 180px), 1fr))' }}>{schools.data.map((s, i) => <SchoolCard key={s.id} school={s} index={i} />)}</div>}
      </div>
    </>
  )
}

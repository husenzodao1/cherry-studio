'use client'

import { SchoolCard } from '@/web/components/SchoolCard'
import { Loading } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { usePrefs } from '@/web/prefs'

export default function Schools() {
  const { t } = usePrefs()
  const { bundle, offlineEmpty } = useContent()
  return (
    <>
      <header className="topbar"><h1 className="h-page">{t('nav.schools')}</h1></header>
      <div style={{ marginTop: 18 }}>
        {bundle ? (
          <div className="grid-auto pop-row" style={{ rowGap: 46, gridTemplateColumns: 'repeat(auto-fill, minmax(min(46%, 180px), 1fr))' }}>
            {bundle.schools.map((s, i) => <SchoolCard key={s.id} school={s} index={i} />)}
          </div>
        ) : offlineEmpty ? <p className="muted">{t('state.offline_empty')}</p> : <Loading />}
      </div>
    </>
  )
}

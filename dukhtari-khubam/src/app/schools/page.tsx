'use client'

import Link from 'next/link'

import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { SchoolGrid } from '@/web/components/SchoolTile'
import { Empty, Skeleton } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { usePrefs } from '@/web/prefs'

export default function Schools() {
  const { t } = usePrefs()
  const { bundle, offlineEmpty } = useContent()
  return (
    <>
      <Header back="/" title={t('nav.schools')} />
      <Link href="/search" className="glass search-bar" style={{ marginTop: 18 }}>
        <Icon name="search" /> <span>{t('search.placeholder')}</span>
      </Link>
      <section className="section">
        {bundle ? (
          <SchoolGrid schools={bundle.schools} cols={2} count />
        ) : offlineEmpty ? <Empty icon="info" title={t('state.offline_empty')} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={170} radius={22} />)}
          </div>
        )}
      </section>
    </>
  )
}

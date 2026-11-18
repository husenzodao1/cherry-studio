'use client'

import Link from 'next/link'

import { Icon } from '@/web/components/Icon'
import { Empty } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'

export default function SavedPage() {
  const { t } = usePrefs()
  const { bundle } = useContent()
  const { progress } = useLearner()
  const saved = Object.entries(progress.bookmarks)
    .filter(([, b]) => b.on)
    .sort((a, b) => (a[1].at < b[1].at ? 1 : -1))
    .map(([id]) => bundle?.lessons[id])
    .filter((l) => !!l)
  return (
    <>
      <header className="topbar"><h1 className="h-page">{t('nav.saved')}</h1></header>
      <div className="section">
        {saved.length === 0 ? <Empty title={t('state.empty_saved')} /> : saved.map((l) => (
          <Link key={l!.id} href={`/lesson?id=${l!.id}`} className="card card-pad row" style={{ textDecoration: 'none' }}>
            <Icon name="bookmark" fill="currentColor" />
            <div style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{l!.title}</b><div className="eyebrow">{l!.context.school.title} · {l!.context.course.title}</div></div>
            <Icon name="forward" />
          </Link>
        ))}
      </div>
    </>
  )
}

'use client'

import Link from 'next/link'

import { Header } from '@/web/components/Header'
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
      <Header back="/" title={t('nav.saved')} />
      <div className="section stagger">
        {saved.length === 0 ? <Empty icon="bookmark" title={t('state.empty_saved')} /> : saved.map((l) => (
          <Link key={l!.id} href={`/lesson?id=${l!.id}`} className="glass list-row">
            <span className="row-icon"><Icon name="bookmark" fill="currentColor" /></span>
            <span className="row-main"><b>{l!.title}</b><span className="row-sub">{l!.context.school.title} · {l!.context.course.title}</span></span>
            <Icon name="forward" size={18} />
          </Link>
        ))}
      </div>
    </>
  )
}

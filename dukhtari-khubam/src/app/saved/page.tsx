'use client'

import Link from 'next/link'

import { useAuth } from '@/web/auth'
import { Icon } from '@/web/components/Icon'
import { Empty, ErrorState, Loading } from '@/web/components/States'
import { usePrefs } from '@/web/prefs'
import { useApi } from '@/web/useApi'

interface Saved { lesson_id: string; title: string; school: { title: string }; course: { title: string } }

export default function SavedPage() {
  const { t, locale } = usePrefs()
  const { session, ready } = useAuth()
  const saved = useApi<Saved[]>(session ? `/me/bookmarks?locale=${locale}` : null)
  if (!ready) return null
  return (
    <>
      <header className="topbar"><h1 className="h-page">{t('nav.saved')}</h1></header>
      <div className="section">
        {!session ? (
          <div className="card state"><Icon name="bookmark" size={26} /><b>{t('state.signin_needed')}</b><Link className="btn" href="/login?next=/saved">{t('action.signin')}</Link></div>
        ) : saved.error ? <ErrorState error={saved.error} onRetry={saved.reload} />
          : !saved.data ? <Loading />
            : saved.data.length === 0 ? <Empty title={t('state.empty_saved')} />
              : saved.data.map((s) => (
                <Link key={s.lesson_id} href={`/lessons/${s.lesson_id}`} className="card card-pad row" style={{ textDecoration: 'none' }}>
                  <Icon name="bookmark" fill="currentColor" />
                  <div style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{s.title}</b><div className="eyebrow">{s.school.title} · {s.course.title}</div></div>
                  <Icon name="forward" />
                </Link>
              ))}
      </div>
    </>
  )
}

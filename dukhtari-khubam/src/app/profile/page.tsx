'use client'

import Link from 'next/link'

import { useAuth } from '@/web/auth'
import { Icon } from '@/web/components/Icon'
import { ErrorState, Loading } from '@/web/components/States'
import { usePrefs } from '@/web/prefs'
import { browserSupabase } from '@/web/supabase-browser'
import { useApi } from '@/web/useApi'

interface Me { profile: { display_name?: string | null } | null; roles: string[]; premium: boolean }
interface Progress {
  totals: { lessons_completed: number; courses_completed: number; quizzes_passed: number; achievements: number; bookmarks: number }
  schools: { id: string; title: string; percent: number }[]
  achievements: { id: string; title: string; description?: string | null; awarded_at?: string | null; icon?: { url: string | null } | null }[]
}

export default function Profile() {
  const { t, locale } = usePrefs()
  const { session, ready } = useAuth()
  const me = useApi<Me>(session ? '/me' : null)
  const progress = useApi<Progress>(session ? `/me/progress?locale=${locale}` : null)
  if (!ready) return null
  if (!session) {
    return (
      <div className="card state" style={{ marginTop: 40 }}>
        <Icon name="user" size={28} /><b>{t('state.signin_needed')}</b>
        <Link className="btn" href="/login">{t('action.signin')}</Link>
        <Link className="chip" href="/settings"><Icon name="settings" size={16} /> {t('settings.title')}</Link>
      </div>
    )
  }
  if (me.error) return <ErrorState error={me.error} onRetry={me.reload} />
  if (!me.data || !progress.data) return <Loading />
  const p = progress.data
  return (
    <>
      <header className="topbar">
        <span className="spacer" />
        <Link href="/settings" className="icon-btn" aria-label={t('settings.title')}><Icon name="settings" /></Link>
      </header>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="lg" style={{ width: 104, height: 104, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--lilac)' }}>
          <Icon name="user" size={44} />
        </div>
        <h1 className="h-page">{me.data.profile?.display_name || session.user.email}</h1>
        <span className="chip">{me.data.premium ? t('profile.premium') : t('profile.free')}</span>
      </div>
      <div className="grid-auto section" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {([['profile.lessons', p.totals.lessons_completed], ['profile.courses', p.totals.courses_completed], ['profile.quizzes', p.totals.quizzes_passed]] as const).map(([k, v]) => (
          <div key={k} className="card card-pad" style={{ textAlign: 'center' }}><div className="big-number">{v}</div><div className="eyebrow">{t(k)}</div></div>
        ))}
      </div>
      {p.schools.length ? (
        <section className="section">
          <h2 className="h-section">{t('section.progress')}</h2>
          {p.schools.map((s) => (
            <div key={s.id} className="card card-pad">
              <div className="row"><span style={{ flex: 1 }}>{s.title}</span><span className="muted">{s.percent}%</span></div>
              <div className="progress" style={{ marginTop: 8 }}><span style={{ width: `${s.percent}%` }} /></div>
            </div>
          ))}
        </section>
      ) : null}
      {p.achievements.length ? (
        <section className="section">
          <h2 className="h-section">{t('section.achievements')}</h2>
          <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {p.achievements.map((a) => (
              <div key={a.id} className={`card card-pad ${a.awarded_at ? 'card-lilac' : ''}`} style={{ opacity: a.awarded_at ? 1 : 0.55, textAlign: 'center' }}>
                {a.icon?.url ? <img src={a.icon.url} alt="" width={56} height={56} style={{ margin: '0 auto' }} /> : <Icon name={a.awarded_at ? 'star' : 'lock'} size={28} />}
                <b style={{ display: 'block', fontWeight: 500, marginTop: 6 }}>{a.title}</b>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="section">
        <Link href="/saved" className="card card-pad row" style={{ textDecoration: 'none' }}><Icon name="bookmark" /><span style={{ flex: 1 }}>{t('nav.saved')}</span><Icon name="forward" /></Link>
        <Link href="/settings" className="card card-pad row" style={{ textDecoration: 'none' }}><Icon name="settings" /><span style={{ flex: 1 }}>{t('settings.title')}</span><Icon name="forward" /></Link>
        <button className="btn btn-soft" onClick={() => browserSupabase()?.auth.signOut()}>{t('action.signout')}</button>
      </section>
    </>
  )
}

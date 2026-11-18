'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { formatCode } from '@/lib/progress'
import { Icon } from '@/web/components/Icon'
import { useContent } from '@/web/offline/content'
import { courseProgress, useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'

/** Name, personal code, backup state, progress and achievements — all read from the phone. */
export default function Profile() {
  const { t } = usePrefs()
  const router = useRouter()
  const { bundle } = useContent()
  const { learner, progress, sync, signOut } = useLearner()
  const [showCode, setShowCode] = useState(false)
  if (!learner) return null

  const lessonsDone = Object.values(progress.lessons).filter((l) => l.done).length
  const quizzesPassed = Object.values(progress.quizzes).filter((q) => q.passed).length
  const courseIds = Object.keys(bundle?.courses ?? {})
  const coursesDone = courseIds.filter((id) => courseProgress(bundle, progress, id).percent === 100).length
  const schools = (bundle?.schools ?? []).map((s) => {
    const detail = bundle!.schoolDetails[s.slug]
    const per = (detail?.courses ?? []).map((c) => courseProgress(bundle, progress, c.id))
    const total = per.reduce((n, p) => n + p.total, 0)
    const done = per.reduce((n, p) => n + p.completed, 0)
    return { id: s.id, title: s.title, percent: total ? Math.round((done * 100) / total) : 0 }
  }).filter((s) => s.percent > 0)
  const achievements = bundle?.achievements ?? []

  const leave = () => {
    if (!confirm(t('profile.signout_confirm'))) return
    signOut()
    router.replace('/start')
  }

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
        <h1 className="h-page">{learner.name}</h1>
      </div>

      <div className="card card-pad stack section" style={{ gap: 8 }}>
        <div className="row">
          <span className="eyebrow" style={{ flex: 1 }}>{t('profile.code')}</span>
          <button type="button" className="chip" onClick={() => setShowCode(!showCode)}>{showCode ? t('profile.hide_code') : t('profile.show_code')}</button>
        </div>
        <div style={{ fontSize: '1.35em', letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums', fontWeight: 600, userSelect: showCode ? 'all' : 'none' }}>
          {showCode ? formatCode(learner.code) : '••••• ••••• •••••'}
        </div>
        <span className="muted" style={{ fontSize: '0.85em' }}>
          {sync === 'synced' ? `✓ ${t('profile.synced')}` : sync === 'offline' || sync === 'error' ? t('profile.sync_offline') : '…'}
        </span>
      </div>

      <div className="grid-auto section" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {([['profile.lessons', lessonsDone], ['profile.courses', coursesDone], ['profile.quizzes', quizzesPassed]] as const).map(([k, v]) => (
          <div key={k} className="card card-pad" style={{ textAlign: 'center' }}><div className="big-number">{v}</div><div className="eyebrow">{t(k)}</div></div>
        ))}
      </div>
      {schools.length ? (
        <section className="section">
          <h2 className="h-section">{t('section.progress')}</h2>
          {schools.map((s) => (
            <div key={s.id} className="card card-pad">
              <div className="row"><span style={{ flex: 1 }}>{s.title}</span><span className="muted">{s.percent}%</span></div>
              <div className="progress" style={{ marginTop: 8 }}><span style={{ width: `${s.percent}%` }} /></div>
            </div>
          ))}
        </section>
      ) : null}
      {achievements.length ? (
        <section className="section">
          <h2 className="h-section">{t('section.achievements')}</h2>
          <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {achievements.map((a) => {
              const got = !!progress.achievements[a.key]
              return (
                <div key={a.id} className={`card card-pad ${got ? 'card-lilac' : ''}`} style={{ opacity: got ? 1 : 0.55, textAlign: 'center' }}>
                  {a.icon?.url ? <img src={a.icon.url} alt="" width={56} height={56} style={{ margin: '0 auto' }} /> : <Icon name={got ? 'star' : 'lock'} size={28} />}
                  <b style={{ display: 'block', fontWeight: 500, marginTop: 6 }}>{a.title}</b>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
      <section className="section">
        <Link href="/saved" className="card card-pad row" style={{ textDecoration: 'none' }}><Icon name="bookmark" /><span style={{ flex: 1 }}>{t('nav.saved')}</span><Icon name="forward" /></Link>
        <Link href="/settings" className="card card-pad row" style={{ textDecoration: 'none' }}><Icon name="settings" /><span style={{ flex: 1 }}>{t('settings.title')}</span><Icon name="forward" /></Link>
        <button className="btn btn-soft" onClick={leave}>{t('profile.signout')}</button>
      </section>
    </>
  )
}

'use client'

import Link from 'next/link'

import { streak } from '@/lib/progress'
import { Avatar } from '@/web/components/Header'
import { Icon, type IconName } from '@/web/components/Icon'
import { LOCALE_LABELS } from '@/web/i18n'
import { useContent } from '@/web/offline/content'
import { courseProgress, useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'

/** Name, numbers and achievements — all read from the phone. */
export default function Profile() {
  const prefs = usePrefs()
  const { t } = prefs
  const { bundle } = useContent()
  const { learner, progress } = useLearner()
  if (!learner) return null

  const courseIds = Object.keys(bundle?.courses ?? {})
  const coursesStarted = courseIds.filter((id) => courseProgress(bundle, progress, id).completed > 0).length
  const achievementsGot = Object.keys(progress.achievements).length
  const days = streak(progress.days)
  const schools = (bundle?.schools ?? []).map((s) => {
    const per = (bundle!.schoolDetails[s.slug]?.courses ?? []).map((c) => courseProgress(bundle, progress, c.id))
    const total = per.reduce((n, p) => n + p.total, 0)
    const done = per.reduce((n, p) => n + p.completed, 0)
    return { id: s.id, slug: s.slug, title: s.title, percent: total ? Math.round((done * 100) / total) : 0 }
  }).filter((s) => s.percent > 0)
  const achievements = bundle?.achievements ?? []
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && typeof window !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches)

  const stats: [IconName, number, string][] = [
    ['book', coursesStarted, t('profile.courses')],
    ['trophy', achievementsGot, t('profile.achievements')],
    ['flame', days, t('profile.streak')]
  ]

  return (
    <>
      <header className="topbar">
        <span className="icon-spacer" />
        <span className="spacer" />
        <Link href="/settings" className="icon-btn" aria-label={t('settings.title')}><Icon name="settings" /></Link>
      </header>
      <div className="profile-head">
        <span className="bloom-in"><Avatar name={learner.name} size={96} /></span>
        <h1 className="h-page" style={{ marginTop: 10 }}>{learner.name}</h1>
        <span className="tag">{t('profile.tagline')} <span aria-hidden="true">💜</span></span>
      </div>

      <div className="stats stagger" style={{ marginTop: 22 }}>
        {stats.map(([icon, value, label]) => (
          <div key={label} className="glass stat">
            <span className="stat-icon"><Icon name={icon} size={20} /></span>
            <span className="big-number">{value}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="glass menu" style={{ marginTop: 18 }}>
        <Link href="/schools" className="menu-row"><Icon name="chart" /><span className="grow">{t('profile.my_progress')}</span><Icon name="forward" size={18} /></Link>
        <Link href="/saved" className="menu-row"><Icon name="bookmark" /><span className="grow">{t('profile.my_saved')}</span><Icon name="forward" size={18} /></Link>
        <Link href="/settings" className="menu-row"><Icon name="settings" /><span className="grow">{t('settings.title')}</span><Icon name="forward" size={18} /></Link>
        <Link href="/settings" className="menu-row"><Icon name="globe" /><span className="grow">{t('settings.language')}</span><span className="val">{LOCALE_LABELS[prefs.locale]}</span><Icon name="forward" size={18} /></Link>
        <div className="menu-row">
          <Icon name="moon" /><span className="grow">{t('profile.night')}</span>
          <button type="button" role="switch" className="switch" aria-checked={dark} aria-label={t('profile.night')}
            onClick={() => prefs.set({ theme: dark ? 'light' : 'dark' })} />
        </div>
        <Link href="/page?slug=about" className="menu-row"><Icon name="info" /><span className="grow">{t('settings.about')}</span><Icon name="forward" size={18} /></Link>
      </div>

      {schools.length ? (
        <section className="section">
          <h2 className="h-section">{t('section.progress')}</h2>
          {schools.map((s) => (
            <Link key={s.id} href={`/school?key=${encodeURIComponent(s.slug)}`} className="glass card-pad">
              <div className="row"><span style={{ flex: 1 }}>{s.title}</span><span className="muted">{s.percent}%</span></div>
              <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${s.percent}%` }} /></div>
            </Link>
          ))}
        </section>
      ) : null}

      {achievements.length ? (
        <section className="section">
          <h2 className="h-section">{t('section.achievements')}</h2>
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            {achievements.map((a) => {
              const got = !!progress.achievements[a.key]
              return (
                <div key={a.id} className="glass stat" style={{ opacity: got ? 1 : 0.55 }}>
                  {a.icon?.url ? <img src={a.icon.url} alt="" width={48} height={48} /> : <span className="stat-icon"><Icon name={got ? 'star' : 'lock'} size={18} /></span>}
                  <span style={{ fontSize: '0.8rem', color: 'var(--ink)' }}>{a.title}</span>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </>
  )
}

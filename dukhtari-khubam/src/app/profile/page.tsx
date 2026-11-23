'use client'

import Link from 'next/link'
import { useState } from 'react'

import { streak } from '@/lib/progress'
import { finalId, stageState } from '@/lib/stage'
import { Avatar } from '@/web/components/Header'
import { CertificateButton } from '@/web/components/Keepsakes'
import { Icon } from '@/web/components/Icon'
import { LOCALE_LABELS } from '@/web/i18n'
import { useContent } from '@/web/offline/content'
import { courseProgress, useLearner } from '@/web/offline/learner'
import { usePhoto } from '@/web/offline/photo'
import { PhotoSheet } from '@/web/components/PhotoEditor'
import { isDarkTheme, usePrefs } from '@/web/prefs'
import { emojify } from '@/web/components/Emoji'

/** Small filled glyphs for the three numbers, drawn white on a coloured orb. */
function StatGlyph({ kind }: { kind: 'courses' | 'achievements' | 'streak' }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {kind === 'courses' ? (
        <>
          <path d="M12 6.6C10 5 7.1 4.6 4 5.2v12.7c3-.5 5.9-.1 8 1.4z" fill="#fff" />
          <path d="M12 6.6c2-1.6 4.9-2 8-1.4v12.7c-3-.5-5.9-.1-8 1.4z" fill="#fff" opacity="0.72" />
        </>
      ) : kind === 'achievements' ? (
        <>
          <path d="M7.6 2.6h3.2l1.7 5.2H9.3zM16.4 2.6h-3.2l-1.7 5.2h3.2z" fill="#fff" opacity="0.72" />
          <circle cx="12" cy="14.6" r="6" fill="#fff" />
          <path d="m12 11.4 1 2 2.2.3-1.6 1.6.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.6 2.2-.3z" fill="var(--stat-b)" />
        </>
      ) : (
        <>
          <path d="M12 21.4c-4 0-6.6-2.7-6.6-6.3 0-3.5 2.5-5.6 4.1-7.8.6 1.6 1.6 2.7 2.8 3.1.3-2.9 1.6-5.3 3.5-7.4.6 3.5 4 5.5 4 10.3 0 4.6-3.1 8.1-7.8 8.1z" fill="#fff" />
          <path d="M12 21.4c-2 0-3.3-1.4-3.3-3.2 0-1.8 1.3-2.8 2.2-4 .4.9.9 1.4 1.5 1.6.2-1.5 1-2.8 1.9-3.8.4 1.9 2 3 2 5.5 0 2.4-1.6 3.9-4.3 3.9z" fill="var(--stat-b)" opacity="0.85" />
        </>
      )}
    </svg>
  )
}

/** The avatar with a camera badge; a tap opens the choices: change, take a new one, or remove it. */
function ProfilePhoto({ name }: { name: string }) {
  const { t } = usePrefs()
  const photo = usePhoto()
  const [open, setOpen] = useState(false)
  return (
    <span className="profile-photo bloom-in">
      <button type="button" className="photo-btn" onClick={() => setOpen(true)} aria-label={t('profile.photo')} aria-haspopup="dialog">
        <Avatar name={name} size={96} />
        <span className="photo-badge" aria-hidden="true"><Icon name="camera" size={15} /></span>
      </button>
      {open ? <PhotoSheet hasPhoto={!!photo} onClose={() => setOpen(false)} /> : null}
    </span>
  )
}

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
  // finished courses, newest first, with the day their last lesson was done
  // a certificate for every finished stage: lessons read and, when it has one, the final test passed
  const finished = Object.values(bundle?.courses ?? {}).flatMap((c) => {
    if (!bundle || !stageState(bundle, progress, c.id).complete) return []
    const ids = c.modules.flatMap((m) => m.topics.flatMap((tp) => tp.lessons.filter((l) => !l.locked).map((l) => l.id)))
    const dates = [...ids.map((id) => progress.lessons[id]?.done ?? ''), progress.quizzes[finalId(c.id)]?.at ?? '']
    return [{ id: c.id, title: c.title, school: c.school?.title ?? '', date: dates.sort().at(-1)! }]
  }).sort((a, b) => b.date.localeCompare(a.date))
  const dark = isDarkTheme(prefs.theme)

  const stats: ['courses' | 'achievements' | 'streak', number, string][] = [
    ['courses', coursesStarted, t('profile.courses')],
    ['achievements', achievementsGot, t('profile.achievements')],
    ['streak', days, t('profile.streak')]
  ]

  return (
    <>
      <header className="topbar">
        <span className="icon-spacer" />
        <span className="spacer" />
        <Link href="/settings" className="icon-btn" aria-label={t('settings.title')}><Icon name="settings" /></Link>
      </header>
      <div className="profile-head">
        {/* the studio's signature, large and faint in the background behind the head */}
        <span className="studio-ghost" aria-hidden="true">Gratorslab</span>
        <ProfilePhoto name={learner.name} />
        <h1 className="h-page" style={{ marginTop: 10 }}>{emojify(learner.name)}</h1>
        <span className="tag">{t('profile.tagline')}</span>
      </div>

      <div className="stats stagger" style={{ marginTop: 22 }}>
        {stats.map(([kind, value, label]) => (
          <div key={kind} className={`glass stat stat-${kind}`}>
            <span className="stat-orb"><StatGlyph kind={kind} /></span>
            <span className="big-number">{value}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="glass menu" style={{ marginTop: 18 }}>
        <Link href="/garden" className="menu-row"><Icon name="sparkle" /><span className="grow">{t('garden.title')}</span><Icon name="forward" size={18} /></Link>
        <Link href="/review" className="menu-row"><Icon name="check" /><span className="grow">{t('review.title')}</span><Icon name="forward" size={18} /></Link>
        <Link href="/schools" className="menu-row"><Icon name="chart" /><span className="grow">{t('profile.my_progress')}</span><Icon name="forward" size={18} /></Link>
        <Link href="/saved" className="menu-row"><Icon name="bookmark" /><span className="grow">{t('profile.my_saved')}</span><Icon name="forward" size={18} /></Link>
        <Link href="/settings" className="menu-row"><Icon name="settings" /><span className="grow">{t('settings.title')}</span><Icon name="forward" size={18} /></Link>
        <Link href="/settings" className="menu-row"><Icon name="globe" /><span className="grow">{t('settings.language')}</span><span className="val">{LOCALE_LABELS[prefs.locale]}</span><Icon name="forward" size={18} /></Link>
        <div className="menu-row">
          <Icon name="moon" /><span className="grow">{t('profile.night')}</span>
          <button type="button" role="switch" className="switch" aria-checked={dark} aria-label={t('profile.night')}
            onClick={() => prefs.set({ theme: dark ? 'peach' : 'dark' })} />
        </div>
        <Link href="/page?slug=about" className="menu-row"><Icon name="info" /><span className="grow">{t('settings.about')}</span><Icon name="forward" size={18} /></Link>
      </div>

      {schools.length ? (
        <section className="section">
          <h2 className="h-section">{t('section.progress')}</h2>
          {schools.map((s) => (
            <Link key={s.id} href={`/school?key=${encodeURIComponent(s.slug)}`} className="glass card-pad">
              <div className="row"><span style={{ flex: 1 }}>{emojify(s.title)}</span><span className="muted">{s.percent}%</span></div>
              <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${s.percent}%` }} /></div>
            </Link>
          ))}
        </section>
      ) : null}

      {finished.length ? (
        <section className="section">
          <h2 className="h-section">{t('cert.section')}</h2>
          {finished.map((c) => (
            <div key={c.id} className="glass list-row">
              <span className="row-icon"><Icon name="trophy" /></span>
              <span className="row-main"><b>{emojify(c.title)}</b><span className="row-sub">{c.school}</span></span>
              <CertificateButton course={c.title} school={c.school} date={c.date} className="chip" />
            </div>
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
                  <span style={{ fontSize: '0.8rem', color: 'var(--ink)' }}>{emojify(a.title)}</span>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </>
  )
}

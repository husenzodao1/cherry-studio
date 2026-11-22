'use client'

import Link from 'next/link'

import { streak } from '@/lib/progress'

import { useLearner } from '../offline/learner'
import { usePrefs } from '../prefs'

/** Flame colours that grow with the streak: ash, ember, flame, rose fire, violet fire, gold. */
export function streakTier(n: number): { tier: string; from: string; to: string } {
  if (n <= 0) return { tier: 'ash', from: '#d9d3dd', to: '#a79fae' }
  if (n < 3) return { tier: 'ember', from: '#ffd9a0', to: '#ff9a5a' }
  if (n < 7) return { tier: 'flame', from: '#ffc56b', to: '#f05a4d' }
  if (n < 14) return { tier: 'rose', from: '#ffb3d1', to: '#e23d84' }
  if (n < 30) return { tier: 'violet', from: '#d6b8ff', to: '#7a45e6' }
  return { tier: 'gold', from: '#fff0a8', to: '#e0a226' }
}

/** Home, next to the avatar: a small glass box with the flame (its colour by the streak) and the days. */
export function StreakBadge() {
  const { t } = usePrefs()
  const { progress } = useLearner()
  const n = streak(progress.days)
  const { tier, from, to } = streakTier(n)
  const id = `sb-${tier}`
  return (
    <Link href="/profile" className={`streak-badge glass streak-${tier}`} aria-label={`${n} ${t('profile.streak')}`}>
      <svg className="streak-flame" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient>
        </defs>
        <path d="M12 21.6c-4.1 0-6.8-2.8-6.8-6.5 0-3.6 2.6-5.8 4.2-8 .6 1.6 1.6 2.8 2.9 3.2.3-3 1.7-5.5 3.6-7.6.6 3.6 4.1 5.7 4.1 10.6 0 4.7-3.2 8.3-8 8.3z" fill={`url(#${id})`} />
        <path d="M12 21.6c-2 0-3.4-1.4-3.4-3.3 0-1.9 1.3-2.9 2.3-4.1.4.9.9 1.5 1.5 1.7.2-1.6 1-2.9 2-3.9.4 2 2.1 3.1 2.1 5.7 0 2.4-1.7 3.9-4.5 3.9z" fill="#fff" opacity="0.78" />
      </svg>
      <span className="streak-num">{n}</span>
    </Link>
  )
}

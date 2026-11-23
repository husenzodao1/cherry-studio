'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { usePhoto } from '../offline/photo'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'
import { emojify } from './Emoji'

/**
 * Detail-screen header: round glass back button, centred title, optional action on the right. `onBack`
 * (instead of `back`) lets the page decide what going back does.
 */
export function Header({ back, onBack, title, end }: { back?: string; onBack?: () => void; title?: ReactNode; end?: ReactNode }) {
  const { t } = usePrefs()
  return (
    <header className="topbar">
      {onBack ? <button type="button" className="icon-btn" aria-label={t('action.back')} onClick={onBack}><Icon name="back" /></button>
        : back ? <Link href={back} className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link> : <span className="icon-spacer" />}
      <h1 className="topbar-title">{typeof title === 'string' ? emojify(title) : title}</h1>
      {end ?? <span className="icon-spacer" />}
    </header>
  )
}

/**
 * The learner's photo (kept on this phone only), or her initial on a soft glass disc, with a small
 * gold crown resting on it, slipped a little to one side.
 */
export function Avatar({ name, size = 52 }: { name?: string | null; size?: number }) {
  const photo = usePhoto()
  const letter = (name ?? '').trim().charAt(0).toUpperCase() || '✿'
  return (
    <span className="avatar-crowned" style={{ ['--avatar' as string]: `${size}px` }} aria-hidden="true">
      <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {photo ? <img src={photo} alt="" /> : letter}
      </span>
      <img className="avatar-crown" src="/assets/3d/crown.webp" alt="" />
    </span>
  )
}

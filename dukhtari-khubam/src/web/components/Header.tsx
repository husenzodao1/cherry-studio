'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/** Detail-screen header: round glass back button, centred title, optional action on the right. */
export function Header({ back, title, end }: { back?: string; title?: ReactNode; end?: ReactNode }) {
  const { t } = usePrefs()
  return (
    <header className="topbar">
      {back ? <Link href={back} className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link> : <span className="icon-spacer" />}
      <h1 className="topbar-title">{title}</h1>
      {end ?? <span className="icon-spacer" />}
    </header>
  )
}

/** The learner's initial on a soft glass disc (no photos are collected). */
export function Avatar({ name, size = 52 }: { name?: string | null; size?: number }) {
  const letter = (name ?? '').trim().charAt(0).toUpperCase() || '✿'
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">{letter}</span>
}

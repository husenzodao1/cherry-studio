'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { LiquidGlass } from '../glass/LiquidGlass'
import { useMahliyo } from '../offline/mahliyo'
import { usePrefs } from '../prefs'
import { Icon, type IconName } from './Icon'

const ITEMS: { href: string; key: 'nav.home' | 'nav.schools' | 'nav.saved' | 'nav.profile'; icon: IconName; match: RegExp }[] = [
  { href: '/', key: 'nav.home', icon: 'home', match: /^\/$/ },
  { href: '/schools', key: 'nav.schools', icon: 'cap', match: /^\/(schools|school|course)(\/|$)/ },
  { href: '/saved', key: 'nav.saved', icon: 'bookmark', match: /^\/saved/ },
  { href: '/profile', key: 'nav.profile', icon: 'user', match: /^\/(profile|settings)/ }
]

/** Screens without the tab bar (reading, tests, signing in, the panel). */
export const noDock = (path: string) => /^\/(lesson|quiz|review|start|welcome|admin|support)(\/|$)/.test(path)

/**
 * Floating tab bar in clear, refracting glass; the current tab sits in a raised glass circle. In the
 * middle, raised on a soft dome above the bar, Mahliyo AI: her picture in a circle, her head rising out
 * of it (drawn outside the glass, which clips what it holds). While she answers in the background her
 * circle glows and turns; an answer the learner has not seen yet shows a dot, and for a few seconds a note
 * above the bar says she answered (a tap opens her chat).
 */
export function Dock() {
  const path = usePathname() ?? '/'
  const { t } = usePrefs()
  const hidden = noDock(path)
  const { pending, unseen } = useMahliyo()
  const ai = /^\/mahliyo/.test(path)
  const [notice, setNotice] = useState(false)
  // a screen without the tab bar keeps no room for it at the bottom (so a short one fits the phone)
  useEffect(() => { document.documentElement.classList.toggle('no-dock', hidden) }, [hidden])
  useEffect(() => {
    if (!unseen || ai) return setNotice(false)
    setNotice(true)
    const off = setTimeout(() => setNotice(false), 6000)
    return () => clearTimeout(off)
  }, [unseen, ai])
  if (hidden) return null
  const tab = (item: (typeof ITEMS)[number]) => {
    const on = item.match.test(path)
    return (
      <Link key={item.href} href={item.href} aria-current={on ? 'page' : undefined} aria-label={t(item.key)}>
        <Icon name={item.icon} size={23} fill={on && item.icon !== 'cap' ? 'currentColor' : 'none'} />
      </Link>
    )
  }
  return (
    <div className="dock-wrap">
      {notice ? (
        <Link href="/mahliyo" className="ai-notice" role="status">
          <img src="/assets/mascot/face.webp" alt="" aria-hidden="true" /><span>{t('ai.answered')}</span><Icon name="forward" size={16} />
        </Link>
      ) : null}
      <span className="dock-dome" aria-hidden="true" />
      <LiquidGlass as="nav" label={t('nav.home')} radius={36} bezel={20} blur={40} className="dock">
        {ITEMS.slice(0, 2).map(tab)}
        <span className="dock-gap" aria-hidden="true" />
        {ITEMS.slice(2).map(tab)}
      </LiquidGlass>
      <Link href="/mahliyo" className={`dock-ai${pending ? ' is-thinking' : ''}`} aria-current={ai ? 'page' : undefined}
        aria-label={pending ? `${t('ai.title')} · ${t('ai.thinking')}` : t('ai.title')}>
        <span className="dock-ai-fig"><img src="/assets/mascot/persona.webp" alt="" aria-hidden="true" /></span>
        {unseen && !ai ? <span className="dock-ai-news" aria-hidden="true" /> : null}
      </Link>
    </div>
  )
}

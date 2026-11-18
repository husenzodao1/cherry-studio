'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { usePrefs } from '../prefs'
import { Icon, type IconName } from './Icon'

const ITEMS: { href: string; key: 'nav.home' | 'nav.schools' | 'nav.saved' | 'nav.profile'; icon: IconName; match: RegExp }[] = [
  { href: '/', key: 'nav.home', icon: 'home', match: /^\/$/ },
  { href: '/schools', key: 'nav.schools', icon: 'cap', match: /^\/(schools|school|course)(\/|$)/ },
  { href: '/saved', key: 'nav.saved', icon: 'bookmark', match: /^\/saved/ },
  { href: '/profile', key: 'nav.profile', icon: 'user', match: /^\/(profile|settings)/ }
]

/** Floating frosted-glass tab bar; the current tab sits in a raised glass circle. */
export function Dock() {
  const path = usePathname() ?? '/'
  const { t } = usePrefs()
  if (/^\/(lesson|quiz|start|admin)(\/|$)/.test(path)) return null
  return (
    <div className="dock-wrap">
      <nav className="dock glass" aria-label={t('nav.home')}>
        {ITEMS.map((item) => {
          const on = item.match.test(path)
          return (
            <Link key={item.href} href={item.href} aria-current={on ? 'page' : undefined} aria-label={t(item.key)}>
              <span className="dock-icon"><Icon name={item.icon} size={23} fill={on && item.icon !== 'cap' ? 'currentColor' : 'none'} /></span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

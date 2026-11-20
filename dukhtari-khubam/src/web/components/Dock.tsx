'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LiquidGlass } from '../glass/LiquidGlass'
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

/** Floating tab bar in clear, refracting glass; the current tab sits in a raised glass circle. */
export function Dock() {
  const path = usePathname() ?? '/'
  const { t } = usePrefs()
  if (noDock(path)) return null
  return (
    <div className="dock-wrap">
      <LiquidGlass as="nav" label={t('nav.home')} radius={36} bezel={20} blur={40} className="dock">
        {ITEMS.map((item) => {
          const on = item.match.test(path)
          return (
            <Link key={item.href} href={item.href} aria-current={on ? 'page' : undefined} aria-label={t(item.key)}>
              <Icon name={item.icon} size={23} fill={on && item.icon !== 'cap' ? 'currentColor' : 'none'} />
            </Link>
          )
        })}
      </LiquidGlass>
    </div>
  )
}

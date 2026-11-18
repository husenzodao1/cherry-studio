'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LiquidGlass } from '../glass/LiquidGlass'
import { usePrefs } from '../prefs'
import { Icon, type IconName } from './Icon'

const ITEMS: { href: string; key: 'nav.home' | 'nav.schools' | 'nav.saved' | 'nav.profile'; icon: IconName; match: RegExp }[] = [
  { href: '/', key: 'nav.home', icon: 'home', match: /^\/$/ },
  { href: '/schools', key: 'nav.schools', icon: 'layers', match: /^\/(schools|school|course)(\/|$)/ },
  { href: '/saved', key: 'nav.saved', icon: 'bookmark', match: /^\/saved/ },
  { href: '/profile', key: 'nav.profile', icon: 'user', match: /^\/(profile|settings)/ }
]

/** Floating bottom navigation in physically-refracting glass (spec §8.8: Premium Real Glass). */
export function Dock() {
  const path = usePathname() ?? '/'
  const { t } = usePrefs()
  if (/^\/(lesson|quiz|start|admin)(\/|$)/.test(path)) return null
  return (
    <div className="dock-wrap">
      <LiquidGlass as="nav" label="Навигатсия" radius={34} bezel={18} className="dock">
        {ITEMS.map((item) => (
          <Link key={item.href} href={item.href} aria-current={item.match.test(path) ? 'page' : undefined}>
            <Icon name={item.icon} size={22} />
            <span>{t(item.key)}</span>
          </Link>
        ))}
      </LiquidGlass>
    </div>
  )
}

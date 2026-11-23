'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type MouseEvent } from 'react'

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

/** Screens without the tab bar (reading, tests, signing in, the panel, Mahliyo's full screen). */
export const noDock = (path: string) => /^\/(lesson|quiz|review|start|welcome|admin|support|mahliyo|premium|navigate)(\/|$)/.test(path)

/**
 * Floating tab bar in clear, refracting glass; the current tab sits in a raised glass circle. In the
 * middle, a little above the bar, Mahliyo AI: her picture in a circle, her head rising out of it (drawn
 * outside the glass, which clips what it holds); the bar's edge keeps a small gap around her circle. While she answers in the background her
 * circle glows and turns; an answer the learner has not seen yet shows a dot, and for a few seconds a note
 * above the bar says she answered (a tap opens her chat).
 */
export function Dock() {
  const path = usePathname() ?? '/'
  const router = useRouter()
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
  // her chat covers the whole screen; "✕" brings the learner back here. The browser's own full screen is not
  // asked for: on Android Chrome, going full screen while the chat pours out left only a black screen.
  const toFull = (e: MouseEvent) => {
    try { sessionStorage.setItem('dk.ai-from', path) } catch { /* home */ }
    const root = document.documentElement
    // the chat pours out of her circle, slowly, over the screen she was on (which stays as it is meanwhile)
    const doc = document as Document & { startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void> } }
    if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try { sessionStorage.setItem('dk.ai-genie', '1') } catch { /* no animation */ }
      return
    }
    e.preventDefault()
    root.classList.add('genie-open')
    const t = doc.startViewTransition(() => new Promise<void>((shown) => {
      window.addEventListener('dk:ai-shown', () => shown(), { once: true })
      setTimeout(shown, 1500)
      router.push('/mahliyo')
    }))
    // a transition the browser gives up (a slow phone) just shows the chat at once: not an error
    void t.ready.catch(() => undefined)
    void t.updateCallbackDone.catch(() => undefined)
    void t.finished.catch(() => undefined).finally(() => root.classList.remove('genie-open'))
    // a phone's browser that stalls the pouring out: after a moment the chat is simply there
    const skip = (t as { skipTransition?: () => void }).skipTransition
    setTimeout(() => { if (root.classList.contains('genie-open')) skip?.call(t) }, 2500)
  }
  return (
    <div className="dock-wrap">
      {notice ? (
        <Link href="/mahliyo" className="ai-notice" role="status">
          <img src="/assets/mascot/face.webp" alt="" aria-hidden="true" /><span>{t('ai.answered')}</span><Icon name="forward" size={16} />
        </Link>
      ) : null}
      <LiquidGlass as="nav" label={t('nav.home')} radius={36} bezel={20} blur={40} className="dock">
        {ITEMS.slice(0, 2).map(tab)}
        <span className="dock-gap" aria-hidden="true" />
        {ITEMS.slice(2).map(tab)}
      </LiquidGlass>
      <Link href="/mahliyo" className={`dock-ai${pending ? ' is-thinking' : ''}`} aria-current={ai ? 'page' : undefined} onClick={toFull}
        aria-label={pending ? `${t('ai.title')} · ${t('ai.thinking')}` : t('ai.title')}>
        <span className="dock-ai-fig"><img src="/assets/mascot/persona.webp" alt="" aria-hidden="true" /></span>
        {unseen && !ai ? <span className="dock-ai-news" aria-hidden="true" /> : null}
      </Link>
    </div>
  )
}

'use client'

import type { Links, Network } from '../offline/social'
import { linkUrl } from '../offline/social'

/** WhatsApp, Telegram and Instagram as small round icons: open when the link is known, locked otherwise */
const NETWORKS: Network[] = ['whatsapp', 'telegram', 'instagram']
const PATHS: Record<Network, string> = {
  whatsapp: 'M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5zm5.4 13.4c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.1.1.6-.1 1.2z',
  telegram: 'M21.6 4.2 2.9 11.4c-1.3.5-1.2 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.5c.3-1.3-.5-1.9-1.3-1.6zM8.3 14l9.6-6.1c.5-.3.9-.1.5.2l-8 7.3-.3 3.3z',
  instagram: 'M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 7.8a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2zm6-8a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM12 3.6c2.7 0 3 0 4.1.1 2.7.1 4 1.4 4.1 4.1.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c-.1 2.7-1.4 4-4.1 4.1-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-2.7-.1-4-1.4-4.1-4.1-.1-1.1-.1-1.4-.1-4.1s0-3 .1-4.1c.1-2.7 1.4-4 4.1-4.1 1.1-.1 1.4-.1 4.1-.1z'
}
const COLORS: Record<Network, string> = { whatsapp: '#25d366', telegram: '#229ed9', instagram: '#e1306c' }

export function SocialIcons({ has, links, locked }: { has: Network[]; links: Links | null; locked: string }) {
  const shown = NETWORKS.filter((n) => has.includes(n))
  if (!shown.length) return null
  return (
    <div className="social-icons">
      {shown.map((n) => {
        const value = links?.[n]
        const icon = <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d={PATHS[n]} fill="currentColor" /></svg>
        return value
          ? <a key={n} className="social-icon" style={{ ['--c' as string]: COLORS[n] }} href={linkUrl(n, value)} target="_blank" rel="noopener noreferrer" aria-label={n}>{icon}</a>
          : <span key={n} className="social-icon is-locked" style={{ ['--c' as string]: COLORS[n] }} title={locked} aria-label={`${n} — ${locked}`}>{icon}<i aria-hidden="true">🔒</i></span>
      })}
    </div>
  )
}

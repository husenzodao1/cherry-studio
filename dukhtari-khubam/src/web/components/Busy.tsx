'use client'

import { Icon, type IconName } from './Icon'

/** Three dots that keep appearing and fading after a "please wait" text. */
export function Dots() {
  return <span className="busy-dots" aria-hidden="true"><i /><i /><i /></span>
}

/**
 * A button's icon that turns into a spinning ring while the button waits ("Давом →" becomes
 * "Давом ◌"), and into an animated tick once it is done.
 */
export function GoIcon({ busy, done = false, name = 'arrow', size = 18 }: { busy: boolean; done?: boolean; name?: IconName; size?: number }) {
  return (
    <span className={`go-icon${busy ? ' is-busy' : ''}${done ? ' is-done' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      <Icon name={name} size={size} />
      <span className="go-spin" />
      <svg className="go-tick" viewBox="0 0 24 24" width={size} height={size} fill="none"><path d="M5 12.5l4.6 4.6L19 7.6" /></svg>
    </span>
  )
}

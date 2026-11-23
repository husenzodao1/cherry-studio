import { Icon } from './Icon'

/** A paid item's lock: a small golden crown in a soft round badge (tapped, the plans open). */
export function PlanLock({ small = false }: { small?: boolean }) {
  return <span className={`plan-lock${small ? ' is-small' : ''}`} aria-hidden="true"><Icon name="crown" size={small ? 13 : 16} /></span>
}

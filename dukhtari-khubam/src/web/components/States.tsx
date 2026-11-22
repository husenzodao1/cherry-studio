'use client'

import type { ReactNode } from 'react'

import { ApiFailure } from '../api'
import { usePrefs } from '../prefs'
import { LensText } from './Lens'
import { Icon, type IconName } from './Icon'

export function Skeleton({ height = 120, radius }: { height?: number; radius?: number }) {
  return <div className="skeleton" style={{ height, borderRadius: radius }} aria-hidden="true" />
}

/** Placeholder rows; they only fade in if loading takes long, so quick screens never flash. */
export function Loading({ rows = 3 }: { rows?: number }) {
  const { t } = usePrefs()
  return (
    <div className="stack" role="status" aria-label={t('state.loading')}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={i === 0 ? 180 : 84} />)}
    </div>
  )
}

/** Messages without a box: an icon and a short line, centred in the space. */
function Note({ icon, title, role, children }: { icon: IconName; title: string; role?: string; children?: ReactNode }) {
  return (
    <div className="note" role={role}>
      <span className="note-icon"><Icon name={icon} size={26} /></span>
      <span className="note-title">{title}</span>
      {children}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = usePrefs()
  const e = error instanceof ApiFailure ? error : null
  const message =
    e?.code === 'not_configured' ? t('state.not_configured')
      : e?.code === 'network' ? t('state.offline')
        : e?.status === 404 ? e.message
          : e?.code === 'auth_required' ? t('state.signin_needed')
            : t('state.error')
  return (
    <Note icon="alert" title={message} role="alert">
      {onRetry && e?.status !== 404 ? <button className="btn btn-soft" onClick={onRetry}>{t('action.retry')}</button> : null}
    </Note>
  )
}

/** Nothing to show (no results, nothing saved…): the words under a magnifying glass that searches them. */
export function Empty({ title, children }: { title: string; icon?: IconName; children?: ReactNode }) {
  return (
    <div className="note note-empty" role="status">
      <LensText text={title} />
      {children}
    </div>
  )
}

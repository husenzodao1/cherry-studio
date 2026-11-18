'use client'

import type { ReactNode } from 'react'

import { ApiFailure } from '../api'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

export function Skeleton({ height = 120, radius }: { height?: number; radius?: number }) {
  return <div className="skeleton" style={{ height, borderRadius: radius }} aria-hidden="true" />
}

export function Loading({ rows = 3 }: { rows?: number }) {
  const { t } = usePrefs()
  return (
    <div className="stack" role="status" aria-label={t('state.loading')}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={i === 0 ? 180 : 84} />)}
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
    <div className="card state" role="alert">
      <Icon name="alert" size={26} />
      <b>{message}</b>
      {onRetry && e?.status !== 404 ? <button className="btn btn-soft" onClick={onRetry}>{t('action.retry')}</button> : null}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card state">
      <Icon name="sparkle" size={26} />
      <b>{title}</b>
      {children}
    </div>
  )
}

'use client'

import { Capacitor, registerPlugin } from '@capacitor/core'
import { useEffect, useState } from 'react'

import data from '../app-icons.json'
import { usePrefs } from '../prefs'

interface AppIconApi {
  setIcon(o: { id: string; ids: string[] }): Promise<void>
  getState(): Promise<{ id: string; rotate: boolean }>
  setRotate(o: { on: boolean; ids: string[] }): Promise<void>
}
const AppIcon = registerPlugin<AppIconApi>('AppIcon')

export interface AppIconDef { id: string; name: string; from: string; to: string; d: string }
export const APP_ICONS: AppIconDef[] = data.icons
const IDS = ['default', ...APP_ICONS.map((i) => i.id)]

/** One icon as it looks on the phone: the white drawing on its gradient, in a rounded square. */
export function AppIconPreview({ icon, size = 56 }: { icon: AppIconDef; size?: number }) {
  const gid = `aig-${icon.id}`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={icon.from} /><stop offset="1" stopColor={icon.to} /></linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${gid})`} />
      <path d="M0 14a14 14 0 0 1 14-14h20a14 14 0 0 1 14 14v4H0z" fill="#fff" opacity="0.08" />
      <g transform="translate(12 12)">
        <path d={icon.d} fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

/**
 * Settings (Android app): the launcher icon — the app's own, or one of 24 small line drawings — and
 * "change by itself", which puts the next icon in each time the app is closed.
 */
export function AppIconPicker() {
  const { t } = usePrefs()
  const [state, setState] = useState<{ id: string; rotate: boolean } | null>(null)
  const [native, setNative] = useState(false)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    setNative(true)
    AppIcon.getState().then(setState).catch(() => setState({ id: 'default', rotate: false }))
  }, [])
  if (!native || !state) return null
  const pick = async (id: string) => {
    setState({ ...state, id })
    await AppIcon.setIcon({ id, ids: IDS }).catch(() => undefined)
  }
  const rotate = async () => {
    const on = !state.rotate
    setState({ ...state, rotate: on })
    await AppIcon.setRotate({ on, ids: IDS }).catch(() => undefined)
  }
  return (
    <div className="glass card-pad stack" style={{ gap: 12 }}>
      <span className="eyebrow">{t('icon.title')}</span>
      <div className="icon-grid" role="radiogroup" aria-label={t('icon.title')}>
        <button type="button" role="radio" aria-checked={state.id === 'default'} className="icon-pick" onClick={() => pick('default')} aria-label={t('app.name')}>
          <img src="/icon.png" alt="" width={48} height={48} />
        </button>
        {APP_ICONS.map((icon) => (
          <button key={icon.id} type="button" role="radio" aria-checked={state.id === icon.id} className="icon-pick" onClick={() => pick(icon.id)} aria-label={icon.name}>
            <AppIconPreview icon={icon} size={48} />
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 10 }}>
        <span style={{ flex: 1 }}>{t('icon.rotate')}<span className="row-sub" style={{ display: 'block', fontSize: '0.8em', color: 'var(--muted)' }}>{t('icon.rotate_hint')}</span></span>
        <button type="button" role="switch" className="switch" aria-checked={state.rotate} aria-label={t('icon.rotate')} onClick={rotate} />
      </div>
    </div>
  )
}

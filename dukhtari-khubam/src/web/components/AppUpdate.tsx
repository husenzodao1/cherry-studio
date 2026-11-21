'use client'

import { Capacitor } from '@capacitor/core'
import { useEffect, useRef, useState } from 'react'

import { API_BASE } from '../offline/base'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/**
 * Inside the Android app: content updates arrive by themselves, but new app code needs a new APK.
 * When online, the built-in version is compared with /app-version.json on the site. The note can be
 * closed with its × or swiped away to either side; it stays closed for that version.
 */
const BUILT_IN = Number(process.env.NEXT_PUBLIC_APP_VERSION_CODE ?? 1)
const DISMISSED = 'dk.update_dismissed'

export interface LatestVersion { versionCode: number; versionName: string; url: string }

/** The newest published app version (null when it cannot be read). */
export async function latestVersion(): Promise<LatestVersion | null> {
  const base = API_BASE || window.location.origin
  try {
    const r = await fetch(`${base}/app-version.json`, { cache: 'no-cache' })
    if (!r.ok) return null
    const v = (await r.json()) as LatestVersion
    return { ...v, url: new URL(v.url, base).href }
  } catch {
    return null
  }
}

export function AppUpdate() {
  const { t } = usePrefs()
  const [v, setV] = useState<LatestVersion | null>(null)
  const [dx, setDx] = useState(0)
  const start = useRef<number | null>(null)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !API_BASE) return
    const check = () => latestVersion().then((n) => {
      let closed = 0
      try {
        closed = Number(localStorage.getItem(DISMISSED) ?? 0)
      } catch {
        /* storage blocked */
      }
      if (n && n.versionCode > BUILT_IN && n.versionCode !== closed) setV(n)
    })
    check()
    window.addEventListener('online', check)
    return () => window.removeEventListener('online', check)
  }, [])
  if (!v) return null
  const close = () => {
    try {
      localStorage.setItem(DISMISSED, String(v.versionCode))
    } catch {
      /* storage blocked: closed for this session */
    }
    setV(null)
  }
  return (
    <div className="update-note glass" role="status"
      style={{ transform: `translateX(${dx}px)`, opacity: 1 - Math.min(0.8, Math.abs(dx) / 260), transition: start.current === null ? 'transform 0.3s var(--ease), opacity 0.3s' : 'none' }}
      onPointerDown={(e) => { start.current = e.clientX }}
      onPointerMove={(e) => { if (start.current !== null) setDx(e.clientX - start.current) }}
      onPointerUp={() => {
        start.current = null
        if (Math.abs(dx) > 90) close()
        else setDx(0)
      }}
      onPointerCancel={() => { start.current = null; setDx(0) }}>
      <span className="update-icon" aria-hidden="true"><Icon name="install" size={18} /></span>
      <span className="update-text">{t('app.update')} <b>{v.versionName}</b></span>
      <a href={v.url} className="btn update-go" onPointerDown={(e) => e.stopPropagation()}>{t('app.update_action')}</a>
      <button type="button" className="update-x" aria-label={t('action.close')} onPointerDown={(e) => e.stopPropagation()} onClick={close}>
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}

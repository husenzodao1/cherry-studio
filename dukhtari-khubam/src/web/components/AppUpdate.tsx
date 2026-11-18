'use client'

import { useEffect, useState } from 'react'

import { API_BASE } from '../offline/base'
import { usePrefs } from '../prefs'

/**
 * Inside the Android app: content updates arrive by themselves, but new app code needs a new APK.
 * When online, compare the built-in version with /app-version.json on the site and offer the download.
 */
const BUILT_IN = Number(process.env.NEXT_PUBLIC_APP_VERSION_CODE ?? 1)

export function AppUpdate() {
  const { t } = usePrefs()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const native = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
    if (!native || !API_BASE) return
    const check = () =>
      fetch(`${API_BASE}/app-version.json`, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((v: { versionCode: number; url: string } | null) => {
          if (v && v.versionCode > BUILT_IN) setUrl(new URL(v.url, API_BASE).href)
        })
        .catch(() => undefined)
    check()
    window.addEventListener('online', check)
    return () => window.removeEventListener('online', check)
  }, [])
  if (!url) return null
  return (
    <a href={url} className="card card-pad row" role="status"
      style={{ position: 'fixed', left: 16, right: 16, top: 'max(12px, env(safe-area-inset-top))', zIndex: 60, textDecoration: 'none', background: 'var(--lilac)' }}>
      <span style={{ flex: 1 }}>{t('app.update')}</span>
      <span className="btn" style={{ minHeight: 36 }}>{t('app.update_action')}</span>
    </a>
  )
}

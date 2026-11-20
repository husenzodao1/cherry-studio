'use client'

import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'

import { useContent } from '../offline/content'
import { installAll, installState, keepInstalledFresh } from '../offline/install'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'
import { showToast } from './Toast'

/**
 * The "install" button in the home screen's top bar. On the website it downloads the Android app itself
 * (the APK file, straight from this site). In the app it keeps the newest lessons (pictures, audio,
 * files) on the phone for learning offline. It knows when everything is already there and says so instead of
 * installing again; a small dot shows when new lessons have files to fetch.
 */
export function InstallButton() {
  const [native, setNative] = useState<boolean | null>(null)
  useEffect(() => setNative(Capacitor.isNativePlatform()), [])
  if (native === null) return <span className="icon-btn install-btn" aria-hidden="true" />
  return native ? <OfflineInstall /> : <AppDownload />
}

/**
 * Website: the app's APK is downloaded at once, straight from the GitHub repository's raw file (no GitHub
 * page opens and no Vercel bandwidth is used); the browser then offers to install it.
 */
const APK_URL = process.env.NEXT_PUBLIC_APK_URL ?? '/download/dukhtari-khubam.apk'

function AppDownload() {
  const { t } = usePrefs()
  return (
    <a href={APK_URL} download="dukhtari-khubam.apk" className="icon-btn install-btn" aria-label={t('install.app')}
      onClick={() => showToast(t('install.app_started'), 'install', 4200)}>
      <span className="install-glyph"><Icon name="install" /></span>
      <span className="install-dot" aria-hidden="true" />
    </a>
  )
}

function OfflineInstall() {
  const { t } = usePrefs()
  const { bundle } = useContent()
  const [state, setState] = useState<{ installed: boolean; chosen: boolean } | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    if (!bundle) return
    let alive = true
    keepInstalledFresh(bundle)
      .catch(() => undefined)
      .then(() => installState(bundle))
      .then((s) => alive && setState(s))
    return () => {
      alive = false
    }
  }, [bundle])

  const press = async () => {
    if (!bundle || busy !== null) return
    const now = await installState(bundle)
    if (now.installed) {
      showToast(t('install.done_before'), 'check')
      return
    }
    if (navigator.onLine === false) {
      showToast(t('install.need_online'), 'wifiOff')
      return
    }
    showToast(t('install.started'), 'install', 4200)
    setBusy(0)
    const ok = await installAll(bundle, (done, total) => setBusy(total ? done / total : 1))
    setBusy(null)
    setState({ installed: ok, chosen: true })
    showToast(t(ok ? 'install.finished' : 'install.partly'), ok ? 'check' : 'info')
  }

  const fresh = !state?.installed
  return (
    <button type="button" className={`icon-btn install-btn${busy !== null ? ' is-busy' : ''}`} onClick={press}
      aria-label={t('install.title')} style={busy !== null ? { ['--p' as string]: busy } : undefined}>
      <span className="install-glyph"><Icon name="install" /></span>
      {busy !== null ? <svg className="install-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20" /></svg> : null}
      {fresh && busy === null && state ? <span className="install-dot" aria-hidden="true" /> : null}
    </button>
  )
}

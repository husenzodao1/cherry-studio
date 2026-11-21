'use client'

import { Capacitor } from '@capacitor/core'
import { useState } from 'react'

import { API_BASE } from '../offline/base'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'
import { RateSheet } from './RateSheet'
import { showToast } from './Toast'
import { SITE } from '../site'


/** Where a friend gets the app: the site's APK page from the app, this site from a browser. */
function appLink(): string {
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : SITE)
  return `${base.replace(/\/$/, '')}/download/dukhtari-khubam.apk`
}

/**
 * Two boxes under "About the app": rating the app (a sheet with five 3D faces and a comment, RateSheet)
 * and sharing it — the system share sheet lists every way to send
 * it (messengers, SMS, e-mail, Bluetooth, copy…).
 */
export function RateShare() {
  const { t } = usePrefs()
  const [rating, setRating] = useState(false)
  const share = async () => {
    const text = t('share.text')
    const url = appLink()
    try {
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: t('app.name'), text, url, dialogTitle: t('share.title') })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: t('app.name'), text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      showToast(t('share.copied'), 'copy')
    } catch {
      /* closed without sending */
    }
  }
  return (
    <div className="rate-share">
      <button type="button" className="glass rate-box" onClick={() => setRating(true)}>
        <span className="rate-stars" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <Icon key={i} name="star" size={18} fill="currentColor" style={{ ['--i' as string]: i }} />)}</span>
        <b>{t('rate.title')}</b>
        <span className="row-sub">{t('rate.sub')}</span>
      </button>
      <button type="button" className="glass rate-box" onClick={share}>
        <span className="share-orb" aria-hidden="true"><Icon name="share" size={20} /></span>
        <b>{t('share.title')}</b>
        <span className="row-sub">{t('share.sub')}</span>
      </button>
      {rating ? <RateSheet onClose={() => setRating(false)} /> : null}
    </div>
  )
}

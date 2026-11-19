'use client'

import { useState } from 'react'

import { formatDay } from '@/lib/progress'

import { drawCertificate, savePicture } from '../offline/cards'
import { useLearner, type Learner } from '../offline/learner'
import type { UiKey } from '../i18n'
import { usePrefs } from '../prefs'
import { Dots } from './Busy'
import { Icon } from './Icon'

const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'dukhtari-khubam'

/** Saves or shares the certificate of a finished course as a picture. */
export function CertificateButton({ course, school, date, className = 'btn btn-block' }: { course: string; school: string; date: string; className?: string }) {
  const { t, locale } = usePrefs()
  const { learner } = useLearner()
  const [busy, setBusy] = useState(false)
  if (!learner) return null
  const make = async () => {
    setBusy(true)
    try {
      const png = await drawCertificate({
        heading: t('cert.title'), awardedTo: t('cert.awarded'), forCourse: t('cert.for'), brand: t('app.name'),
        name: learner.name, course, school, date: formatDay(date, locale)
      })
      await savePicture(png, `certificate-${slug(course)}.png`, t('cert.title'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" className={className} onClick={make} disabled={busy} aria-busy={busy}>
      <Icon name="trophy" size={18} /> {busy ? <>{t('cert.saving')}<Dots /></> : t('cert.title')}
    </button>
  )
}

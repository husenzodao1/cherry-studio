'use client'

import { useState } from 'react'

import { formatDay } from '@/lib/progress'

import { drawCertificate, drawCodeCard, savePicture } from '../offline/cards'
import { useLearner } from '../offline/learner'
import { usePrefs } from '../prefs'
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
    <button type="button" className={className} onClick={make} disabled={busy}>
      <Icon name="trophy" size={18} /> {busy ? t('cert.saving') : t('cert.title')}
    </button>
  )
}

/** Saves the personal code as a picture, so it is kept in the phone's gallery. */
export function CodeImageButton({ className = 'btn btn-soft btn-block' }: { className?: string }) {
  const { t } = usePrefs()
  const { learner } = useLearner()
  const [busy, setBusy] = useState(false)
  if (!learner) return null
  const make = async () => {
    setBusy(true)
    try {
      const png = await drawCodeCard({ title: t('code.card_title'), hint: t('code.card_hint'), brand: t('app.name'), name: learner.name, code: learner.code })
      await savePicture(png, 'dukhtari-khubam-code.png', t('code.card_title'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" className={className} onClick={make} disabled={busy}>
      <Icon name="down" size={18} /> {busy ? t('cert.saving') : t('code.save_image')}
    </button>
  )
}

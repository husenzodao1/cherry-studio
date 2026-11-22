'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { formatDay } from '@/lib/progress'

import { drawCertificate, saveToGallery, savePicture } from '../offline/cards'
import { useLearner } from '../offline/learner'
import { usePrefs } from '../prefs'
import { Dots } from './Busy'
import { Icon } from './Icon'
import { say } from './Mascot'
import { RateSheet } from './RateSheet'
import { showToast } from './Toast'

const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'dukhtari-khubam'

/**
 * The end of a stage, over the whole screen: congratulations, her certificate (drawn on the phone),
 * "Save" to the gallery and "Share with friends". Closing it brings the rating sheet.
 */
export function StageDone({ course, school, onClose }: { course: string; school: string; onClose: () => void }) {
  const { t, locale } = usePrefs()
  const { learner } = useLearner()
  const [png, setPng] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'share' | null>(null)
  const [rating, setRating] = useState(false)

  useEffect(() => {
    let gone = false
    let made: string | null = null
    say('stageDone')
    drawCertificate({
      heading: t('cert.title'), awardedTo: t('cert.awarded'), forCourse: t('cert.for'), brand: t('app.name'),
      name: learner?.name ?? '', course, school, date: formatDay(new Date().toISOString(), locale)
    }).then((b) => {
      if (gone) return
      made = URL.createObjectURL(b)
      setPng(b)
      setUrl(made)
    }).catch(() => undefined)
    return () => { gone = true; if (made) URL.revokeObjectURL(made) }
    // drawn once, when the stage is finished
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const file = `certificate-${slug(course)}.png`
  const save = async () => {
    if (!png) return
    setBusy('save')
    try {
      await saveToGallery(png, file)
      showToast(t('done.saved'), 'check')
    } catch {
      await savePicture(png, file, t('cert.title')).catch(() => undefined)
    } finally {
      setBusy(null)
    }
  }
  const share = async () => {
    if (!png) return
    setBusy('share')
    try { await savePicture(png, file, t('cert.title')) } catch { /* the share sheet was closed */ } finally { setBusy(null) }
  }

  if (rating) return <RateSheet onClose={onClose} />
  return createPortal(
    <div className="stage-done" role="dialog" aria-modal="true" aria-label={t('done.title')}>
      <button type="button" className="stage-done-x" aria-label={t('action.close')} onClick={() => setRating(true)}><Icon name="x" size={18} /></button>
      <img className="stage-done-art" src="/assets/3d/glass-lotus.webp" alt="" aria-hidden="true" />
      <h2 className="stage-done-title">{t('done.title')}</h2>
      <p className="muted stage-done-sub">{t('done.sub')}</p>
      <div className="stage-done-cert">{url ? <img src={url} alt={t('cert.title')} /> : <Dots />}</div>
      <div className="stage-done-actions">
        <button type="button" className="btn btn-lg" onClick={save} disabled={!png || !!busy} aria-busy={busy === 'save'}>
          <Icon name="install" size={18} /> {t('done.save')}
        </button>
        <button type="button" className="btn btn-soft btn-lg" onClick={share} disabled={!png || !!busy} aria-busy={busy === 'share'}>
          <Icon name="share" size={18} /> {t('done.share')}
        </button>
      </div>
    </div>,
    document.body
  )
}

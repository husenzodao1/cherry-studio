'use client'

import { useEffect, useMemo, useState } from 'react'

import type { Lesson } from '../offline/content'
import { courseMediaUrls, downloadAll, onMobileData, storedCount } from '../offline/media'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/** Keeps a whole course on the phone: lesson texts are already there; this fetches its pictures and audio. */
export function CourseDownload({ lessons }: { lessons: Lesson[] }) {
  const { t } = usePrefs()
  const urls = useMemo(() => courseMediaUrls(lessons), [lessons])
  const [have, setHave] = useState<number | null>(null)
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    storedCount(urls).then((n) => alive && setHave(n))
    return () => {
      alive = false
    }
  }, [urls])
  if (!urls.length || have === null) return null
  const ready = have >= urls.length
  const start = async () => {
    if (navigator.onLine === false) {
      setNote(t('download.offline'))
      return
    }
    if (onMobileData() && !confirm(t('download.mobile'))) return
    setNote(null)
    setBusy({ done: have, total: urls.length })
    const n = await downloadAll(urls, (done, total) => setBusy({ done, total }))
    setHave(n)
    setBusy(null)
  }
  return (
    <div className="glass list-row" style={{ marginTop: 14 }}>
      <span className="row-icon"><Icon name={ready ? 'check' : 'down'} /></span>
      <span className="row-main">
        <b>{ready ? t('download.ready') : t('download.course')}</b>
        <span className="row-sub">{busy ? t('download.progress').replace('{done}', String(busy.done)).replace('{total}', String(busy.total)) : note ?? t('download.files').replace('{n}', String(urls.length))}</span>
        {busy ? <div className="progress" style={{ marginTop: 8 }}><span style={{ width: `${(busy.done / Math.max(1, busy.total)) * 100}%` }} /></div> : null}
      </span>
      {!ready && !busy ? <button type="button" className="play-btn" style={{ border: 0, cursor: 'pointer' }} aria-label={t('download.course')} onClick={start}><Icon name="down" size={20} /></button> : null}
    </div>
  )
}

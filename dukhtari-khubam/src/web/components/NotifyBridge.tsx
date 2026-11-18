'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useContent } from '../offline/content'
import { useLearner } from '../offline/learner'
import { canNotify, onNotificationTap, readNotify, scheduleDaily } from '../offline/notify'
import { usePrefs } from '../prefs'

/** Keeps the daily notifications' texts current and routes taps to the right screen (Android app only). */
export function NotifyBridge() {
  const router = useRouter()
  const { t } = usePrefs()
  const { bundle } = useContent()
  const { learner, progress } = useLearner()
  const [prefsVersion, setPrefsVersion] = useState(0)

  useEffect(() => {
    if (!canNotify()) return
    let off: (() => void) | undefined
    onNotificationTap((href) => router.push(href)).then((f) => (off = f))
    const bump = () => setPrefsVersion((v) => v + 1)
    window.addEventListener('dk-notify', bump)
    return () => {
      off?.()
      window.removeEventListener('dk-notify', bump)
    }
  }, [router])

  const lastId = progress.last?.lesson
  const last = lastId && !progress.lessons[lastId]?.done ? bundle?.lessons[lastId] : undefined
  const inspiration = bundle?.inspiration?.body ?? t('home.quote')
  useEffect(() => {
    if (!canNotify() || !learner) return
    const timer = setTimeout(() => {
      scheduleDaily(readNotify(), {
        lesson: {
          title: t('notify.lesson_title'),
          body: last ? t('notify.lesson_named').replace('{title}', last.title) : t('notify.lesson_body'),
          href: last ? `/lesson?id=${last.id}` : '/schools'
        },
        inspiration: { title: t('notify.inspiration_title'), body: inspiration }
      }).catch(() => undefined)
    }, 1500)
    return () => clearTimeout(timer)
  }, [learner, last, inspiration, t, prefsVersion])

  return null
}

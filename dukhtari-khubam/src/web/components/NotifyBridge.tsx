'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useContent } from '../offline/content'
import { useLearner } from '../offline/learner'
import { streak } from '@/lib/progress'

import { canNotify, lines, onNotificationTap, readNotify, scheduleDaily } from '../offline/notify'
import { usePrefs } from '../prefs'

/** Keeps the planned notifications' texts current (panel texts, her name, lesson and streak) and routes taps (Android app only). */
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
  const days = progress.days
  const birthday = progress.birthday
  useEffect(() => {
    if (!canNotify() || !learner) return
    const timer = setTimeout(() => {
      // a lesson to continue gets the lines that name it; otherwise the general ones
      const bodies = lines(t(last ? 'notify.lesson.bodies_named' : 'notify.lesson.bodies'))
      scheduleDaily(readNotify(), {
        lessonTitles: lines(t('notify.lesson.titles')),
        lessonBodies: bodies,
        lessonHref: last ? `/lesson?id=${last.id}` : '/schools',
        inspiration: { title: t('notify.inspiration_title'), body: inspiration },
        streak: { titles: lines(t('notify.streak.titles')), bodies: lines(t('notify.streak.bodies')), leftLabel: t('notify.streak.left'), channel: t('notify.streak.channel') },
        morning: lines(t('notify.morning')),
        vars: { name: learner.name.split(/\s+/)[0] ?? '', lesson: last?.title ?? '', streak: streak(days) },
        lastDay: [...days].sort().at(-1) ?? '',
        birthday: birthday ? { date: birthday, lines: lines(t('notify.birthday')) } : undefined
      }).catch(() => undefined)
    }, 1500)
    return () => clearTimeout(timer)
  }, [learner, last, inspiration, days, birthday, t, prefsVersion])

  return null
}

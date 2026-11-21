'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useLearner } from '../offline/learner'
import { consultant, supportToken, unreadReplies } from '../offline/support'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/** Where a consultant answers: the panel, straight on support. */
export const INBOX = '/admin?tab=support'

/**
 * Whether her account is a consultant's (a staff account tied to her profile), and how many
 * conversations wait for an answer — checked on start, when back online and every 10 minutes.
 */
export function useConsultant(): { consultant: boolean; waiting: number } {
  const { learner } = useLearner()
  const code = learner?.code
  const [state, setState] = useState({ consultant: false, waiting: 0 })
  useEffect(() => {
    if (!code) return
    const check = async () => {
      if (navigator.onLine === false) return
      const r = await consultant(code).catch(() => null)
      if (r) setState({ consultant: r.consultant, waiting: r.waiting ?? 0 })
    }
    check()
    window.addEventListener('online', check)
    const timer = setInterval(check, 10 * 60 * 1000)
    return () => {
      window.removeEventListener('online', check)
      clearInterval(timer)
    }
  }, [code])
  return state
}

/**
 * A small banner when support has answered her; for a consultant, also when users' questions wait
 * (checked on start, when back online and every 10 minutes).
 */
export function SupportWatch() {
  const { t } = usePrefs()
  const path = usePathname() ?? '/'
  const [unread, setUnread] = useState(0)
  const [seen, setSeen] = useState(false)
  const staff = useConsultant()
  useEffect(() => {
    const check = async () => {
      const token = supportToken(false)
      if (!token || navigator.onLine === false) return
      setUnread(await unreadReplies(token).catch(() => 0))
    }
    check()
    window.addEventListener('online', check)
    const timer = setInterval(check, 10 * 60 * 1000)
    return () => {
      window.removeEventListener('online', check)
      clearInterval(timer)
    }
  }, [path])
  if (/^\/(support|admin)(\/|$)/.test(path)) return null
  if (unread) {
    return (
      <Link href="/support" className="glass support-banner" onClick={() => setUnread(0)}>
        <Icon name="bell" size={20} /> <span style={{ flex: 1 }}>{t('support.new_reply')}</span> <Icon name="forward" size={18} />
      </Link>
    )
  }
  if (staff.consultant && staff.waiting && !seen) {
    return (
      <Link href={INBOX} className="glass support-banner" onClick={() => setSeen(true)}>
        <Icon name="bell" size={20} /> <span style={{ flex: 1 }}>{t('support.new_question')} · {staff.waiting}</span> <Icon name="forward" size={18} />
      </Link>
    )
  }
  return null
}

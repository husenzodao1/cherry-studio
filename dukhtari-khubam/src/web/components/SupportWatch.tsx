'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { supportToken, unreadReplies } from '../offline/support'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/** A small banner when support has answered (checked on start, when back online and every 10 minutes). */
export function SupportWatch() {
  const { t } = usePrefs()
  const path = usePathname() ?? '/'
  const [unread, setUnread] = useState(0)
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
  if (!unread || /^\/(support|admin)(\/|$)/.test(path)) return null
  return (
    <Link href="/support" className="glass support-banner" onClick={() => setUnread(0)}>
      <Icon name="bell" size={20} /> <span style={{ flex: 1 }}>{t('support.new_reply')}</span> <Icon name="forward" size={18} />
    </Link>
  )
}

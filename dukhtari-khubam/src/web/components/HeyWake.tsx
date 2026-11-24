'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { hey, native } from '../offline/hey'

/**
 * Opened by "Эй Маҳлиё" (or the phone's assistant button): straight to the listening screen — at once when
 * the app was closed, and as soon as it is called while the app is open.
 */
export function HeyWake() {
  const router = useRouter()
  const path = usePathname()
  useEffect(() => {
    if (!native()) return
    let remove: (() => void) | null = null
    void hey().then(async ({ p }) => {
      if ((await p.takeWake()).woke && path !== '/voice') router.push('/voice')
      const h = await p.addListener('wake', () => { if (window.location.pathname !== '/voice') router.push('/voice') })
      remove = () => void h.remove()
    }).catch(() => undefined)
    return () => remove?.()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

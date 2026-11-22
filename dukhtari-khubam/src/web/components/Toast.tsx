'use client'

import { useEffect, useState } from 'react'

import { Icon, type IconName } from './Icon'

const EVENT = 'dk-toast'
interface Note { id: number; text: string; icon: IconName; ms: number }

/** A short note in a small glass pill near the top of the screen (one at a time). */
export function showToast(text: string, icon: IconName = 'info', ms = 3200) {
  window.dispatchEvent(new CustomEvent<Omit<Note, 'id'>>(EVENT, { detail: { text, icon, ms } }))
}

export function Toaster() {
  const [note, setNote] = useState<Note | null>(null)
  useEffect(() => {
    let n = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const on = (e: Event) => {
      const d = (e as CustomEvent<Omit<Note, 'id'>>).detail
      const id = ++n
      setNote({ ...d, id })
      clearTimeout(timer)
      timer = setTimeout(() => setNote((cur) => (cur?.id === id ? null : cur)), d.ms)
    }
    window.addEventListener(EVENT, on)
    return () => {
      window.removeEventListener(EVENT, on)
      clearTimeout(timer)
    }
  }, [])
  if (!note) return null
  return (
    <div key={note.id} className="toast glass" role="status" aria-live="polite">
      <Icon name={note.icon} size={18} />
      <span>{note.text}</span>
    </div>
  )
}

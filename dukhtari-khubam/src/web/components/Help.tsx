'use client'

import { useId, useState } from 'react'

import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/** The “!” help marker (spec Part II §5): short label, explanation on demand, managed in the CMS. */
export function Help({ helpKey, label }: { helpKey: string; label: string }) {
  const { help, t } = usePrefs()
  const [open, setOpen] = useState(false)
  const id = useId()
  const entry = help[helpKey]
  if (!entry) return null
  return (
    <>
      <button type="button" className="help-btn" aria-expanded={open} aria-controls={id}
        aria-label={`${label}: ${t('action.more')}`} onClick={() => setOpen((o) => !o)}>!</button>
      {open ? (
        <div id={id} role="note" className="popover" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <span style={{ flex: 1 }}>{entry.title ? <b>{entry.title}. </b> : null}{entry.body}</span>
          <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} aria-label={t('action.close')} onClick={() => setOpen(false)}>
            <Icon name="x" size={16} />
          </button>
        </div>
      ) : null}
    </>
  )
}

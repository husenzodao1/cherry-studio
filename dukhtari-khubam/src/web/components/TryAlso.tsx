'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { hideTryAlso, untried, type NewFeature } from '../offline/tried'
import { usePlan } from '../plans'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/** On the home screen of a learner with a plan: the newer features her plan gives that she has not tried. */
export function TryAlso() {
  const { t } = usePrefs()
  const { plan } = usePlan()
  const [list, setList] = useState<NewFeature[]>([])
  useEffect(() => setList(untried(plan)), [plan])
  if (!list.length) return null
  return (
    <section className="glass try-also" aria-label={t('pw.try_title')}>
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <Icon name="sparkle" size={16} />
        <b className="grow">{t('pw.try_title')}</b>
        <button type="button" className="try-also-x" aria-label={t('action.close')} onClick={() => { hideTryAlso(); setList([]) }}><Icon name="x" size={14} /></button>
      </div>
      <div className="try-also-row">
        {list.map((f) => (
          <Link key={f.id} href={f.href} className="try-also-chip"><span aria-hidden="true">{f.emoji}</span>{t(f.label as 'pw.row_hey')}</Link>
        ))}
      </div>
    </section>
  )
}

'use client'

import { useEffect, useState } from 'react'

import { NavMap } from '@/web/components/NavMap'
import { browserSupabase } from '@/web/supabase-browser'
import { usePrefs } from '@/web/prefs'

interface Where {
  name: string; kind: 'sos' | 'walk'; open: boolean; safe: boolean | null; lat: number | null; lng: number | null
  accuracy: number | null; battery: number | null; due_at: string | null; started_at: string; updated_at: string
}

const EVERY_MS = 15_000

/**
 * The live map her people open from the WhatsApp message (/where?t=…): her first name, where she is now, how
 * long ago it was sent and her battery — while the alert is open. No account is needed; the token is the key.
 */
export default function WherePage() {
  const { t } = usePrefs()
  const [w, setW] = useState<Where | null>(null)
  const [missing, setMissing] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t') ?? ''
    const sb = browserSupabase()
    if (!/^[0-9a-f]{24}$/.test(token) || !sb) { setMissing(true); return }
    let gone = false
    const load = async () => {
      const { data } = await sb.rpc('api_sos_where', { p_token: token })
      if (gone) return
      if (!data) setMissing(true)
      else setW(data as Where)
      setNow(Date.now())
    }
    void load()
    const id = setInterval(() => void load(), EVERY_MS)
    return () => { gone = true; clearInterval(id) }
  }, [])

  const ago = w ? Math.max(0, Math.round((now - Date.parse(w.updated_at)) / 60_000)) : 0
  const here = w?.lat !== null && w?.lng !== null && w ? ([w.lat, w.lng] as [number, number]) : null
  return (
    <div className="section stack" style={{ gap: 12, paddingTop: 'calc(env(safe-area-inset-top) + 18px)' }}>
      {missing ? <div className="glass card-pad muted">{t('where.missing')}</div> : !w ? <div className="skeleton" style={{ height: 300, borderRadius: 24 }} /> : (
        <>
          <section className={`glass card-pad sos-live is-${w.kind}`}>
            {w.open ? <span className="sos-pulse" aria-hidden="true" /> : null}
            <b style={{ fontSize: '1.2rem' }}>
              {w.open ? t(w.kind === 'walk' ? 'where.walking' : 'where.help').replace('{name}', w.name) : t('where.safe').replace('{name}', w.name)}
            </b>
            {w.open ? (
              <span className="muted">
                {(ago < 1 ? t('where.just_now') : t('where.ago').replace('{n}', String(ago)))}
                {w.battery !== null ? ` · 🔋 ${w.battery}%` : ''}
                {w.accuracy ? ` · ±${Math.round(w.accuracy)} m` : ''}
              </span>
            ) : null}
          </section>
          {w.open && here ? (
            <>
              <div className="where-map"><NavMap line={null} me={here} heading={null} to={null} following /></div>
              <a className="btn btn-block" href={`https://www.google.com/maps/search/?api=1&query=${here[0]},${here[1]}`} target="_blank" rel="noopener noreferrer">{t('where.open_maps')}</a>
            </>
          ) : w.open ? <div className="glass card-pad muted">{t('where.no_place')}</div> : null}
          {w.open && w.kind === 'sos' ? <a className="btn btn-soft btn-block" href="tel:112">{t('where.call_112')}</a> : null}
        </>
      )}
    </div>
  )
}

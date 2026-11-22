'use client'

import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { isMeaningful } from '@/lib/sanity'

import { accountAuth } from '../offline/accountAuth'
import type { UiKey } from '../i18n'
import { usePrefs } from '../prefs'
import { onBack } from './BackButton'
import { GoIcon } from './Busy'
import { buzz } from './PinPad'

/** The five faces, worst to best: body colours (light, dark) and the expression drawn on them. */
const FACES = [
  { key: 'rate.1', a: '#ff9a8a', b: '#e2453f' },
  { key: 'rate.2', a: '#ffc58a', b: '#ef8a3a' },
  { key: 'rate.3', a: '#ffe58c', b: '#f2b632' },
  { key: 'rate.4', a: '#ffe27a', b: '#f0a92a' },
  { key: 'rate.5', a: '#ffd0e0', b: '#f2769f' }
] as const

/** A glossy, rounded 3D-looking face (gradient body, rim shade, highlight, soft shadow). */
export function Face({ n }: { n: 1 | 2 | 3 | 4 | 5 }) {
  const f = FACES[n - 1]
  const id = `face-${n}`
  const ink = '#5a2a1e'
  return (
    <svg viewBox="0 0 64 64" className={`face face-${n}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-b`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.18" stopColor={f.a} />
          <stop offset="1" stopColor={f.b} />
        </radialGradient>
        <radialGradient id={`${id}-s`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#3a1830" stopOpacity="0.3" />
          <stop offset="1" stopColor="#3a1830" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="60" rx="20" ry="3.4" fill={`url(#${id}-s)`} />
      <circle cx="32" cy="30" r="26" fill={`url(#${id}-b)`} />
      <circle cx="32" cy="30" r="25.2" fill="none" stroke="#000" strokeOpacity="0.08" strokeWidth="1.6" />
      <ellipse cx="23" cy="15" rx="9" ry="5" fill="#fff" opacity="0.55" transform="rotate(-24 23 15)" />
      <g className="face-feat" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {n === 1 ? (
          <>
            <path d="M17 21l8 4M47 21l-8 4" />
            <circle cx="23" cy="29" r="2.6" fill={ink} stroke="none" /><circle cx="41" cy="29" r="2.6" fill={ink} stroke="none" />
            <path d="M22 44c5-5 15-5 20 0" />
          </>
        ) : n === 2 ? (
          <>
            <path d="M18 24l6-3M46 24l-6-3" />
            <circle cx="23" cy="29" r="2.6" fill={ink} stroke="none" /><circle cx="41" cy="29" r="2.6" fill={ink} stroke="none" />
            <path d="M24 43c4-3 12-3 16 0" />
            <path className="face-tear" d="M44 34c0 0-3 4-3 6a3 3 0 0 0 6 0c0-2-3-6-3-6z" fill="#7cc8ff" stroke="none" />
          </>
        ) : n === 3 ? (
          <>
            <circle cx="23" cy="27" r="2.8" fill={ink} stroke="none" /><circle cx="41" cy="27" r="2.8" fill={ink} stroke="none" />
            <path d="M24 41h16" />
          </>
        ) : n === 4 ? (
          <>
            <path d="M19 28c2-3 6-3 8 0M37 28c2-3 6-3 8 0" />
            <path d="M21 37c5 7 17 7 22 0" />
            <ellipse cx="16" cy="35" rx="4" ry="2.4" fill="#ff7f9c" stroke="none" opacity="0.45" />
            <ellipse cx="48" cy="35" rx="4" ry="2.4" fill="#ff7f9c" stroke="none" opacity="0.45" />
          </>
        ) : (
          <>
            <path className="face-heart" d="M23 31c-5-3-7-6-5-8.5 1.6-2 4-1 5 .8 1-1.8 3.4-2.8 5-.8 2 2.5 0 5.5-5 8.5z" fill="#e8336b" stroke="none" />
            <path className="face-heart" d="M41 31c-5-3-7-6-5-8.5 1.6-2 4-1 5 .8 1-1.8 3.4-2.8 5-.8 2 2.5 0 5.5-5 8.5z" fill="#e8336b" stroke="none" />
            <path d="M20 37c4 9 20 9 24 0z" fill="#8a2b3e" stroke={ink} />
            <path d="M25 42.5c4 2 10 2 14 0" stroke="#ff8fa8" strokeWidth="2.2" />
          </>
        )}
      </g>
    </svg>
  )
}

/**
 * "Rate the app": a sheet from the bottom (not the whole screen) with five 3D faces from bad to great,
 * each with its own little animation when chosen, and a comment; after sending, a thank-you.
 * Ratings go to Supabase (api_rate_app) without any personal data.
 */
export function RateSheet({ onClose }: { onClose: () => void }) {
  const { t } = usePrefs()
  const [stars, setStars] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<'form' | 'thanks'>('form')
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => onBack(onClose), [onClose])
  useEffect(() => {
    if (state !== 'thanks') return
    const timer = setTimeout(onClose, 2600)
    return () => clearTimeout(timer)
  }, [state, onClose])

  const send = async () => {
    if (!stars || busy) return
    if (!isMeaningful(comment)) return setNote(t('sanity.meaningless'))
    if (navigator.onLine === false) return setNote(t('install.need_online'))
    setBusy(true)
    setNote(null)
    const sb = accountAuth()
    const { error } = sb
      ? await sb.rpc('api_rate_app', {
        p_stars: stars, p_comment: comment.trim(), p_version: process.env.NEXT_PUBLIC_APP_VERSION_NAME ?? 'web',
        p_platform: Capacitor.isNativePlatform() ? 'android' : 'web'
      })
      : { error: new Error('not configured') }
    setBusy(false)
    if (error) return setNote(t('state.error'))
    buzz(12)
    setState('thanks')
  }

  return createPortal(
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet glass rate-sheet" role="dialog" aria-modal="true" aria-label={t('rate.title')} onClick={(e) => e.stopPropagation()}>
        <span className="sheet-grip" aria-hidden="true" />
        {state === 'thanks' ? (
          <div className="rate-thanks" role="status">
            <span className="rate-thanks-face"><Face n={5} /></span>
            <b>{t('rate.thanks')}</b>
            <span className="row-sub">{t('rate.thanks_sub')}</span>
          </div>
        ) : (
          <>
            <h2 className="rate-title">{t('rate.title')}</h2>
            <p className="row-sub" style={{ margin: 0, textAlign: 'center' }}>{t('rate.ask')}</p>
            <div className={`rate-faces${stars ? ' has-pick' : ''}`} role="radiogroup" aria-label={t('rate.title')}>
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button key={`${n}-${stars === n}`} type="button" role="radio" aria-checked={stars === n} className="rate-face" style={{ ['--i' as string]: n }}
                  onClick={() => { setStars(n); buzz(8) }}>
                  <Face n={n} />
                  <span>{t(FACES[n - 1].key as UiKey)}</span>
                </button>
              ))}
            </div>
            <textarea className="input rate-comment" rows={3} maxLength={1000} value={comment} placeholder={t('rate.comment')}
              aria-label={t('rate.comment')} onChange={(e) => setComment(e.target.value)} />
            {note ? <p className="row-sub" role="status" style={{ margin: 0, textAlign: 'center', color: 'var(--bad)' }}>{note}</p> : null}
            <button type="button" className="btn btn-block btn-lg" disabled={!stars || busy} aria-busy={busy} onClick={send}>
              {t('rate.send')} <GoIcon busy={busy} />
            </button>
            <button type="button" className="sheet-cancel" onClick={onClose}>{t('pin.cancel')}</button>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

'use client'

import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react'

import { useLearner } from '../offline/learner'
import { checkPin, clearPin, hasPin, waitLeft } from '../offline/pin'
import { checkPassword, unlockWithPhone } from '../offline/unlock'
import { usePrefs } from '../prefs'
import { PinPad } from './PinPad'

const AWAY_MS = 60_000

/**
 * With a PIN set, the app opens behind the PIN pad, and again when it comes back after more than a
 * minute away. "Forgot PIN" asks the phone's own lock, or the login password, and then removes the PIN.
 */
export function AppLock() {
  const { t } = usePrefs()
  const { learner } = useLearner()
  const [locked, setLocked] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [password, setPassword] = useState('')

  // before the first paint, so nothing behind the lock flashes
  useLayoutEffect(() => {
    if (hasPin()) setLocked(true)
  }, [])
  useEffect(() => {
    let hiddenAt = 0
    const onVisible = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS && hasPin()) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (!locked) return null
  const open = () => {
    setLocked(false)
    setHint(null)
    setAsking(false)
    setPassword('')
  }
  const forgot = async () => {
    setHint(null)
    const r = await unlockWithPhone(t('settings.unlock_title'), t('pin.forgot'))
    if (r === 'ok') {
      clearPin()
      open()
    } else if (r === 'password') {
      if (learner?.username) setAsking(true)
      else setHint(t('pin.reinstall'))
    }
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const r = await checkPassword(learner!.username!, password)
    if (r === 'ok') {
      clearPin()
      open()
    } else setHint(t(r === 'invalid' ? 'start.invalid_login' : r === 'locked' ? 'start.locked' : 'start.need_online'))
  }

  return (
    <PinPad title={t('pin.enter')} hint={hint} onDone={async (pin) => {
      const r = await checkPin(pin)
      if (r === 'ok') {
        open()
        return true
      }
      setHint(r === 'wait' ? t('pin.wait').replace('{n}', String(waitLeft())) : t('pin.wrong'))
      return false
    }}>
      {asking ? (
        <form className="pin-password" onSubmit={submit}>
          <input className="input" type="password" autoComplete="current-password" placeholder={t('settings.unlock_password')}
            aria-label={t('settings.unlock_password')} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn" disabled={!password}>{t('start.save')}</button>
        </form>
      ) : (
        <button type="button" className="link-btn" onClick={forgot}>{t('pin.forgot')}</button>
      )}
    </PinPad>
  )
}

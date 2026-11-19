'use client'

import { useEffect, useState } from 'react'

import { checkPin, clearPin, hasPin, setPin, waitLeft } from '../offline/pin'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'
import { PinPad } from './PinPad'

type Flow = 'set' | 'change' | 'off'
type Step = 'current' | 'new' | 'repeat'

/** Settings: turn the app PIN on or off, or change it (the current PIN is asked first). */
export function PinSettings() {
  const { t } = usePrefs()
  const [on, setOn] = useState(false)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [step, setStep] = useState<Step>('new')
  const [first, setFirst] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  useEffect(() => setOn(hasPin()), [])

  const start = (f: Flow) => {
    setFlow(f)
    setStep(f === 'set' ? 'new' : 'current')
    setHint(null)
  }
  const close = () => {
    setFlow(null)
    setFirst('')
    setOn(hasPin())
  }
  const done = async (pin: string): Promise<boolean> => {
    if (step === 'current') {
      const r = await checkPin(pin)
      if (r !== 'ok') {
        setHint(r === 'wait' ? t('pin.wait').replace('{n}', String(waitLeft())) : t('pin.wrong'))
        return false
      }
      if (flow === 'off') {
        clearPin()
        close()
      } else {
        setStep('new')
        setHint(null)
      }
      return true
    }
    if (step === 'new') {
      setFirst(pin)
      setStep('repeat')
      setHint(null)
      return true
    }
    if (pin !== first) {
      setStep('new')
      setFirst('')
      setHint(t('pin.mismatch'))
      return false
    }
    await setPin(pin)
    close()
    return true
  }

  return (
    <>
      <div className="glass menu">
        <div className="menu-row">
          <Icon name="lock" />
          <span className="grow">{t('pin.title')}<span className="row-sub">{t('pin.hint')}</span></span>
          <button type="button" role="switch" className="switch" aria-checked={on} aria-label={t('pin.title')} onClick={() => start(on ? 'off' : 'set')} />
        </div>
        {on ? (
          <button type="button" className="menu-row" onClick={() => start('change')}>
            <Icon name="key" /><span className="grow">{t('pin.change')}</span><Icon name="forward" size={18} />
          </button>
        ) : null}
      </div>
      {flow ? (
        <PinPad key={step} title={t(step === 'current' ? 'pin.current' : step === 'new' ? 'pin.new' : 'pin.repeat')} hint={hint} onDone={done} onCancel={close} />
      ) : null}
    </>
  )
}

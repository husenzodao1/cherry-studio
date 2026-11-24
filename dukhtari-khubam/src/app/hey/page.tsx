'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { CrownSpin } from '@/web/components/CrownSpin'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { showToast } from '@/web/components/Toast'
import { hey, native, PHRASES, phraseHeard, type HeyState } from '@/web/offline/hey'
import { usePlan } from '@/web/plans'
import { usePrefs } from '@/web/prefs'

/**
 * "Эй Маҳлиё" set up (Standard and Premium): the Tajik speech model downloaded once, the microphone allowed,
 * then her voice learnt — three phrases read aloud, each one accepted only when it was heard rightly — and
 * turned on. From then on Mahliyo wakes at her name in her voice, even with the screen off.
 */
export default function HeyPage() {
  const { t } = usePrefs()
  const router = useRouter()
  const { live, plan, open } = usePlan()
  const locked = live && plan === 'free'
  const [st, setSt] = useState<HeyState | null>(null)
  const [loading, setLoading] = useState<number | null>(null)
  const [step, setStep] = useState(0)
  const [prints, setPrints] = useState<number[][]>([])
  const [hearing, setHearing] = useState(false)
  const [heard, setHeard] = useState('')
  const [miss, setMiss] = useState(0)
  const [learning, setLearning] = useState(false)
  const partial = useRef<{ remove(): Promise<void> } | null>(null)

  const load = useCallback(async () => {
    if (!native()) return
    const { p } = await hey()
    setSt(await p.state())
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const back = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [load])
  useEffect(() => () => { void partial.current?.remove() }, [])

  const download = async () => {
    const { p } = await hey()
    setLoading(0)
    const l = await p.addListener('progress', (e) => {
      // the speaker model first (14 MB), then the Tajik one (52 MB): one bar for both
      const done = e.part === 'spk' ? e.done : 13_869_103 + e.done
      setLoading(Math.min(99, Math.round((done / 65_748_146) * 100)))
    })
    try {
      await p.prepare()
      await load()
    } catch {
      showToast(t('hey.download_failed'), 'info')
    } finally {
      setLoading(null)
      void l.remove()
    }
  }

  const allowMic = async () => {
    const { p } = await hey()
    setSt(await p.askMic())
  }

  /** one phrase: listened to, accepted only when heard rightly and her voice could be weighed */
  const say = async () => {
    const { p } = await hey()
    setHearing(true)
    setHeard('')
    partial.current = await p.addListener('partial', (e) => setHeard(e.text))
    try {
      const r = await p.listen({ seconds: 8 })
      setHeard(r.text)
      if (r.spk && phraseHeard(PHRASES[step], r.text)) {
        const next = [...prints, r.spk]
        setPrints(next)
        setMiss(0)
        if (step < PHRASES.length - 1) setStep(step + 1)
        else await learn(next)
      } else {
        setMiss((m) => m + 1)
      }
    } catch {
      showToast(t('state.error'), 'info')
    } finally {
      setHearing(false)
      void partial.current?.remove()
      partial.current = null
    }
  }

  const learn = async (all: number[][]) => {
    setLearning(true)
    const { p } = await hey()
    try {
      await p.saveVoice({ prints: all })
      await p.start()
      showToast(t('hey.ready'), 'check')
      await load()
    } catch {
      showToast(t('state.error'), 'info')
    } finally {
      setLearning(false)
    }
  }

  const again = async () => {
    const { p } = await hey()
    await p.forgetVoice()
    setStep(0)
    setPrints([])
    setMiss(0)
    setHeard('')
    await load()
  }

  const toggle = async (on: boolean) => {
    const { p } = await hey()
    try {
      if (on) await p.start()
      else await p.stop()
    } catch {
      showToast(t('state.error'), 'info')
    }
    await load()
  }

  const hero = (
    <div className="glass card-pad ws-hero">
      <span className="ws-hero-ico is-hey" aria-hidden="true"><Icon name="mic" size={28} /></span>
      <div className="stack" style={{ gap: 4 }}>
        <b>{t('hey.title')}</b>
        <span className="muted">{t('hey.lead')}</span>
      </div>
    </div>
  )

  if (locked || !native()) {
    return (
      <>
        <Header back="/settings" title={t('hey.title')} />
        <div className="section stack" style={{ gap: 14 }}>
          {hero}
          {locked ? (
            <div className="glass card-pad ws-locked">
              <CrownSpin plan="standard" size={92} />
              <b>{t('hey.locked')}</b>
              <button type="button" className="btn btn-block btn-lg" onClick={() => open('hey')}>{t('pw.settings_cta')}</button>
            </div>
          ) : <div className="glass card-pad muted">{t('hey.phone_only')}</div>}
        </div>
      </>
    )
  }

  const enrolled = !!st?.enrolled
  return (
    <>
      <Header back="/settings" title={t('hey.title')} />
      <div className="section stack hey" style={{ gap: 14 }}>
        {hero}
        {!st ? <div className="skeleton" style={{ height: 160, borderRadius: 24 }} /> : !st.models ? (
          <div className="glass card-pad stack" style={{ gap: 10 }}>
            <b>{t('hey.step_model')}</b>
            <span className="muted">{t('hey.model_sub')}</span>
            {loading !== null ? (
              <div className="ws-room" role="progressbar" aria-valuenow={loading} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${loading}%` }} /></div>
            ) : null}
            <button type="button" className="btn btn-block btn-lg" disabled={loading !== null} onClick={() => void download()}>
              <Icon name="arrow-down" size={18} /> {loading !== null ? `${loading}%` : t('hey.download')}
            </button>
          </div>
        ) : !st.mic ? (
          <div className="glass card-pad stack" style={{ gap: 10 }}>
            <b>{t('hey.step_mic')}</b>
            <span className="muted">{t('hey.mic_sub')}</span>
            <button type="button" className="btn btn-block btn-lg" onClick={() => void allowMic()}><Icon name="mic" size={18} /> {t('hey.allow_mic')}</button>
          </div>
        ) : !enrolled ? (
          <div className="glass card-pad stack hey-learn" style={{ gap: 12 }}>
            <div className="hey-steps" aria-label={t('hey.step_voice')}>
              {PHRASES.map((_, i) => <span key={i} className={i < step || (i === step && learning) ? 'is-done' : i === step ? 'is-on' : ''}>{i < step ? <Icon name="check" size={14} /> : i + 1}</span>)}
            </div>
            <b>{t('hey.step_voice')} · {step + 1}/3</b>
            <span className="muted">{t('hey.read_aloud')}</span>
            <p className="hey-phrase">«{PHRASES[step]}»</p>
            <p className={`hey-heard${hearing ? ' is-live' : ''}`} aria-live="polite">{heard || (hearing ? t('hey.listening') : ' ')}</p>
            {miss > 0 && !hearing ? <span className="hey-miss" role="alert">{t('hey.again')}</span> : null}
            <button type="button" className={`btn btn-block btn-lg hey-mic${hearing ? ' is-live' : ''}`} disabled={hearing || learning} onClick={() => void say()}>
              <Icon name="mic" size={20} /> {hearing ? t('hey.listening') : learning ? t('hey.learning') : t('hey.speak')}
            </button>
          </div>
        ) : (
          <>
            <div className="glass card-pad stack" style={{ gap: 12 }}>
              <label className="row hey-switch" style={{ gap: 12, alignItems: 'center' }}>
                <span className="grow"><b>{t('hey.on')}</b><span className="row-sub">{st.running ? t('hey.running') : t('hey.off')}</span></span>
                <input type="checkbox" role="switch" checked={st.enabled} onChange={(e) => void toggle(e.target.checked)} aria-label={t('hey.on')} />
              </label>
              <button type="button" className="btn btn-soft btn-block" onClick={() => router.push('/voice')}><Icon name="mic" size={18} /> {t('hey.try')}</button>
            </div>
            <div className="glass card-pad stack" style={{ gap: 8 }}>
              <b>{t('hey.better')}</b>
              {!st.overlay ? <button type="button" className="btn btn-soft btn-block" onClick={() => void hey().then(({ p }) => p.askOverlay())}>{t('hey.overlay')}</button> : null}
              <button type="button" className="btn btn-soft btn-block" onClick={() => void hey().then(({ p }) => p.assistantSettings())}>{t('hey.assistant')}</button>
              <span className="muted" style={{ fontSize: '0.84em' }}>{t('hey.assistant_sub')}</span>
              <button type="button" className="link-btn" onClick={() => void again()}>{t('hey.relearn')}</button>
            </div>
            <div className="glass card-pad stack" style={{ gap: 6 }}>
              <span className="eyebrow">{t('hey.examples')}</span>
              <ul className="tg-steps">
                <li>«Эй Маҳлиё, соат чанд?»</li>
                <li>«Эй Маҳлиё, таймер панҷ дақиқа»</li>
                <li>«Эй Маҳлиё, обу ҳаво чӣ гуна?»</li>
                <li>«Эй Маҳлиё, ба Малика занг зан»</li>
                <li>«Эй Маҳлиё, маро ба донишгоҳ бубар»</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  )
}
